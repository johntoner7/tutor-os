from pinecone import Pinecone

NAMESPACE = "default"


class SpecRetriever:
    """
    Encapsulates all Pinecone retrieval for one subject.
    Initialised once per subject at application startup via SubjectRegistry.
    Accepts a shared Pinecone client so all subjects share one connection pool.
    """

    def __init__(
        self,
        pinecone_client: Pinecone,
        spec_index_name: str,
        subject_grade: str,
        subject_name: str,
    ) -> None:
        self.spec_index = pinecone_client.Index(spec_index_name)
        self._subject_grade = subject_grade
        self._subject_name = subject_name

    def retrieve_spec_chunks(
        self,
        query: str,
        topic_slug: str | None = None,
        top_k: int = 3,
    ) -> list[dict]:
        query_params: dict = {"top_k": top_k, "inputs": {"text": query}}
        if topic_slug:
            query_params["filter"] = {"topic_slug": {"$eq": topic_slug}}
        results = self.spec_index.search(namespace=NAMESPACE, query=query_params)
        return [{"id": hit["id"], **hit["fields"]} for hit in results["result"]["hits"]]

