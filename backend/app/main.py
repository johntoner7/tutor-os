from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.cache import ResponseCache
from app.config import settings
from app import db
from app.registry import SubjectRegistry
from app.routers import auth, chat, glossary, mastery, questions, session, topics

DATA_DIR = Path(__file__).parent.parent / "data"


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    registry = SubjectRegistry()
    registry.load_all(DATA_DIR, pinecone_api_key=settings.pinecone_api_key)
    app.state.registry = registry
    app.state.cache = ResponseCache(maxsize=settings.cache_max_size)
    print(f"Started with {registry.subject_count()} subject(s): {registry.all_subject_ids()}")
    yield


app = FastAPI(title="Tutor OS API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = Path(__file__).parent.parent / "static"
STATIC_DIR.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

app.include_router(auth.router)
app.include_router(mastery.router)
app.include_router(chat.router)
app.include_router(questions.router)
app.include_router(topics.router)
app.include_router(glossary.router)
app.include_router(session.router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/subjects")
async def get_subjects(req: Request) -> list[str]:
    registry: SubjectRegistry = req.app.state.registry
    return registry.all_subject_ids()
