import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request

from app import db
from app.llm import complete
from app.models import MarkRequest, MarkResponse, QuestionRequest, QuestionResponse
from app.prompts import build_marking_prompt, build_question_generation_prompt, pick_question_type
from app.registry import Subject, SubjectRegistry
from app.routers.auth import get_optional_user

router = APIRouter(tags=["questions"])


def _topic_name(subject: Subject, topic_slug: str) -> str:
    for t in subject.topics:
        if t["slug"] == topic_slug:
            return t["name"]
    return topic_slug.replace("-", " ").title()


async def _generate_question(
    subject: Subject,
    subject_id: str,
    topic_slug: str,
) -> QuestionResponse:
    topic_name = _topic_name(subject, topic_slug)
    command_word, _ = pick_question_type()

    # Retrieve spec chunks to ground the question in curriculum content
    query = f"{topic_name} key concepts"
    chunks = subject.retriever.retrieve_spec_chunks(query=query, topic_slug=topic_slug, top_k=4)
    if not chunks:
        chunks = subject.retriever.retrieve_spec_chunks(query=query, top_k=4)

    prompt = build_question_generation_prompt(chunks, topic_name, command_word)
    raw, _ = complete(
        system=prompt["system"],
        messages=prompt["messages"],
        max_tokens=300,
        context="question_generation",
    )

    try:
        data = json.loads(_strip_fences(raw))
        question_text = str(data["question"])
        mark_scheme = str(data["mark_scheme"])
        marks = int(data["marks"])
        difficulty = str(data.get("difficulty", "medium"))
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        print(f"[question_gen] failed to parse LLM response ({e}). Raw: {raw[:200]!r}")
        raise HTTPException(status_code=502, detail="Failed to generate question — please try again")

    question_id = f"gen_{uuid.uuid4().hex[:12]}"
    db.save_generated_question(
        question_id=question_id,
        subject=subject_id,
        topic_slug=topic_slug,
        topic_name=topic_name,
        question=question_text,
        mark_scheme=mark_scheme,
        marks=marks,
        difficulty=difficulty,
    )

    return QuestionResponse(
        question_id=question_id,
        question=question_text,
        marks=marks,
        year=None,
        topic=topic_name,
        difficulty=difficulty,
        is_generated=True,
    )


@router.post("/question", response_model=QuestionResponse)
async def get_question(
    request: QuestionRequest,
    req: Request,
    current_user: dict | None = Depends(get_optional_user),
) -> QuestionResponse:
    user_id = current_user["sub"] if current_user else None
    registry: SubjectRegistry = req.app.state.registry
    subject = registry.get(request.subject)
    if subject is None:
        raise HTTPException(status_code=404, detail=f"Subject '{request.subject}' not found")

    response = await _generate_question(subject, request.subject, request.topic_slug)
    if request.session_id:
        db.log_question_served(
            request.session_id, request.subject, request.topic_slug, response.question_id, user_id
        )
    return response


@router.post("/question/{question_id}/mark", response_model=MarkResponse)
async def mark_answer(
    question_id: str,
    request: MarkRequest,
    req: Request,
    current_user: dict | None = Depends(get_optional_user),
) -> MarkResponse:
    user_id = current_user["sub"] if current_user else None
    subject_id = req.query_params.get("subject", "biology")
    registry: SubjectRegistry = req.app.state.registry
    subject = registry.get(subject_id)
    if subject is None:
        raise HTTPException(status_code=404, detail=f"Subject '{subject_id}' not found")

    question = db.get_generated_question(question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    prompt = build_marking_prompt(
        question=question["question"],
        mark_scheme=question["mark_scheme"],
        marks_available=int(question["marks"]),
        student_answer=request.student_answer,
    )

    raw, _ = complete(
        system=prompt["system"],
        messages=prompt["messages"],
        max_tokens=400,
        context="marking",
    )

    result = _parse_marking_response(raw, int(question["marks"]))

    if request.session_id:
        db.log_answer_marked(
            session_id=request.session_id,
            subject=subject_id,
            topic_slug=question.get("topic_slug", ""),
            question_id=question_id,
            student_answer=request.student_answer,
            marks_awarded=result.marks_awarded,
            marks_available=result.marks_available,
            user_id=user_id,
        )

    return result


def _strip_fences(raw: str) -> str:
    return raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()


def _parse_marking_response(raw: str, marks_available: int) -> MarkResponse:
    try:
        data = json.loads(_strip_fences(raw))
        return MarkResponse(
            marks_awarded=min(int(data["marks_awarded"]), marks_available),
            marks_available=marks_available,
            awarded_points=list(data.get("awarded_points", [])),
            missed_points=list(data.get("missed_points", [])),
            model_answer_hint=str(data.get("model_answer_hint", "")),
        )
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        print(f"[marking] failed to parse LLM response ({type(e).__name__}: {e}). Raw: {raw[:200]!r}")
        return MarkResponse(
            marks_awarded=0,
            marks_available=marks_available,
            awarded_points=[],
            missed_points=[],
            model_answer_hint="Could not parse marking response. Please try submitting your answer again.",
        )
