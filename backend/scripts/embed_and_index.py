"""
Phase 2.2 — Embed and index all spec chunks and past paper questions.

Idempotent: fetches existing IDs from each index before upserting,
skips any chunk already present. Re-running never triggers redundant
inference calls.

Usage:
    cd backend
    uv run python scripts/embed_and_index.py
"""

import json
import os
import sys
from pathlib import Path

import httpx
from pinecone import Pinecone


def _load_dotenv() -> None:
    env_file = Path(__file__).parent.parent / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


_load_dotenv()

BASE_DATA_DIR = Path(__file__).parent.parent / "data"
BATCH_SIZE = 96  # Pinecone integrated inference limit
NAMESPACE = "default"


def log_carbon_intensity() -> None:
    try:
        r = httpx.get("https://api.carbonintensity.org.uk/intensity", timeout=3)
        intensity = r.json()["data"][0]["intensity"]["actual"]
        if intensity and intensity > 250:
            print(
                f"Warning: grid carbon intensity is {intensity}gCO2eq/kWh. "
                "Consider deferring this job to off-peak hours."
            )
        else:
            print(f"Grid carbon intensity: {intensity}gCO2eq/kWh — proceeding.")
    except Exception:
        print("Could not retrieve carbon intensity data — proceeding anyway.")


def load_and_validate(spec_chunks: list, question_chunks: list, topic_slugs: set) -> None:
    bad = [c["id"] for c in spec_chunks if c["topic_slug"] not in topic_slugs]
    bad += [q["id"] for q in question_chunks if q["topic_slug"] not in topic_slugs]
    if bad:
        print(f"Error: unknown topic_slug in chunks: {bad}")
        sys.exit(1)


def fetch_existing_ids(index, namespace: str) -> set[str]:
    """List all vector IDs currently in the index namespace."""
    existing = set()
    try:
        for ids in index.list(namespace=namespace):
            existing.update(ids)
    except Exception as e:
        print(f"  Warning: could not list existing IDs ({e}). Will upsert all.")
    return existing


def upsert_in_batches(index, records: list[dict], namespace: str, label: str) -> int:
    upserted = 0
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i : i + BATCH_SIZE]
        index.upsert_records(records=batch, namespace=namespace)
        upserted += len(batch)
        print(f"  {label}: upserted {upserted}/{len(records)}")
    return upserted


def build_spec_record(chunk: dict) -> dict:
    return {
        "_id": chunk["id"],
        "chunk_text": chunk["content"],
        # metadata fields stored alongside for retrieval
        "id": chunk["id"],
        "unit": chunk["unit"],
        "unit_number": chunk["unit_number"],
        "topic": chunk["topic"],
        "topic_slug": chunk["topic_slug"],
        "objective": chunk["objective"],
        "content": chunk["content"],
        "keywords": ", ".join(chunk.get("keywords", [])),
        "word_count": chunk["word_count"],
        "chunk_type": "spec",
    }


def build_question_record(q: dict) -> dict:
    return {
        "_id": q["id"],
        "chunk_text": q["question"],
        # metadata fields stored alongside for retrieval
        "id": q["id"],
        "year": q["year"],
        "unit": q["unit"],
        "unit_number": q["unit_number"],
        "topic": q["topic"],
        "topic_slug": q["topic_slug"],
        "question": q["question"],
        "marks": q["marks"],
        "difficulty": q["difficulty"],
        "mark_scheme": q["mark_scheme"],
        "chunk_type": "question",
    }


def main() -> None:
    api_key = os.environ.get("PINECONE_API_KEY")
    if not api_key:
        print("Error: PINECONE_API_KEY environment variable not set.")
        sys.exit(1)

    log_carbon_intensity()
    print()

    # Discover all subject directories
    subject_dirs = sorted(
        d for d in BASE_DATA_DIR.iterdir()
        if d.is_dir() and (d / "subject_config.json").exists()
    )
    if not subject_dirs:
        print("Error: no subject directories found under data/. Each subject needs a subject_config.json.")
        sys.exit(1)

    pc = Pinecone(api_key=api_key)

    for subject_dir in subject_dirs:
        cfg = json.loads((subject_dir / "subject_config.json").read_text())
        subject_id = cfg["subject_id"]
        print(f"\n{'='*50}")
        print(f"Subject: {subject_id}")
        print(f"{'='*50}")

        with open(subject_dir / "topics.json") as f:
            topics = json.load(f)
        with open(subject_dir / "spec_chunks.json") as f:
            spec_chunks = json.load(f)
        with open(subject_dir / "question_chunks.json") as f:
            question_chunks = json.load(f)

        topic_slugs = {t["slug"] for t in topics["topics"]}
        load_and_validate(spec_chunks, question_chunks, topic_slugs)
        print(f"Loaded {len(spec_chunks)} spec chunks, {len(question_chunks)} question chunks.")

        # --- spec index ---
        spec_index_name = cfg["spec_index"]
        print(f"\n--- {spec_index_name} ---")
        spec_index = pc.Index(spec_index_name)

        existing_spec = fetch_existing_ids(spec_index, NAMESPACE)
        print(f"  Already indexed: {len(existing_spec)}")

        new_spec_records = [
            build_spec_record(c) for c in spec_chunks if c["id"] not in existing_spec
        ]
        print(f"  To upsert: {len(new_spec_records)}")

        if new_spec_records:
            upsert_in_batches(spec_index, new_spec_records, NAMESPACE, spec_index_name)
        else:
            print("  Nothing to do — all spec chunks already indexed.")

        # --- questions index ---
        questions_index_name = cfg["questions_index"]
        print(f"\n--- {questions_index_name} ---")
        questions_index = pc.Index(questions_index_name)

        existing_questions = fetch_existing_ids(questions_index, NAMESPACE)
        print(f"  Already indexed: {len(existing_questions)}")

        new_question_records = [
            build_question_record(q) for q in question_chunks if q["id"] not in existing_questions
        ]
        print(f"  To upsert: {len(new_question_records)}")

        if new_question_records:
            upsert_in_batches(questions_index, new_question_records, NAMESPACE, questions_index_name)
        else:
            print("  Nothing to do — all question chunks already indexed.")
    print()

    print("Done.")
    print(
        f"Spec: {len(existing_spec)} pre-existing + {len(new_spec_records)} new "
        f"= {len(existing_spec) + len(new_spec_records)} total"
    )
    print(
        f"Questions: {len(existing_questions)} pre-existing + {len(new_question_records)} new "
        f"= {len(existing_questions) + len(new_question_records)} total"
    )


if __name__ == "__main__":
    main()
