import re
from typing import List, Dict, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter
from src.config import CHUNK_MAX_CHARS, CHUNK_NEW_AFTER, CHUNK_COMBINE_UNDER


_TITLE_PATTERNS = re.compile(
    r'^(?:'
    r'(?:ARTICLE|SECTION|CHAPTER|PART|TITLE|SCHEDULE|ANNEXURE|APPENDIX|EXHIBIT|CLAUSE|RECITAL)'
    r'\s*[IVXLCDM0-9]+'
    r'|\d+\.\d*\s+[A-Z]'
    r'|[A-Z][A-Z\s]{4,}$'
    r')',
    re.MULTILINE,
)


class DocumentChunker:

    def __init__(self, max_chars: int = CHUNK_MAX_CHARS, overlap: int = 300):
        self.max_chars = max_chars
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=max_chars,
            chunk_overlap=overlap,
            separators=["\n\n", "\n", ". ", " ", ""],
        )

    def _split_by_titles(self, text: str) -> List[str]:
        positions = [m.start() for m in _TITLE_PATTERNS.finditer(text)]
        if len(positions) < 2:
            return []

        sections: List[str] = []
        for idx, start in enumerate(positions):
            end = positions[idx + 1] if idx + 1 < len(positions) else len(text)
            section = text[start:end].strip()
            if section:
                sections.append(section)

        result: List[str] = []
        for sec in sections:
            if len(sec) <= self.max_chars:
                result.append(sec)
            else:
                result.extend(self.splitter.split_text(sec))
        return result

    def chunk(self, elements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        print("Creating chunks...")
        chunks = []
        text_parts = []
        tables = []
        images = []

        for el in elements:
            page = el.get("metadata", {}).get("page", None)
            if el["type"] == "table":
                tables.append((el["content"], page))
            elif el["type"] == "image":
                images.append((el["content"], page))
            else:
                text_parts.append((el["content"], page))

        full_text = ""
        offset_page_map = []
        for content, page in text_parts:
            start = len(full_text)
            if full_text:
                full_text += "\n\n"
                start = len(full_text)
            full_text += content
            end = len(full_text)
            offset_page_map.append((start, end, page))

        def _find_page(chunk_text: str) -> int:
            pos = full_text.find(chunk_text[:100])
            if pos == -1:
                pos = full_text.find(chunk_text[:50])
            if pos == -1:
                return None
            for start, end, page in offset_page_map:
                if start <= pos < end:
                    return page
            return None

        text_chunks = []
        if full_text.strip():
            text_chunks = self._split_by_titles(full_text)
            if not text_chunks:
                text_chunks = self.splitter.split_text(full_text)

        for text in text_chunks:
            chunks.append({
                "text": text,
                "tables": [],
                "images": [],
                "types": ["text"],
                "page": _find_page(text),
            })

        for table, page in tables:
            chunks.append({
                "text": table,
                "tables": [table],
                "images": [],
                "types": ["text", "table"],
                "page": page,
            })

        for img_text, page in images:
            chunks.append({
                "text": img_text,
                "tables": [],
                "images": [img_text],
                "types": ["text", "image"],
                "page": page,
            })

        print(f"Created {len(chunks)} chunks")
        print(
            f"Text: {len(text_chunks)}, Tables: {len(tables)}, Images: {len(images)}")
        return chunks

    def process_all(self, elements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return self.chunk(elements)
