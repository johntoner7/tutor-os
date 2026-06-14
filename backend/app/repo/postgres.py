import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool


class PostgresRepository:
    def __init__(self, database_url: str) -> None:
        self._pool = ThreadedConnectionPool(1, 10, database_url)

    def _conn(self):
        return _PooledConnection(self._pool)

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def init_db(self) -> None:
        print("Initializing Postgres database...")
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id         TEXT PRIMARY KEY,
                        email      TEXT NOT NULL UNIQUE,
                        created_at TEXT NOT NULL
                    )
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS magic_link_tokens (
                        token      TEXT PRIMARY KEY,
                        email      TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        used_at    TEXT
                    )
                """)
                cur.execute("""
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
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS activity_events (
                        id               SERIAL PRIMARY KEY,
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
                cur.execute("CREATE INDEX IF NOT EXISTS idx_session ON activity_events(session_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_topic ON activity_events(session_id, topic_slug)")

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
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO activity_events
                       (session_id, timestamp, event_type, subject, topic_slug, message_role, message_content, user_id)
                       VALUES (%s, %s, 'chat_message', %s, %s, %s, %s, %s)""",
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
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO activity_events
                       (session_id, timestamp, event_type, subject, topic_slug, question_id, user_id)
                       VALUES (%s, %s, 'question_served', %s, %s, %s, %s)""",
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
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO activity_events
                       (session_id, timestamp, event_type, subject, topic_slug, question_id,
                        student_answer, marks_awarded, marks_available, user_id)
                       VALUES (%s, %s, 'answer_marked', %s, %s, %s, %s, %s, %s, %s)""",
                    (session_id, self._now(), subject, topic_slug, question_id,
                     student_answer, marks_awarded, marks_available, user_id),
                )

    def get_mastery(self, session_id: str) -> list[dict]:
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT
                        topic_slug,
                        COUNT(CASE WHEN event_type = 'answer_marked' THEN 1 END) AS questions_attempted,
                        SUM(CASE WHEN event_type = 'answer_marked' THEN marks_awarded   ELSE 0 END) AS total_awarded,
                        SUM(CASE WHEN event_type = 'answer_marked' THEN marks_available ELSE 0 END) AS total_available,
                        MAX(timestamp) AS last_active
                    FROM activity_events
                    WHERE session_id = %s AND topic_slug IS NOT NULL
                    GROUP BY topic_slug
                    ORDER BY last_active DESC
                    """,
                    (session_id,),
                )
                return [dict(r) for r in cur.fetchall()]

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
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO generated_questions
                       (id, subject, topic_slug, topic_name, question, mark_scheme, marks, difficulty, created_at)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                       ON CONFLICT (id) DO NOTHING""",
                    (question_id, subject, topic_slug, topic_name, question,
                     mark_scheme, marks, difficulty, self._now()),
                )

    def get_generated_question(self, question_id: str) -> dict | None:
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT * FROM generated_questions WHERE id = %s", (question_id,))
                row = cur.fetchone()
        return dict(row) if row else None

    def get_session_events(self, session_id: str) -> list[dict]:
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT * FROM activity_events WHERE session_id = %s ORDER BY timestamp ASC",
                    (session_id,),
                )
                return [dict(r) for r in cur.fetchall()]

    def get_user_context(self, user_id: str) -> dict:
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT MAX(timestamp) AS last_active, COUNT(*) AS total_events
                    FROM activity_events WHERE user_id = %s
                    """,
                    (user_id,),
                )
                summary = cur.fetchone()
                cur.execute(
                    """
                    SELECT
                        topic_slug,
                        COUNT(*) AS attempts,
                        SUM(marks_awarded)   AS awarded,
                        SUM(marks_available) AS available,
                        MAX(timestamp)       AS last_active
                    FROM activity_events
                    WHERE user_id = %s AND event_type = 'answer_marked' AND topic_slug IS NOT NULL
                    GROUP BY topic_slug
                    """,
                    (user_id,),
                )
                mastery_rows = cur.fetchall()
        return {
            "last_active": summary["last_active"] if summary else None,
            "total_events": summary["total_events"] if summary else 0,
            "topic_mastery": [dict(r) for r in mastery_rows],
        }

    def get_user_mastery(self, user_id: str) -> list[dict]:
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT
                        topic_slug,
                        COUNT(*) AS questions_attempted,
                        SUM(marks_awarded)   AS total_awarded,
                        SUM(marks_available) AS total_available,
                        MAX(timestamp)       AS last_active
                    FROM activity_events
                    WHERE user_id = %s AND event_type = 'answer_marked' AND topic_slug IS NOT NULL
                    GROUP BY topic_slug
                    """,
                    (user_id,),
                )
                return [dict(r) for r in cur.fetchall()]

    def create_magic_token(self, email: str, token: str) -> None:
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO magic_link_tokens (token, email, created_at) VALUES (%s, %s, %s)",
                    (token, email.lower().strip(), self._now()),
                )

    def consume_magic_token(self, token: str) -> str | None:
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT email, created_at, used_at FROM magic_link_tokens WHERE token = %s",
                    (token,),
                )
                row = cur.fetchone()
                if not row or row["used_at"]:
                    return None
                created = datetime.fromisoformat(row["created_at"])
                if datetime.now(timezone.utc) - created > timedelta(minutes=15):
                    return None
                cur.execute(
                    "UPDATE magic_link_tokens SET used_at = %s WHERE token = %s",
                    (self._now(), token),
                )
                return row["email"]

    def get_or_create_user(self, email: str) -> dict:
        email = email.lower().strip()
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT * FROM users WHERE email = %s", (email,))
                row = cur.fetchone()
                if row:
                    return dict(row)
                user_id = str(uuid.uuid4())
                now = self._now()
                cur.execute(
                    "INSERT INTO users (id, email, created_at) VALUES (%s, %s, %s)",
                    (user_id, email, now),
                )
                return {"id": user_id, "email": email, "created_at": now}

    def get_user_by_id(self, user_id: str) -> dict | None:
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
                row = cur.fetchone()
        return dict(row) if row else None


class _PooledConnection:
    """Context manager that borrows a connection from the pool and commits/rolls back on exit."""

    def __init__(self, pool: ThreadedConnectionPool) -> None:
        self._pool = pool
        self._conn: Any = None

    def __enter__(self):
        self._conn = self._pool.getconn()
        return self._conn

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self._conn.rollback()
        else:
            self._conn.commit()
        self._pool.putconn(self._conn)
        return False
