"""
Thin shim — delegates to the repository selected at startup.
Routers import `from app import db` and call module-level functions; this module
satisfies that interface without them knowing which backend is in use.
"""
from app.repo import get_repo

_repo = get_repo()


def init_db() -> None:
    print("Initializing database...")
    print(f"Using repository: {_repo.__class__.__name__}")
    _repo.init_db()


def log_chat_message(session_id, subject, topic_slug, role, content, user_id=None):
    _repo.log_chat_message(session_id, subject, topic_slug, role, content, user_id)


def log_question_served(session_id, subject, topic_slug, question_id, user_id=None):
    _repo.log_question_served(session_id, subject, topic_slug, question_id, user_id)


def log_answer_marked(session_id, subject, topic_slug, question_id, student_answer,
                      marks_awarded, marks_available, user_id=None):
    _repo.log_answer_marked(session_id, subject, topic_slug, question_id,
                            student_answer, marks_awarded, marks_available, user_id)


def get_mastery(session_id):
    return _repo.get_mastery(session_id)


def save_generated_question(question_id, subject, topic_slug, topic_name,
                            question, mark_scheme, marks, difficulty):
    _repo.save_generated_question(question_id, subject, topic_slug, topic_name,
                                  question, mark_scheme, marks, difficulty)


def get_generated_question(question_id):
    return _repo.get_generated_question(question_id)


def get_session_events(session_id):
    return _repo.get_session_events(session_id)


def get_user_context(user_id):
    return _repo.get_user_context(user_id)


def get_user_mastery(user_id):
    return _repo.get_user_mastery(user_id)


def create_magic_token(email, token):
    _repo.create_magic_token(email, token)


def consume_magic_token(token):
    return _repo.consume_magic_token(token)


def get_or_create_user(email):
    return _repo.get_or_create_user(email)


def get_user_by_id(user_id):
    return _repo.get_user_by_id(user_id)


def save_session_summary(
    session_id: str,
    summary_type: str,
    summary_text: str,
    user_id: str | None = None,
    topic_slug: str | None = None,
    topic_name: str | None = None,
    weak_spots: str | None = None,
    questions_attempted: int | None = None,
    total_awarded: int | None = None,
    total_available: int | None = None,
    average_score_percent: float | None = None,
) -> None:
    _repo.save_session_summary(
        session_id=session_id,
        summary_type=summary_type,
        summary_text=summary_text,
        user_id=user_id,
        topic_slug=topic_slug,
        topic_name=topic_name,
        weak_spots=weak_spots,
        questions_attempted=questions_attempted,
        total_awarded=total_awarded,
        total_available=total_available,
        average_score_percent=average_score_percent,
    )
