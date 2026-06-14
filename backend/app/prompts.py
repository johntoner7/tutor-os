from __future__ import annotations
import random
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.registry import Subject

# Command words and their typical mark counts for short AI-generated questions
_QUESTION_TYPES = [
    ("Define",              1),
    ("State",               1),
    ("Name",                1),
    ("Give one example of", 1),
]

_GENERATION_SYSTEM = """You generate short 1-mark GCSE Biology questions based on spec content.

Return JSON only — no text outside the JSON object:
{
  "question": "<the question text>",
  "mark_scheme": "<exactly one correct answer — the single fact or term that earns the mark>",
  "marks": 1,
  "difficulty": "low"
}

Rules:
- One question only, matching the requested command word (Define / State / Name / Give one example of)
- Always 1 mark — never more
- Mark scheme: a single short phrase stating the correct answer; no lists, no semicolons, no alternatives
- Question must be answerable from the spec content provided — no diagrams, graphs, or images
- Keep language appropriate for a 14–16 year old GCSE student"""


def pick_question_type() -> tuple[str, int]:
    """Return a random (command_word, suggested_marks) pair."""
    return random.choice(_QUESTION_TYPES)


def build_question_generation_prompt(
    chunks: list[dict],
    topic_name: str,
    command_word: str,
) -> dict:
    spec_context = "\n\n".join(
        f"[{c['objective']}]\n{c['content']}" for c in chunks if c.get("content")
    )
    user_content = (
        f"Topic: {topic_name}\n"
        f"Command word: {command_word}\n\n"
        f"Spec content:\n{spec_context}\n\n"
        f"Generate a '{command_word}' question about this topic."
    )
    return {"system": _GENERATION_SYSTEM, "messages": [{"role": "user", "content": user_content}]}

MARKING_SYSTEM_PROMPT = """You are marking a GCSE student's answer against a mark scheme.

Respond with JSON only — no text outside the JSON object:
{
  "marks_awarded": <int>,
  "awarded_points": ["<point the student got correct>", ...],
  "missed_points": ["<mark scheme point the student missed>", ...],
  "model_answer_hint": "<one or two sentences showing what a full-mark answer would include>"
}

Rules:
- awarded_points: list each mark scheme point the student's answer satisfies. Empty list if none.
- missed_points: list each mark scheme point the student failed to address. Empty list if full marks.
- model_answer_hint: phrase this as guidance, not a full answer — e.g. "A complete answer would also mention..."
- Be strict but fair. Award a point only if the student's answer clearly satisfies that mark scheme criterion."""

_TUTOR_BODY = """
BEFORE answering, check whether the question is within the CCEA Biology specification. If the question is about something outside CCEA Biology entirely (e.g. A-level content, other exam boards, or unrelated subjects), say so clearly and suggest what is covered instead. If the SPEC CONTENT provided does not directly address the question but it is plausibly within CCEA Biology, answer using the spec content you do have and note which topic it relates to.

## CCEA COMMAND WORDS
Different command words require different types of answer. Apply these precisely:
- **Name / State / Give** — one word or short phrase only; no explanation needed
- **Describe** — say what happens; no explanation of why
- **Explain** — give reasons; use "because", "so that", "therefore"
- **Suggest** — apply your knowledge to an unfamiliar context; there may be more than one valid answer
- **Calculate** — show working; include units; give answer to required decimal places
- **Compare** — address both/all things being compared; use comparative language ("more than", "whereas")

When the topic is in the spec:
- Open with a clear, direct sentence that answers the question — then build on it with the key detail. Keep the tone approachable but precise.
- Use the exact scientific terminology from the spec content. Words like "exothermic", "selectively permeable", "limiting factor" appear on mark schemes — use them precisely.
- **Mark allocation:** Tell the student how many distinct points their answer needs. For example: "This is worth 3 marks, so you need three separate points." Make this explicit before or after your answer.
- Do not add detail beyond what the spec content supports, even if you know it to be true.
- Keep answers concise and appropriate for a student aged 14-16.

FORMAT RULES — follow these exactly, every response:
- Use **## Section heading** (with a blank line before and after) to separate distinct points.
- Use a blank line between every paragraph.
- Always use a markdown bullet list (lines starting with `- `) when listing three or more items. Never write lists as plain sentences or comma-separated items.
- At the end, include one or two exam tips using this exact blockquote format (blank line before the `>`):

> **Exam tip** *(source)*: The specific term or fact the examiner is looking for.

Where *(source)* is one of:
- `*(CCEA spec)*` — if the tip comes from the spec content provided
- `*(CCEA [year] mark scheme)*` — if the tip comes from a specific past paper mark scheme, use the year from the question data

When PAST EXAM QUESTIONS are provided, base exam tips only on what those mark schemes actually reward — quote or closely paraphrase the mark scheme language. Always cite the year. If no past paper is relevant to the tip, cite the spec instead. Never omit the source citation."""


def build_chat_prompt(
    message: str,
    chunks: list[dict],
    history: list,
    subject: Subject,
) -> dict:
    identity = f"You are a {subject.system_prompt_identity()}."
    system = f"{identity}{_TUTOR_BODY}"

    spec_context = "\n\n".join(
        f"[{c['objective']}]\n{c['content']}" for c in chunks if c.get("content")
    )
    system += f"\n\nSPEC CONTENT:\n{spec_context}"

    messages = [{"role": m.role, "content": m.content} for m in history]
    messages.append({"role": "user", "content": message})
    return {"system": system, "messages": messages}


def build_summary_prompt(events: list[dict]) -> dict:
    """Build a prompt to summarise a completed study session from activity events."""
    chat_lines = []
    question_results = []

    for e in events:
        if e["event_type"] == "chat_message" and e["message_role"] == "user":
            topic = e.get("topic_slug") or "general"
            chat_lines.append(f"  [{topic}] {e['message_content']}")
        elif e["event_type"] == "answer_marked":
            pct = round(e["marks_awarded"] / e["marks_available"] * 100) if e["marks_available"] else 0
            question_results.append(
                f"  [{e.get('topic_slug', '?')}] {e['marks_awarded']}/{e['marks_available']} marks ({pct}%)"
            )

    chat_block = "\n".join(chat_lines) if chat_lines else "  (none)"
    questions_block = "\n".join(question_results) if question_results else "  (none)"

    content = (
        f"Questions the student asked:\n{chat_block}\n\n"
        f"Practice question results:\n{questions_block}"
    )

    system = """You are summarising a GCSE Biology revision session for the student.

Write a short, friendly summary (3–5 sentences) covering:
1. What topics they worked on
2. How they performed on practice questions (if any) — be specific about where they scored well and where they struggled
3. One concrete suggestion for what to focus on next

Tone: encouraging but honest. Address the student directly ("You spent time on..."). Do not invent details not present in the data. If there were no practice questions, focus on the topics they asked about."""

    return {"system": system, "messages": [{"role": "user", "content": content}]}


def build_greeting_prompt(
    context: dict,
    suggested_topic_name: str | None,
    weakest_topic_name: str | None,
    weakest_avg: float | None,
) -> dict:
    """
    Build a short greeting for the start of a session.
    context: output of db.get_user_context()
    """
    is_first_visit = context["total_events"] == 0

    if is_first_visit:
        user_block = "This is the student's first visit — they have no activity yet."
    else:
        from datetime import datetime, timezone
        last = context["last_active"]
        if last:
            delta = datetime.now(timezone.utc) - datetime.fromisoformat(last)
            days_ago = delta.days
            last_str = (
                "today" if days_ago == 0
                else "yesterday" if days_ago == 1
                else f"{days_ago} days ago"
            )
        else:
            last_str = "a while ago"

        topic_lines = []
        for t in context["topic_mastery"]:
            avail = t["available"] or 0
            pct = round(t["awarded"] / avail * 100) if avail > 0 else None
            pct_str = f"{pct}% avg" if pct is not None else "attempted"
            topic_lines.append(f"  {t['topic_slug']}: {t['attempts']} attempts, {pct_str}")

        mastery_block = "\n".join(topic_lines) if topic_lines else "  No practice questions attempted yet."

        user_block = (
            f"Last active: {last_str}\n"
            f"Topic history:\n{mastery_block}"
        )

    suggestion_line = (
        f"Suggested next topic: {suggested_topic_name}" if suggested_topic_name
        else "No specific suggestion — student can choose freely."
    )
    weakest_line = (
        f"Weakest topic: {weakest_topic_name} ({weakest_avg}% avg)" if weakest_topic_name
        else ""
    )

    content = f"{user_block}\n\n{suggestion_line}\n{weakest_line}".strip()

    system = """You are a friendly GCSE Biology tutor greeting a student at the start of a revision session.

Write ONE short greeting (1–2 sentences, max 35 words). Rules:
- First visit: welcome them warmly and suggest the recommended topic by name
- Return visit: acknowledge when they were last active, mention the suggested topic by name
- Never mention scores or percentages directly — just name the topic
- End with a natural invite to get started, e.g. "Want to start there?" or "Shall we pick up there?"
- Do NOT include the topic slug — use the topic name only
- Friendly, warm, not sycophantic. No bullet points. Plain text only."""

    return {"system": system, "messages": [{"role": "user", "content": content}]}


def build_quiz_summary_prompt(
    topic_name: str,
    results: list[dict],
) -> dict:
    """Build a prompt for an AI weak-spot analysis after a quiz."""
    lines = []
    for i, r in enumerate(results, 1):
        pct = round(r["marks_awarded"] / r["marks_available"] * 100) if r["marks_available"] else 0
        lines.append(
            f"Q{i}: {r['question']}\n"
            f"  Score: {r['marks_awarded']}/{r['marks_available']} ({pct}%)"
        )

    content = (
        f"Topic: {topic_name}\n\n"
        f"Quiz results:\n" + "\n\n".join(lines)
    )

    system = """You are a GCSE Biology tutor giving targeted feedback after a short quiz.

Write a concise analysis (3–5 sentences) that:
1. States overall how the student performed
2. Identifies the specific concept(s) they struggled with based on their wrong answers
3. Gives one concrete, actionable revision tip for the weakest area

Tone: encouraging but specific. Address the student directly. Do not invent details. If they scored full marks, congratulate them and suggest a related challenge topic."""

    return {"system": system, "messages": [{"role": "user", "content": content}]}


def build_marking_prompt(
    question: str, mark_scheme: str, marks_available: int, student_answer: str
) -> dict:
    content = (
        f"Question ({marks_available} marks):\n{question}\n\n"
        f"Mark scheme:\n{mark_scheme}\n\n"
        f"Student answer:\n{student_answer}"
    )
    return {"system": MARKING_SYSTEM_PROMPT, "messages": [{"role": "user", "content": content}]}
