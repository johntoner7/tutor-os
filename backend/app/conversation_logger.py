"""
Append-only log of every chat turn — what was sent and what came back.

Records are written to the ai_conversation_logs table in Postgres.
Each record includes the full message history sent to the API, the response,
the spec chunks used for retrieval, and token cost data.

Falls back to a local JSONL file if no database connection is available.
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path

_FALLBACK_LOG_PATH = Path(__file__).parent.parent / "logs" / "conversations.jsonl"


def record(
    *,
    subject: str,
    topic_slug: str,
    user_message: str,
    history: list[dict],
    spec_chunk_ids: list[str],
    response: str,
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    input_cost_usd: float,
    output_cost_usd: float,
    cache_hit: bool,
) -> None:
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        _record_postgres(
            database_url=database_url,
            subject=subject,
            topic_slug=topic_slug,
            user_message=user_message,
            history=history,
            spec_chunk_ids=spec_chunk_ids,
            response=response,
            provider=provider,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            input_cost_usd=input_cost_usd,
            output_cost_usd=output_cost_usd,
            cache_hit=cache_hit,
        )
    else:
        _record_jsonl(
            subject=subject,
            topic_slug=topic_slug,
            user_message=user_message,
            history=history,
            spec_chunk_ids=spec_chunk_ids,
            response=response,
            provider=provider,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            input_cost_usd=input_cost_usd,
            output_cost_usd=output_cost_usd,
            cache_hit=cache_hit,
        )


def _record_postgres(*, database_url: str, **kwargs) -> None:
    import psycopg2
    import psycopg2.extras

    sql = """
        INSERT INTO ai_conversation_logs (
            subject, topic_slug, provider, model, cache_hit,
            input_tokens, output_tokens,
            input_cost_usd, output_cost_usd, total_cost_usd,
            spec_chunks_used, history_sent, user_message, response
        ) VALUES (
            %(subject)s, %(topic_slug)s, %(provider)s, %(model)s, %(cache_hit)s,
            %(input_tokens)s, %(output_tokens)s,
            %(input_cost_usd)s, %(output_cost_usd)s, %(total_cost_usd)s,
            %(spec_chunks_used)s, %(history_sent)s, %(user_message)s, %(response)s
        )
    """
    params = {
        "subject": kwargs["subject"],
        "topic_slug": kwargs["topic_slug"],
        "provider": kwargs["provider"],
        "model": kwargs["model"],
        "cache_hit": kwargs["cache_hit"],
        "input_tokens": kwargs["input_tokens"],
        "output_tokens": kwargs["output_tokens"],
        "input_cost_usd": round(kwargs["input_cost_usd"], 8),
        "output_cost_usd": round(kwargs["output_cost_usd"], 8),
        "total_cost_usd": round(kwargs["input_cost_usd"] + kwargs["output_cost_usd"], 8),
        "spec_chunks_used": psycopg2.extras.Json(kwargs["spec_chunk_ids"]),
        "history_sent": psycopg2.extras.Json(kwargs["history"]),
        "user_message": kwargs["user_message"],
        "response": kwargs["response"],
    }
    with psycopg2.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)


def _record_jsonl(*, subject, topic_slug, user_message, history, spec_chunk_ids,
                  response, provider, model, input_tokens, output_tokens,
                  input_cost_usd, output_cost_usd, cache_hit) -> None:
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "subject": subject,
        "topic_slug": topic_slug,
        "cache_hit": cache_hit,
        "provider": provider,
        "model": model,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "input_cost_usd": round(input_cost_usd, 8),
        "output_cost_usd": round(output_cost_usd, 8),
        "total_cost_usd": round(input_cost_usd + output_cost_usd, 8),
        "spec_chunks_used": spec_chunk_ids,
        "history_sent": history,
        "user_message": user_message,
        "response": response,
    }
    _FALLBACK_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _FALLBACK_LOG_PATH.open("a") as f:
        f.write(json.dumps(entry) + "\n")
