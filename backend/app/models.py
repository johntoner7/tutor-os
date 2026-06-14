from pydantic import BaseModel, Field


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    subject: str = "biology"
    topic_slug: str | None = None
    history: list[Message] = Field(default=[], max_length=8)
    session_id: str | None = None


class ChatResponse(BaseModel):
    response: str
    sources: list[str]
    cache_hit: bool = False


class QuestionRequest(BaseModel):
    subject: str = "biology"
    topic_slug: str
    difficulty: str | None = None
    session_id: str | None = None


class QuestionResponse(BaseModel):
    question_id: str
    question: str
    marks: int
    year: int | None = None
    topic: str
    difficulty: str
    image_url: str | None = None
    is_generated: bool = False


class MarkRequest(BaseModel):
    student_answer: str = Field(min_length=1, max_length=2000)
    session_id: str | None = None


class MarkResponse(BaseModel):
    marks_awarded: int
    marks_available: int
    awarded_points: list[str]
    missed_points: list[str]
    model_answer_hint: str


class Topic(BaseModel):
    name: str
    slug: str
    unit: int


class TopicsResponse(BaseModel):
    topics: list[Topic]


class TopicMastery(BaseModel):
    topic_slug: str
    questions_attempted: int
    score_percent: float | None
    last_active: str


class MasteryResponse(BaseModel):
    session_id: str
    topics: list[TopicMastery]


class UserTopicMastery(BaseModel):
    topic_slug: str
    status: str  # 'green' | 'amber' | 'red' | 'untouched'
    questions_attempted: int
    avg_score_percent: float | None
    last_active: str | None


class UserMasteryResponse(BaseModel):
    topics: list[UserTopicMastery]


class SessionStartResponse(BaseModel):
    greeting: str
    suggested_topic_slug: str | None
    suggested_topic_name: str | None


class SessionSummary(BaseModel):
    session_id: str
    summary: str
    topics_covered: list[str]
    questions_attempted: int
    average_score_percent: float | None
