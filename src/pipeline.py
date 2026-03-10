import os
import tempfile
import requests
from pathlib import Path
from typing import List, Dict, Any
from urllib.parse import urlparse
from src.loader import DocumentLoader
from src.chunker import DocumentChunker
from src.summarizer import ContentSummarizer
from src.embedder import Embedder
from src.vector_store import VectorStore
from src.config import SUPPORTED_EXTENSIONS


class IngestionPipeline:

    def __init__(self):
        self.loader = DocumentLoader(data_dir=".")
        self.chunker = DocumentChunker()
        self.summarizer = ContentSummarizer()
        self.embedder = Embedder()
        self.vector_store = VectorStore()

    def ingest_from_url(self, url: str, book_name: str) -> Dict[str, Any]:
        print(f"Ingesting from URL: {url}")
        print(f"Book name (namespace): {book_name}")
        print("=" * 50)

        parsed = urlparse(url)
        url_path = parsed.path.split("?")[0]
        ext = Path(url_path).suffix.lower()
        if not ext or ext not in SUPPORTED_EXTENSIONS:
            ext = ".pdf"

        tmp_dir = tempfile.mkdtemp()
        tmp_file = os.path.join(tmp_dir, f"document{ext}")

        try:
            print(f"Downloading document...")
            response = requests.get(url, timeout=120)
            response.raise_for_status()
            with open(tmp_file, "wb") as f:
                f.write(response.content)
            print(f"Downloaded {len(response.content)} bytes")

            elements = self.loader.load_single(tmp_file)

            if not elements:
                return {"status": "error", "message": "No elements extracted from document"}

            chunks_data = self.chunker.process_all(elements)
            chunks_data = self.summarizer.summarize_all(chunks_data)

            texts_to_embed = [c["enhanced_text"] for c in chunks_data]
            print(f"Generating embeddings for {len(texts_to_embed)} chunks...")
            embeddings = self.embedder.embed_documents(texts_to_embed)

            self.vector_store.upsert_documents(embeddings, chunks_data, namespace=book_name)

            stats = {
                "status": "success",
                "book_name": book_name,
                "total_elements": len(elements),
                "total_chunks": len(chunks_data),
                "text_only": sum(1 for c in chunks_data if c["types"] == ["text"]),
                "with_tables": sum(1 for c in chunks_data if "table" in c["types"]),
                "with_images": sum(1 for c in chunks_data if "image" in c["types"]),
            }

            print(f"\nPipeline completed for book '{book_name}'!")
            print(f"   Elements: {stats['total_elements']}")
            print(f"   Chunks:   {stats['total_chunks']}")
            return stats

        finally:
            if os.path.exists(tmp_file):
                os.remove(tmp_file)
            if os.path.exists(tmp_dir):
                os.rmdir(tmp_dir)
