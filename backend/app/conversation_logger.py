"""
Append-only log of every chat turn — what was sent and what came back.

Records are written to logs/conversations.jsonl (one JSON object per line).
Each record includes the full message history sent to the API, the response,
the spec chunks used for retrieval, and token cost data.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

_LOG_PATH = Path(__file__).parent.parent / "logs" / "conversations.jsonl"


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
    _LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _LOG_PATH.open("a") as f:
        f.write(json.dumps(entry) + "\n")
