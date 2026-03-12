from typing import List
import requests
from src.config import OPENROUTER_API_KEY, OPENROUTER_MODEL


class ContentSummarizer:

    def __init__(self):
        self.api_key = OPENROUTER_API_KEY
        self.model = OPENROUTER_MODEL

    def _summarize(self, text: str, tables: List[str], images: List[str]) -> str:
        prompt = f"""You are creating a searchable description for document content retrieval.

CONTENT TO ANALYZE:

TEXT:
{text}
"""
        if tables:
            prompt += "\nTABLES:\n"
            for i, table in enumerate(tables):
                prompt += f"Table {i + 1}:\n{table}\n\n"

        if images:
            prompt += "\nIMAGE OCR TEXT:\n"
            for i, img_text in enumerate(images):
                prompt += f"Image {i + 1}:\n{img_text}\n\n"

        prompt += """
YOUR TASK:
Generate a comprehensive, searchable description that covers:
1. Key facts, numbers, and data points from text and tables
2. Main topics and concepts discussed
3. Questions this content could answer
4. Alternative search terms users might use

Make it detailed and searchable — prioritize findability over brevity.

SEARCHABLE DESCRIPTION:"""
        try:
            if not self.api_key:
                raise RuntimeError("OPENROUTER_API_KEY is not configured for summarizer.")

            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0,
                "max_tokens": 1024,
            }
            resp = requests.post("https://openrouter.ai/api/v1/chat/completions", json=payload, headers=headers, timeout=60)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"[OPENROUTER][SUMMARY] FAILED. type={type(e)}, detail={repr(e)}")
            raise

    def summarize_chunk(self, chunk_data: dict) -> str:
        text = chunk_data["text"]
        tables = chunk_data.get("tables", [])
        images = chunk_data.get("images", [])

        if not tables and not images:
            return text

        try:
            summary = self._summarize(text, tables, images)
            has = []
            if tables:
                has.append(f"{len(tables)} table(s)")
            if images:
                has.append(f"{len(images)} image(s)")
            print(f"     AI summary created ({', '.join(has)})")
            return summary
        except Exception as e:
            print(f"     AI summary failed ({e}), using fallback")
            fallback = text[:500]
            if tables:
                fallback += f" [Contains {len(tables)} table(s)]"
            if images:
                fallback += f" [Contains {len(images)} image(s)]"
            return fallback

    def summarize_all(self, chunks_data: List[dict]) -> List[dict]:
        print("Generating AI summaries for mixed-content chunks...")
        total = len(chunks_data)

        for i, chunk in enumerate(chunks_data):
            print(f"   Chunk {i + 1}/{total}  types={chunk['types']}")
            chunk["enhanced_text"] = self.summarize_chunk(chunk)

        text_only = sum(1 for c in chunks_data if c["types"] == ["text"])
        mixed = total - text_only
        print(f"Summaries done -- {text_only} text-only, {mixed} AI-enhanced")
        return chunks_data
