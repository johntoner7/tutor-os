import os

from app.repo.base import Repository


def get_repo() -> Repository:
    database_url = os.environ.get("DATABASE_URL")
    print(f"Using DATABASE_URL: {database_url}")  # Debugging line
    if database_url:
        from app.repo.postgres import PostgresRepository
        return PostgresRepository(database_url)
    from app.repo.sqlite import SQLiteRepository
    return SQLiteRepository()
