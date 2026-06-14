import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path


class SQLiteRepository:
    def __init__(self, db_path: Path | None = None) -> None:
        self._path = db_path or Path(__file__).parent.parent.parent / "logs" / "activity.db"

    @contextmanager
    def _conn(self):
        self._path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self._path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def init_db(self) -> None:
        with self._conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id         TEXT PRIMARY KEY,
                    email      TEXT NOT NULL UNIQUE,
                    created_at TEXT NOT NULL
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS magic_link_tokens (
                    token      TEXT PRIMARY KEY,
                    email      TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    used_at    TEXT
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS generated_questions (
                    id          TEXT PRIMARY KEY,
                    subject     TEXT NOT NULL,
                    topic_slug  TEXT NOT NULL,
                    topic_name  TEXT NOT NULL,
                    question    TEXT NOT NULL,
                    mark_scheme TEXT NOT NULL,
                    marks       INTEGER NOT NULL,
                    difficulty  TEXT NOT NULL,
                    created_at  TEXT NOT NULL
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS activity_events (
                    id               INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id       TEXT    NOT NULL,
                    timestamp        TEXT    NOT NULL,
                    event_type       TEXT    NOT NULL,
                    subject          TEXT    NOT NULL,
                    topic_slug       TEXT,
                    message_role     TEXT,
                    message_content  TEXT,
                    question_id      TEXT,
                    student_answer   TEXT,
                    marks_awarded    INTEGER,
                    marks_available  INTEGER,
                    user_id          TEXT
                )
            """)
            for col, definition in [
                ("student_answer", "TEXT"),
                ("user_id", "TEXT"),
            ]:
                try:
                    conn.execute(f"ALTER TABLE activity_events ADD COLUMN {col} {definition}")
                except Exception:
                    pass
            conn.execute("CREATE INDEX IF NOT EXISTS idx_session ON activity_events(session_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_topic ON activity_events(session_id, topic_slug)")
            conn.execute("""
                CREATE TABLE IF NOT EXISTS session_summaries (
                    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at            TEXT NOT NULL,
                    session_id            TEXT NOT NULL,
                    user_id               TEXT,
                    summary_type          TEXT NOT NULL,
                    topic_slug            TEXT,
                    topic_name            TEXT,
                    summary_text          TEXT NOT NULL,
                    weak_spots            TEXT,
                    questions_attempted   INTEGER,
                    total_awarded         INTEGER,
                    total_available       INTEGER,
                    average_score_percent REAL
                )
            """)

    def log_chat_message(
        self,
        session_id: str,
        subject: str,
        topic_slug: str | None,
        role: str,
        content: str,
        user_id: str | None = None,
    ) -> None:
        with self._conn() as conn:
            conn.execute(
                """INSERT INTO activity_events
                   (session_id, timestamp, event_type, subject, topic_slug, message_role, message_content, user_id)
                   VALUES (?, ?, 'chat_message', ?, ?, ?, ?, ?)""",
                (session_id, self._now(), subject, topic_slug, role, content, user_id),
            )

    def log_question_served(
        self,
        session_id: str,
        subject: str,
        topic_slug: str,
        question_id: str,
        user_id: str | None = None,
    ) -> None:
        with self._conn() as conn:
            conn.execute(
                """INSERT INTO activity_events
                   (session_id, timestamp, event_type, subject, topic_slug, question_id, user_id)
                   VALUES (?, ?, 'question_served', ?, ?, ?, ?)""",
                (session_id, self._now(), subject, topic_slug, question_id, user_id),
            )

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
    ) -> None:
        with self._conn() as conn:
            conn.execute(
                """INSERT INTO activity_events
                   (session_id, timestamp, event_type, subject, topic_slug, question_id,
                    student_answer, marks_awarded, marks_available, user_id)
                   VALUES (?, ?, 'answer_marked', ?, ?, ?, ?, ?, ?, ?)""",
                (session_id, self._now(), subject, topic_slug, question_id,
                 student_answer, marks_awarded, marks_available, user_id),
            )

    def get_mastery(self, session_id: str) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                """
                SELECT
                    topic_slug,
                    COUNT(CASE WHEN event_type = 'answer_marked' THEN 1 END) AS questions_attempted,
                    SUM(CASE WHEN event_type = 'answer_marked' THEN marks_awarded   ELSE 0 END) AS total_awarded,
                    SUM(CASE WHEN event_type = 'answer_marked' THEN marks_available ELSE 0 END) AS total_available,
                    MAX(timestamp) AS last_active
                FROM activity_events
                WHERE session_id = ? AND topic_slug IS NOT NULL
                GROUP BY topic_slug
                ORDER BY last_active DESC
                """,
                (session_id,),
            ).fetchall()
        return [dict(r) for r in rows]

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
    ) -> None:
        with self._conn() as conn:
            conn.execute(
                """INSERT OR IGNORE INTO generated_questions
                   (id, subject, topic_slug, topic_name, question, mark_scheme, marks, difficulty, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (question_id, subject, topic_slug, topic_name, question,
                 mark_scheme, marks, difficulty, self._now()),
            )

    def get_generated_question(self, question_id: str) -> dict | None:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM generated_questions WHERE id = ?", (question_id,)
            ).fetchone()
        return dict(row) if row else None

    def get_session_events(self, session_id: str) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM activity_events WHERE session_id = ? ORDER BY timestamp ASC",
                (session_id,),
            ).fetchall()
        return [dict(r) for r in rows]

    def get_user_context(self, user_id: str) -> dict:
        with self._conn() as conn:
            summary = conn.execute(
                """
                SELECT MAX(timestamp) AS last_active, COUNT(*) AS total_events
                FROM activity_events WHERE user_id = ?
                """,
                (user_id,),
            ).fetchone()
            mastery_rows = conn.execute(
                """
                SELECT
                    topic_slug,
                    COUNT(*) AS attempts,
                    SUM(marks_awarded)   AS awarded,
                    SUM(marks_available) AS available,
                    MAX(timestamp)       AS last_active
                FROM activity_events
                WHERE user_id = ? AND event_type = 'answer_marked' AND topic_slug IS NOT NULL
                GROUP BY topic_slug
                """,
                (user_id,),
            ).fetchall()
        return {
            "last_active": summary["last_active"] if summary else None,
            "total_events": summary["total_events"] if summary else 0,
            "topic_mastery": [dict(r) for r in mastery_rows],
        }

    def get_user_mastery(self, user_id: str) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                """
                SELECT
                    topic_slug,
                    COUNT(*) AS questions_attempted,
                    SUM(marks_awarded)   AS total_awarded,
                    SUM(marks_available) AS total_available,
                    MAX(timestamp)       AS last_active
                FROM activity_events
                WHERE user_id = ? AND event_type = 'answer_marked' AND topic_slug IS NOT NULL
                GROUP BY topic_slug
                """,
                (user_id,),
            ).fetchall()
        return [dict(r) for r in rows]

    def create_magic_token(self, email: str, token: str) -> None:
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO magic_link_tokens (token, email, created_at) VALUES (?, ?, ?)",
                (token, email.lower().strip(), self._now()),
            )

    def consume_magic_token(self, token: str) -> str | None:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT email, created_at, used_at FROM magic_link_tokens WHERE token = ?",
                (token,),
            ).fetchone()
            if not row or row["used_at"]:
                return None
            created = datetime.fromisoformat(row["created_at"])
            if datetime.now(timezone.utc) - created > timedelta(minutes=15):
                return None
            conn.execute(
                "UPDATE magic_link_tokens SET used_at = ? WHERE token = ?",
                (self._now(), token),
            )
            return row["email"]

    def get_or_create_user(self, email: str) -> dict:
        email = email.lower().strip()
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
            if row:
                return dict(row)
            user_id = str(uuid.uuid4())
            now = self._now()
            conn.execute(
                "INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)",
                (user_id, email, now),
            )
            return {"id": user_id, "email": email, "created_at": now}

    def get_user_by_id(self, user_id: str) -> dict | None:
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None

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
    ) -> None:
        with self._conn() as conn:
            conn.execute(
                """INSERT INTO session_summaries
                   (created_at, session_id, user_id, summary_type, topic_slug, topic_name,
                    summary_text, weak_spots, questions_attempted,
                    total_awarded, total_available, average_score_percent)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (self._now(), session_id, user_id, summary_type, topic_slug, topic_name,
                 summary_text, weak_spots, questions_attempted,
                 total_awarded, total_available, average_score_percent),
            )
