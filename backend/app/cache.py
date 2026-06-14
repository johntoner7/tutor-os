import hashlib
import re


class ResponseCache:
    """
    In-memory LRU cache for chat responses.

    Cache key is a hash of (topic_slug, normalised_message). Normalisation
    strips punctuation, lowercases, and collapses whitespace so that
    "What is osmosis?", "what is osmosis" and "WHAT IS OSMOSIS" all hit
    the same cache entry.

    Cache is per-process and does not persist across restarts. For a
    curriculum tool where students repeatedly ask the same questions, a
    20-40% hit rate is realistic — each hit costs zero GPU energy, zero
    Pinecone inference, and zero Claude tokens.

    Max 500 entries; LRU eviction on overflow.
    """

    def __init__(self, maxsize: int = 500) -> None:
        self._cache: dict[str, str] = {}
        self._order: list[str] = []
        self._maxsize = maxsize
        self.hits = 0
        self.misses = 0

    def _normalise(self, text: str) -> str:
        return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", "", text.lower())).strip()

    def _key(self, subject: str, topic_slug: str | None, message: str) -> str:
        normalised = f"{subject}:{topic_slug or ''}:{self._normalise(message)}"
        return hashlib.sha256(normalised.encode()).hexdigest()[:16]

    def get(self, subject: str, topic_slug: str | None, message: str) -> str | None:
        key = self._key(subject, topic_slug, message)
        value = self._cache.get(key)
        if value is not None:
            self.hits += 1
            # Move to end (most recently used)
            if key in self._order:
                self._order.remove(key)
                self._order.append(key)
        else:
            self.misses += 1
        return value

    def set(self, subject: str, topic_slug: str | None, message: str, response: str) -> None:
        key = self._key(subject, topic_slug, message)
        if key not in self._cache:
            if len(self._order) >= self._maxsize:
                oldest = self._order.pop(0)
                self._cache.pop(oldest, None)
            self._order.append(key)
        self._cache[key] = response

    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0

    @property
    def size(self) -> int:
        return len(self._cache)
