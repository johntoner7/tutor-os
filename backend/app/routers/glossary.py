from fastapi import APIRouter, HTTPException, Request

from app.registry import SubjectRegistry

router = APIRouter(tags=["glossary"])


@router.get("/glossary")
def get_glossary(req: Request, subject: str = "biology") -> list[dict]:
    registry: SubjectRegistry = req.app.state.registry
    subj = registry.get(subject)
    if subj is None:
        raise HTTPException(status_code=404, detail=f"Subject '{subject}' not found")
    return subj.glossary
