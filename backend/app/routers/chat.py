from fastapi import APIRouter, Depends, HTTPException, Request

from app.cache import ResponseCache
from app import conversation_logger, db
from app.config import settings
from app.llm import complete
from app.models import ChatRequest, ChatResponse
from app.prompts import build_chat_prompt
from app.registry import SubjectRegistry
from app.routers.auth import get_optional_user

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    req: Request,
    current_user: dict | None = Depends(get_optional_user),
) -> ChatResponse:
    user_id = current_user["sub"] if current_user else None
    registry: SubjectRegistry = req.app.state.registry
    subject = registry.get(request.subject)
    if subject is None:
        raise HTTPException(status_code=404, detail=f"Subject '{request.subject}' not found")

    cache: ResponseCache = req.app.state.cache

    cached = cache.get(request.subject, request.topic_slug, request.message)
    if cached:
        conversation_logger.record(
            subject=request.subject,
            topic_slug=request.topic_slug,
            user_message=request.message,
            history=[{"role": m.role, "content": m.content} for m in request.history[-8:]],
            spec_chunk_ids=[],
            response=cached,
            provider=settings.llm_provider,
            model=settings.llm_model,
            input_tokens=0,
            output_tokens=0,
            input_cost_usd=0.0,
            output_cost_usd=0.0,
            cache_hit=True,
        )
        return ChatResponse(response=cached, sources=[], cache_hit=True)

    # Retrieve spec chunks based on the actual question — no topic filter here so
    # the student can ask about any CCEA topic regardless of which one is active.
    # The active topic only controls practice question selection (below).
    chunks = subject.retriever.retrieve_spec_chunks(
        query=request.message,
        topic_slug=None,
        top_k=4,
    )
    print(f"[retrieval] query={request.message!r} topic={request.topic_slug} chunks={[c['id'] for c in chunks]}")

    prompt = build_chat_prompt(
        message=request.message,
        chunks=chunks,
        history=request.history[-8:],
        subject=subject,
    )

    text, usage = complete(
        system=prompt["system"],
        messages=prompt["messages"],
        max_tokens=1200,
        context="chat",
    )

    cache.set(request.subject, request.topic_slug, request.message, text)

    if request.session_id:
        db.log_chat_message(request.session_id, request.subject, request.topic_slug, "user", request.message, user_id)
        db.log_chat_message(request.session_id, request.subject, request.topic_slug, "assistant", text, user_id)

    conversation_logger.record(
        subject=request.subject,
        topic_slug=request.topic_slug,
        user_message=request.message,
        history=[{"role": m.role, "content": m.content} for m in request.history[-8:]],
        spec_chunk_ids=[c["id"] for c in chunks],
        response=text,
        provider=settings.llm_provider,
        model=settings.llm_model,
        input_tokens=usage["input_tokens"],
        output_tokens=usage["output_tokens"],
        input_cost_usd=usage["input_cost_usd"],
        output_cost_usd=usage["output_cost_usd"],
        cache_hit=False,
    )

    return ChatResponse(
        response=text,
        sources=[c["id"] for c in chunks],
        cache_hit=False,
    )
