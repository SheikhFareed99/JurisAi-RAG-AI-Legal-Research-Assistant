from typing import List, Dict, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter
from src.config import CHUNK_MAX_CHARS, CHUNK_NEW_AFTER, CHUNK_COMBINE_UNDER


class DocumentChunker:

    def __init__(self, max_chars: int = CHUNK_MAX_CHARS, overlap: int = 200):
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=max_chars,
            chunk_overlap=overlap,
            separators=["\n\n", "\n", ". ", " ", ""],
        )

    def chunk(self, elements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        print("Creating chunks...")
        chunks = []
        text_parts = []
        tables = []
        images = []

        for el in elements:
            if el["type"] == "table":
                tables.append(el["content"])
            elif el["type"] == "image":
                images.append(el["content"])
            else:
                text_parts.append(el["content"])

        full_text = "\n\n".join(text_parts)
        if full_text.strip():
            text_chunks = self.splitter.split_text(full_text)
        else:
            text_chunks = []

        for text in text_chunks:
            chunks.append({
                "text": text,
                "tables": [],
                "images": [],
                "types": ["text"],
            })

        for table in tables:
            chunks.append({
                "text": table,
                "tables": [table],
                "images": [],
                "types": ["text", "table"],
            })

        for img_text in images:
            chunks.append({
                "text": img_text,
                "tables": [],
                "images": [img_text],
                "types": ["text", "image"],
            })

        print(f"Created {len(chunks)} chunks")
        print(f"   Text: {len(text_chunks)}, Tables: {len(tables)}, Images: {len(images)}")
        return chunks

    def process_all(self, elements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return self.chunk(elements)
