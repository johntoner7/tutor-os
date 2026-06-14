"""
Thin LLM abstraction. Switch providers via LLM_PROVIDER in .env:
  LLM_PROVIDER=anthropic  LLM_MODEL=claude-haiku-4-5-20251001
  LLM_PROVIDER=deepseek   LLM_MODEL=deepseek-chat  DEEPSEEK_API_KEY=...

Both providers accept the same call signature:
  complete(system, messages, max_tokens, context="") -> (text, usage)

where usage = {"input_tokens": int, "output_tokens": int, "input_cost_usd": float, "output_cost_usd": float}

Every call is logged to logs/costs.jsonl via app.cost_tracker.
"""

import json
from typing import TypedDict

import anthropic
import httpx

from app.config import settings
from app import cost_tracker

_anthropic_client: anthropic.Anthropic | None = None


class Usage(TypedDict):
    input_tokens: int
    output_tokens: int
    input_cost_usd: float
    output_cost_usd: float


def _get_anthropic() -> anthropic.Anthropic:
    global _anthropic_client
    if _anthropic_client is None:
        _anthropic_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return _anthropic_client


def _complete_anthropic(system: str, messages: list[dict], max_tokens: int, context: str) -> tuple[str, Usage]:
    client = _get_anthropic()
    response = client.messages.create(
        model=settings.llm_model,
        max_tokens=max_tokens,
        system=system,
        messages=messages,
    )
    in_tok = response.usage.input_tokens
    out_tok = response.usage.output_tokens
    cost_tracker.record(
        provider="anthropic",
        model=settings.llm_model,
        input_tokens=in_tok,
        output_tokens=out_tok,
        context=context,
    )
    in_cost, out_cost = cost_tracker._cost(settings.llm_model, in_tok, out_tok)
    return response.content[0].text, Usage(
        input_tokens=in_tok,
        output_tokens=out_tok,
        input_cost_usd=in_cost,
        output_cost_usd=out_cost,
    )


def _complete_deepseek(system: str, messages: list[dict], max_tokens: int, context: str) -> tuple[str, Usage]:
    openai_messages = [{"role": "system", "content": system}, *messages]
    with httpx.Client(timeout=30) as client:
        r = client.post(
            f"{settings.deepseek_base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.deepseek_api_key}",
                "Content-Type": "application/json",
            },
            content=json.dumps(
                {
                    "model": settings.llm_model,
                    "messages": openai_messages,
                    "max_tokens": max_tokens,
                }
            ),
        )
        r.raise_for_status()
        data = r.json()
        usage = data.get("usage", {})
        in_tok = usage.get("prompt_tokens", 0)
        out_tok = usage.get("completion_tokens", 0)
        cost_tracker.record(
            provider="deepseek",
            model=settings.llm_model,
            input_tokens=in_tok,
            output_tokens=out_tok,
            context=context,
        )
        in_cost, out_cost = cost_tracker._cost(settings.llm_model, in_tok, out_tok)
        return data["choices"][0]["message"]["content"], Usage(
            input_tokens=in_tok,
            output_tokens=out_tok,
            input_cost_usd=in_cost,
            output_cost_usd=out_cost,
        )


def complete(system: str, messages: list[dict], max_tokens: int, context: str = "") -> tuple[str, Usage]:
    """Call the configured LLM provider and return (response_text, usage)."""
    if settings.llm_provider == "anthropic":
        return _complete_anthropic(system, messages, max_tokens, context)
    if settings.llm_provider == "deepseek":
        return _complete_deepseek(system, messages, max_tokens, context)
    raise ValueError(f"Unknown LLM provider: {settings.llm_provider}")
