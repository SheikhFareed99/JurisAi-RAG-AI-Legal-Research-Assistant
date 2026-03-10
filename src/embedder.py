from typing import List
from sentence_transformers import SentenceTransformer
from src.config import EMBEDDING_MODEL_NAME, EMBEDDING_DIMENSION


class Embedder:

    def __init__(self, model_name: str = EMBEDDING_MODEL_NAME):
        print(f"Loading embedding model: {model_name}")
        self.model = SentenceTransformer(model_name)
        self.dimension = EMBEDDING_DIMENSION
        print(f"Embedding model ready (dim={self.dimension})")

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        embeddings = self.model.encode(texts, show_progress_bar=True)
        return embeddings.tolist()

    def embed_query(self, query: str) -> List[float]:
        embedding = self.model.encode(query)
        return embedding.tolist()
