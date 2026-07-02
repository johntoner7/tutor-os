"""
Loads all subjects from data/{subject_id}/ at startup.

Each subject directory must contain:
  subject_config.json  — identity + Pinecone index names
  topics.json          — topic list
  question_chunks.json — past paper questions
  glossary.json        — glossary terms
  spec_chunks.json     — spec objectives (content is retrieved live from
                          Pinecone at question/chat time; loaded here only
                          to build the objective-id inventory per topic,
                          used for spec-coverage tracking)
"""

import json
from collections import defaultdict
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
    objectives_by_topic: dict[str, list[str]] = field(default_factory=dict)

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

            objectives_by_topic: dict[str, list[str]] = defaultdict(list)
            spec_chunks_file = subject_dir / "spec_chunks.json"
            if spec_chunks_file.exists():
                with open(spec_chunks_file) as f:
                    for chunk in json.load(f):
                        objectives_by_topic[chunk["topic_slug"]].append(chunk["id"])

            self._subjects[subject_id] = Subject(
                subject_id=subject_id,
                subject_name=cfg["subject_name"],
                subject_spec=cfg["subject_spec"],
                subject_grade=cfg["subject_grade"],
                retriever=retriever,
                topics=topics,
                glossary=glossary,
                objectives_by_topic=dict(objectives_by_topic),
            )
            print(f"  Loaded subject: {subject_id} ({len(topics)} topics, {len(objectives_by_topic)} topics with spec objectives)")

    def get(self, subject_id: str) -> Subject | None:
        return self._subjects.get(subject_id)

    def all_subject_ids(self) -> list[str]:
        return list(self._subjects.keys())

    def subject_count(self) -> int:
        return len(self._subjects)
