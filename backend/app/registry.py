"""
Loads all subjects from data/{subject_id}/ at startup.

Each subject directory must contain:
  subject_config.json  — identity + Pinecone index names
  topics.json          — topic list
  question_chunks.json — past paper questions
  glossary.json        — glossary terms

spec_chunks.json is not loaded here — spec content is retrieved live from
Pinecone. question_chunks are loaded for O(1) topic-slug lookup at chat time.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path

from pinecone import Pinecone

from app.retrieval import SpecRetriever


@dataclass
class Subject:
    subject_id: str
    subject_name: str
    subject_spec: str
    subject_grade: str
    retriever: SpecRetriever
    topics: list[dict]
    glossary: list[dict]

    def system_prompt_identity(self) -> str:
        return f"{self.subject_grade} {self.subject_name} tutor for the {self.subject_spec} specification"


class SubjectRegistry:
    def __init__(self) -> None:
        self._subjects: dict[str, Subject] = {}

    def load_all(self, data_dir: Path, pinecone_api_key: str) -> None:
        pc = Pinecone(api_key=pinecone_api_key)
        for subject_dir in sorted(data_dir.iterdir()):
            config_file = subject_dir / "subject_config.json"
            if not subject_dir.is_dir() or not config_file.exists():
                continue
            cfg = json.loads(config_file.read_text())
            subject_id = cfg["subject_id"]

            retriever = SpecRetriever(
                pinecone_client=pc,
                spec_index_name=cfg["spec_index"],
                subject_grade=cfg["subject_grade"],
                subject_name=cfg["subject_name"],
            )

            with open(subject_dir / "topics.json") as f:
                topics = json.load(f)["topics"]

            with open(subject_dir / "glossary.json") as f:
                glossary = json.load(f)

            self._subjects[subject_id] = Subject(
                subject_id=subject_id,
                subject_name=cfg["subject_name"],
                subject_spec=cfg["subject_spec"],
                subject_grade=cfg["subject_grade"],
                retriever=retriever,
                topics=topics,
                glossary=glossary,
            )
            print(f"  Loaded subject: {subject_id} ({len(topics)} topics)")

    def get(self, subject_id: str) -> Subject | None:
        return self._subjects.get(subject_id)

    def all_subject_ids(self) -> list[str]:
        return list(self._subjects.keys())

    def subject_count(self) -> int:
        return len(self._subjects)
