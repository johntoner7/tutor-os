"""
Append-only cost log for every LLM invocation.

Records are written to logs/costs.jsonl (one JSON object per line).
The file is created automatically if it doesn't exist.

Pricing table (USD per million tokens, as of 2026-06):
  Anthropic claude-haiku-4-5*  : $1.00 in / $5.00 out
  Anthropic claude-sonnet-4-6  : $3.00 in / $15.00 out
  Anthropic claude-opus-4-8    : $5.00 in / $25.00 out
  DeepSeek deepseek-chat (V3)  : $0.27 in / $1.10 out
  DeepSeek deepseek-reasoner   : $0.55 in / $2.19 out

Unknown models are logged with cost 0 so records are never dropped.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

_LOG_PATH = Path(__file__).parent.parent / "logs" / "costs.jsonl"

# USD per million tokens
_PRICING: dict[str, tuple[float, float]] = {
    "claude-haiku-4-5-20251001": (1.00, 5.00),
    "claude-haiku-4-5":          (1.00, 5.00),
    "claude-sonnet-4-6":         (3.00, 15.00),
    "claude-opus-4-8":           (5.00, 25.00),
    "deepseek-chat":             (0.27, 1.10),
    "deepseek-reasoner":         (0.55, 2.19),
}


def _cost(model: str, input_tokens: int, output_tokens: int) -> tuple[float, float]:
    price_in, price_out = _PRICING.get(model, (0.0, 0.0))
    return (input_tokens * price_in / 1_000_000, output_tokens * price_out / 1_000_000)


def record(
    *,
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    context: str = "",
) -> None:
    """Write one cost record to logs/costs.jsonl."""
    input_cost, output_cost = _cost(model, input_tokens, output_tokens)
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "provider": provider,
        "model": model,
        "context": context,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "input_cost_usd": round(input_cost, 8),
        "output_cost_usd": round(output_cost, 8),
        "total_cost_usd": round(input_cost + output_cost, 8),
    }
    _LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _LOG_PATH.open("a") as f:
        f.write(json.dumps(entry) + "\n")
