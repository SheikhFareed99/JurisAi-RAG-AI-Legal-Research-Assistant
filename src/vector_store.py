import json
from typing import List, Dict, Any
from pinecone import Pinecone, ServerlessSpec
from src.config import (
    PINECONE_API_KEY,
    PINECONE_INDEX_NAME,
    PINECONE_CLOUD,
    PINECONE_REGION,
    EMBEDDING_DIMENSION,
)


class VectorStore:

    def __init__(self, index_name: str = PINECONE_INDEX_NAME):
        print("Connecting to Pinecone...")
        self.pc = Pinecone(api_key=PINECONE_API_KEY)
        self.index_name = index_name
        self._ensure_index()
        self.index = self.pc.Index(self.index_name)
        print(f"Connected to index: {self.index_name}")

    def _ensure_index(self):
        existing = [idx.name for idx in self.pc.list_indexes()]
        if self.index_name not in existing:
            print(f"Creating new index: {self.index_name}")
            self.pc.create_index(
                name=self.index_name,
                dimension=EMBEDDING_DIMENSION,
                metric="cosine",
                spec=ServerlessSpec(
                    cloud=PINECONE_CLOUD,
                    region=PINECONE_REGION,
                ),
            )
            print("Index created")
        else:
            print(f"Index '{self.index_name}' already exists")

    def upsert_documents(
        self,
        embeddings: List[List[float]],
        chunks_data: List[Dict[str, Any]],
        batch_size: int = 50,
        namespace: str = "",
    ):
        print(f"Upserting {len(embeddings)} vectors...")
        vectors = []

        for i, (emb, chunk) in enumerate(zip(embeddings, chunks_data)):
            metadata = {
                "text": chunk.get("enhanced_text", chunk["text"])[:3500],
                "raw_text": chunk["text"][:3500],
                "has_tables": len(chunk.get("tables", [])) > 0,
                "has_images": len(chunk.get("images", [])) > 0,
                "content_types": ",".join(chunk.get("types", ["text"])),
            }
            vectors.append((f"chunk-{i}", emb, metadata))

        for start in range(0, len(vectors), batch_size):
            batch = vectors[start : start + batch_size]
            self.index.upsert(vectors=batch, namespace=namespace)
            print(f"   Batch {start // batch_size + 1} ({len(batch)} vectors)")

        print("All vectors upserted")

    def search(
        self, query_embedding: List[float], top_k: int = 5, namespace: str = ""
    ) -> List[Dict[str, Any]]:
        results = self.index.query(
            vector=query_embedding,
            top_k=top_k,
            include_metadata=True,
            namespace=namespace,
        )

        documents = []
        for match in results.matches:
            doc = {
                "id": match.id,
                "score": match.score,
                "text": match.metadata.get("text", ""),
                "raw_text": match.metadata.get("raw_text", ""),
                "has_tables": match.metadata.get("has_tables", False),
                "has_images": match.metadata.get("has_images", False),
            }
            documents.append(doc)
        return documents

    def count_documents(self, namespace: str = "") -> int:
        stats = self.index.describe_index_stats()
        ns_stats = stats.namespaces.get(namespace, None)
        return ns_stats.vector_count if ns_stats else 0

    def fetch_all_texts(self, namespace: str = "") -> List[Dict[str, Any]]:
        documents = []
        try:
            for id_list in self.index.list(namespace=namespace):
                if not id_list:
                    continue
                fetched = self.index.fetch(ids=list(id_list), namespace=namespace)
                for vid, vec in fetched.vectors.items():
                    meta = vec.metadata or {}
                    text = meta.get("text", "")
                    if text:
                        documents.append({"id": vid, "text": text})
        except Exception as e:
            print(f"fetch_all_texts fallback: {e}")
        print(f"Fetched {len(documents)} texts for keyword search")
        return documents

    def delete_all(self):
        self.index.delete(delete_all=True)
        print("All vectors deleted")
