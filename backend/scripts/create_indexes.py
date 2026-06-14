"""
Phase 2.1 — Create Pinecone indexes with integrated inference.

Run once before embedding. Safe to re-run — skips indexes that already exist.

Usage:
    cd backend
    uv run python scripts/create_indexes.py
"""

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

INDEXES = [
    {
        "name": "biology-spec",
        "description": "CCEA Biology specification chunks",
    },
    {
        "name": "biology-questions",
        "description": "CCEA Biology past paper questions",
    },
]

EMBED_CONFIG = {
    "model": "llama-text-embed-v2",
    "field_map": {"text": "chunk_text"},
}

CLOUD = "aws"
REGION = "us-east-1"


def log_carbon_intensity() -> None:
    try:
        r = httpx.get("https://api.carbonintensity.org.uk/intensity", timeout=3)
        intensity = r.json()["data"][0]["intensity"]["actual"]
        if intensity and intensity > 250:
            print(
                f"Warning: grid carbon intensity is {intensity}gCO2eq/kWh. "
                "Consider deferring to off-peak hours."
            )
        else:
            print(f"Grid carbon intensity: {intensity}gCO2eq/kWh — proceeding.")
    except Exception:
        print("Could not retrieve carbon intensity data — proceeding anyway.")


def main() -> None:
    api_key = os.environ.get("PINECONE_API_KEY")
    if not api_key:
        print("Error: PINECONE_API_KEY environment variable not set.")
        sys.exit(1)

    log_carbon_intensity()

    pc = Pinecone(api_key=api_key)

    for index_cfg in INDEXES:
        name = index_cfg["name"]
        if pc.has_index(name):
            print(f"Index '{name}' already exists — skipping.")
            info = pc.describe_index(name)
            print(f"  Status: {info.status.state}")
        else:
            print(f"Creating index '{name}'...")
            pc.create_index_for_model(
                name=name,
                cloud=CLOUD,
                region=REGION,
                embed=EMBED_CONFIG,
            )
            print(f"  Created. Model: {EMBED_CONFIG['model']}, Cloud: {CLOUD}/{REGION}")

    print("\nDone. Both indexes ready.")
    print("Next step: run scripts/embed_and_index.py to populate them.")


if __name__ == "__main__":
    main()
