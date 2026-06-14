from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request

from app import db
from app.llm import complete
from app.models import MasteryResponse, QuizSummaryRequest, QuizSummaryResponse, SessionStartResponse, SessionSummary, TopicMastery
from app.prompts import build_greeting_prompt, build_quiz_summary_prompt, build_summary_prompt
from app.registry import SubjectRegistry
from app.routers.auth import get_current_user

router = APIRouter(tags=["session"])

_GREEN_MIN_ATTEMPTS = 3
_GREEN_MIN_SCORE = 70.0
_GREEN_MAX_DAYS = 14


def _recommend_topic(
    mastery_rows: list[dict],
    all_topic_slugs: list[str],
) -> tuple[str | None, str | None, float | None]:
    """
    Returns (suggested_slug, weakest_slug, weakest_avg_score).
    Priority: amber topic with lowest avg score → first untouched in spec order.
    """
    attempted: dict[str, dict] = {}
    for row in mastery_rows:
        avail = row["available"] or 0
        avg = round(row["awarded"] / avail * 100, 1) if avail > 0 else None
        last = row["last_active"]
        days = (datetime.now(timezone.utc) - datetime.fromisoformat(last)).days if last else 999
        is_green = (
            row["attempts"] >= _GREEN_MIN_ATTEMPTS
            and avg is not None
            and avg >= _GREEN_MIN_SCORE
            and days <= _GREEN_MAX_DAYS
        )
        attempted[row["topic_slug"]] = {"avg": avg, "is_green": is_green}

    amber = {slug: d for slug, d in attempted.items() if not d["is_green"]}
    weakest_slug = None
    weakest_avg = None
    if amber:
        weakest_slug = min(amber, key=lambda s: amber[s]["avg"] if amber[s]["avg"] is not None else 0)
        weakest_avg = amber[weakest_slug]["avg"]
        return weakest_slug, weakest_slug, weakest_avg

    untouched = [s for s in all_topic_slugs if s not in attempted]
    if untouched:
        return untouched[0], None, None

    return None, None, None


@router.post("/session/start", response_model=SessionStartResponse)
async def session_start(
    req: Request,
    current_user: dict = Depends(get_current_user),
) -> SessionStartResponse:
    user_id = current_user["sub"]
    registry: SubjectRegistry = req.app.state.registry
    subject = registry.get("biology")

    all_topic_slugs = [t["slug"] for t in (subject.topics if subject else [])]
    slug_to_name = {t["slug"]: t["name"] for t in (subject.topics if subject else [])}

    context = db.get_user_context(user_id)
    suggested_slug, weakest_slug, weakest_avg = _recommend_topic(
        context["topic_mastery"], all_topic_slugs
    )

    suggested_name = slug_to_name.get(suggested_slug) if suggested_slug else None
    weakest_name = slug_to_name.get(weakest_slug) if weakest_slug else None

    prompt = build_greeting_prompt(
        context=context,
        suggested_topic_name=suggested_name,
        weakest_topic_name=weakest_name,
        weakest_avg=weakest_avg,
    )
    greeting, _ = complete(
        system=prompt["system"],
        messages=prompt["messages"],
        max_tokens=80,
        context="greeting",
    )

    return SessionStartResponse(
        greeting=greeting.strip(),
        suggested_topic_slug=suggested_slug,
        suggested_topic_name=suggested_name,
    )


@router.get("/session/{session_id}/mastery", response_model=MasteryResponse)
async def get_mastery(session_id: str) -> MasteryResponse:
    rows = db.get_mastery(session_id)
    topics = []
    for row in rows:
        total_available = row["total_available"] or 0
        total_awarded = row["total_awarded"] or 0
        score_percent = (
            round(total_awarded / total_available * 100, 1) if total_available > 0 else None
        )
        topics.append(
            TopicMastery(
                topic_slug=row["topic_slug"],
                questions_attempted=row["questions_attempted"],
                score_percent=score_percent,
                last_active=row["last_active"],
            )
        )
    return MasteryResponse(session_id=session_id, topics=topics)


@router.get("/session/{session_id}/summary", response_model=SessionSummary)
async def get_summary(
    session_id: str,
    current_user: dict = Depends(get_current_user),
) -> SessionSummary:
    events = db.get_session_events(session_id)
    if not events:
        raise HTTPException(status_code=404, detail="No activity found for this session")

    mark_events = [e for e in events if e["event_type"] == "answer_marked"]
    topics_covered = list(dict.fromkeys(
        e["topic_slug"] for e in events if e.get("topic_slug")
    ))
    questions_attempted = len(mark_events)

    total_awarded = total_available = None
    if mark_events:
        total_awarded = sum(e["marks_awarded"] for e in mark_events)
        total_available = sum(e["marks_available"] for e in mark_events)
        average_score_percent = round(total_awarded / total_available * 100, 1) if total_available else None
    else:
        average_score_percent = None

    prompt = build_summary_prompt(events)
    summary_text, _ = complete(
        system=prompt["system"],
        messages=prompt["messages"],
        max_tokens=300,
        context="session_summary",
    )

    db.save_session_summary(
        session_id=session_id,
        summary_type="session",
        summary_text=summary_text,
        user_id=current_user.get("sub"),
        questions_attempted=questions_attempted,
        total_awarded=total_awarded,
        total_available=total_available,
        average_score_percent=average_score_percent,
    )

    return SessionSummary(
        session_id=session_id,
        summary=summary_text,
        topics_covered=topics_covered,
        questions_attempted=questions_attempted,
        average_score_percent=average_score_percent,
    )


@router.post("/quiz/summary", response_model=QuizSummaryResponse)
async def quiz_summary(
    body: QuizSummaryRequest,
    current_user: dict = Depends(get_current_user),
) -> QuizSummaryResponse:
    if not body.results:
        raise HTTPException(status_code=400, detail="No results provided")

    results_dicts = [r.model_dump() for r in body.results]
    total_awarded = sum(r["marks_awarded"] for r in results_dicts)
    total_available = sum(r["marks_available"] for r in results_dicts)
    average_score_percent = round(total_awarded / total_available * 100, 1) if total_available else None

    prompt = build_quiz_summary_prompt(body.topic_name, results_dicts)
    summary_text, _ = complete(
        system=prompt["system"],
        messages=prompt["messages"],
        max_tokens=250,
        context="quiz_summary",
    )

    db.save_session_summary(
        session_id=body.session_id or "unknown",
        summary_type="quiz",
        summary_text=summary_text,
        user_id=current_user.get("sub"),
        topic_slug=body.topic_slug,
        topic_name=body.topic_name,
        questions_attempted=len(results_dicts),
        total_awarded=total_awarded,
        total_available=total_available,
        average_score_percent=average_score_percent,
    )

    return QuizSummaryResponse(
        summary=summary_text,
        questions_attempted=len(results_dicts),
        total_awarded=total_awarded,
        total_available=total_available,
        average_score_percent=average_score_percent,
    )
