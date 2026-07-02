from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Request

from app import db
from app.models import UserMasteryResponse, UserTopicMastery
from app.registry import SubjectRegistry
from app.routers.auth import get_current_user

router = APIRouter(tags=["mastery"])

GREEN_MIN_ATTEMPTS = 3
GREEN_MIN_SCORE = 70.0
GREEN_MAX_DAYS = 14


def _compute_status(attempts: int, avg_score: float | None, last_active: str | None) -> str:
    if attempts == 0 or last_active is None:
        return "untouched"
    last_dt = datetime.fromisoformat(last_active)
    days_since = (datetime.now(timezone.utc) - last_dt).days
    if (
        attempts >= GREEN_MIN_ATTEMPTS
        and avg_score is not None
        and avg_score >= GREEN_MIN_SCORE
        and days_since <= GREEN_MAX_DAYS
    ):
        return "green"
    return "amber"


def _objectives_total_by_topic(req: Request) -> dict[str, int]:
    registry: SubjectRegistry = req.app.state.registry
    totals: dict[str, int] = {}
    for subject_id in registry.all_subject_ids():
        subject = registry.get(subject_id)
        if subject is None:
            continue
        for topic_slug, objective_ids in subject.objectives_by_topic.items():
            totals[topic_slug] = len(objective_ids)
    return totals


@router.get("/mastery", response_model=UserMasteryResponse)
async def get_mastery(req: Request, current_user: dict = Depends(get_current_user)) -> UserMasteryResponse:
    user_id = current_user["sub"]
    rows = db.get_user_mastery(user_id)
    objectives_total_by_topic = _objectives_total_by_topic(req)

    topics = []
    for row in rows:
        total_available = row["total_available"] or 0
        total_awarded = row["total_awarded"] or 0
        avg_score = (
            round(total_awarded / total_available * 100, 1) if total_available > 0 else None
        )
        status = _compute_status(row["questions_attempted"], avg_score, row["last_active"])
        covered = db.get_covered_objectives_for_user(user_id, row["topic_slug"])
        topics.append(
            UserTopicMastery(
                topic_slug=row["topic_slug"],
                status=status,
                questions_attempted=row["questions_attempted"],
                avg_score_percent=avg_score,
                last_active=row["last_active"],
                objectives_covered=len(covered),
                objectives_total=objectives_total_by_topic.get(row["topic_slug"], 0),
            )
        )

    return UserMasteryResponse(topics=topics)
