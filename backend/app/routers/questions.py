import json
import random
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request

from app import db
from app.llm import complete
from app.models import FreeMarkRequest, FreeMarkResponse, MarkRequest, MarkResponse, QuestionRequest, QuestionResponse
from app.config import settings
from app.prompts import build_free_mark_prompt, build_marking_prompt, build_question_generation_prompt, build_vision_extraction_prompt, pick_question_type
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
    session_id: str | None = None,
) -> QuestionResponse:
    topic_name = _topic_name(subject, topic_slug)
    command_word, _ = pick_question_type()

    # Vary the retrieval query to surface different spec chunks each call
    query_templates = [
        f"{topic_name} {command_word.lower()} definition",
        f"{topic_name} examples processes",
        f"{topic_name} functions structure",
        f"{topic_name} key concepts",
    ]
    query = random.choice(query_templates)
    chunks = subject.retriever.retrieve_spec_chunks(query=query, topic_slug=topic_slug, top_k=5)
    if not chunks:
        chunks = subject.retriever.retrieve_spec_chunks(query=query, top_k=5)

    previous_questions = (
        db.get_recent_questions_for_session(session_id, topic_slug)
        if session_id else []
    )

    prompt = build_question_generation_prompt(chunks, topic_name, command_word, previous_questions)
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

    response = await _generate_question(subject, request.subject, request.topic_slug, request.session_id)
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


@router.post("/mark-free", response_model=FreeMarkResponse)
async def mark_free_answer(
    request: FreeMarkRequest,
    req: Request,
    current_user: dict | None = Depends(get_optional_user),
) -> FreeMarkResponse:
    user_id = current_user["sub"] if current_user else None

    question_text = request.question
    answer_text = request.student_answer
    extracted_question: str | None = None
    extracted_answer: str | None = None

    if request.image_base64:
        if settings.llm_provider != "anthropic":
            raise HTTPException(
                status_code=400,
                detail="Image upload requires Anthropic as the LLM provider.",
            )
        vision_prompt = build_vision_extraction_prompt(
            request.image_base64,
            extract_answer=request.image_extract_answer,
        )
        raw_extraction, _ = complete(
            system=vision_prompt["system"],
            messages=vision_prompt["messages"],
            max_tokens=800,
            context="image_extraction",
        )
        eq, ea = _parse_extraction_response(raw_extraction)
        if eq:
            question_text = eq
            extracted_question = eq
        if ea and request.image_extract_answer:
            answer_text = ea
            extracted_answer = ea

    if len(question_text.strip()) < 5:
        raise HTTPException(
            status_code=400,
            detail="Could not read a question from the image. Please type the question manually.",
        )

    if len(answer_text.strip()) < 1:
        raise HTTPException(
            status_code=400,
            detail="No answer found. Please type your answer or make sure it is visible in the image.",
        )

    prompt = build_free_mark_prompt(
        question=question_text,
        student_answer=answer_text,
        marks_available=request.marks_available,
    )

    raw, _ = complete(
        system=prompt["system"],
        messages=prompt["messages"],
        max_tokens=400,
        context="free_marking",
    )

    result = _parse_free_marking_response(raw, request.marks_available)
    result.extracted_question = extracted_question
    result.extracted_answer = extracted_answer

    if request.session_id:
        db.log_answer_marked(
            session_id=request.session_id,
            subject="biology",
            topic_slug=request.topic_slug or "",
            question_id="free_mark",
            student_answer=answer_text,
            marks_awarded=result.marks_awarded,
            marks_available=result.marks_available,
            user_id=user_id,
        )

    return result


def _strip_fences(raw: str) -> str:
    return raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()


def _parse_extraction_response(raw: str) -> tuple[str, str]:
    """Returns (question, answer) extracted from vision response."""
    try:
        data = json.loads(_strip_fences(raw))
        return data.get("question", "").strip(), data.get("answer", "").strip()
    except Exception:
        return "", ""


def _parse_free_marking_response(raw: str, marks_available: int) -> FreeMarkResponse:
    try:
        data = json.loads(_strip_fences(raw))
        return FreeMarkResponse(
            marks_awarded=min(int(data["marks_awarded"]), marks_available),
            marks_available=marks_available,
            awarded_points=list(data.get("awarded_points", [])),
            missed_points=list(data.get("missed_points", [])),
            model_answer_hint=str(data.get("model_answer_hint", "")),
        )
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        print(f"[free_marking] failed to parse LLM response ({type(e).__name__}: {e}). Raw: {raw[:200]!r}")
        return FreeMarkResponse(
            marks_awarded=0,
            marks_available=marks_available,
            awarded_points=[],
            missed_points=[],
            model_answer_hint="Could not parse marking response. Please try submitting your answer again.",
        )


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
