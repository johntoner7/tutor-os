from typing import Protocol


class Repository(Protocol):
    def init_db(self) -> None: ...

    def log_chat_message(
        self,
        session_id: str,
        subject: str,
        topic_slug: str | None,
        role: str,
        content: str,
        user_id: str | None = None,
    ) -> None: ...

    def log_question_served(
        self,
        session_id: str,
        subject: str,
        topic_slug: str,
        question_id: str,
        user_id: str | None = None,
    ) -> None: ...

    def log_answer_marked(
        self,
        session_id: str,
        subject: str,
        topic_slug: str,
        question_id: str,
        student_answer: str,
        marks_awarded: int,
        marks_available: int,
        user_id: str | None = None,
    ) -> None: ...

    def get_mastery(self, session_id: str) -> list[dict]: ...

    def save_generated_question(
        self,
        question_id: str,
        subject: str,
        topic_slug: str,
        topic_name: str,
        question: str,
        mark_scheme: str,
        marks: int,
        difficulty: str,
    ) -> None: ...

    def get_generated_question(self, question_id: str) -> dict | None: ...

    def get_session_events(self, session_id: str) -> list[dict]: ...

    def get_recent_questions_for_session(
        self, session_id: str, topic_slug: str, limit: int = 10
    ) -> list[str]: ...

    def get_user_context(self, user_id: str) -> dict: ...

    def get_user_mastery(self, user_id: str) -> list[dict]: ...

    def create_magic_token(self, email: str, token: str) -> None: ...

    def consume_magic_token(self, token: str) -> str | None: ...

    def get_or_create_user(self, email: str) -> dict: ...

    def get_user_by_id(self, user_id: str) -> dict | None: ...

    def save_session_summary(
        self,
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
    ) -> None: ...
