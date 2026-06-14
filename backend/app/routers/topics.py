from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from app.models import Topic, TopicsResponse
from app.registry import SubjectRegistry

router = APIRouter(tags=["topics"])


@router.get("/topics", response_model=TopicsResponse)
async def get_topics(req: Request, response: Response, subject: str = "biology") -> TopicsResponse:
    registry: SubjectRegistry = req.app.state.registry
    subj = registry.get(subject)
    if subj is None:
        raise HTTPException(status_code=404, detail=f"Subject '{subject}' not found")
    response.headers["Cache-Control"] = "public, max-age=86400"
    return TopicsResponse(topics=[Topic(**t) for t in subj.topics])
