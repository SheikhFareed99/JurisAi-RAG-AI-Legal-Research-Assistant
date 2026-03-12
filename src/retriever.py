import re
import math
from typing import List, Dict, Any
from collections import defaultdict
from rank_bm25 import BM25Okapi
from sentence_transformers import CrossEncoder
from groq import Groq
from google import genai
from src.config import (
    GROQ_API_KEY,
    GROQ_MODEL,
    GOOGLE_API_KEY_1,
    GOOGLE_API_KEY_2,
    GOOGLE_MODEL,
    RERANKER_MODEL,
    KEYWORD_WEIGHT,
    SEMANTIC_WEIGHT,
    RRF_K,
    RETRIEVER_INITIAL_TOP_K,
    RERANKER_TOP_K,
    BM25_MAX_CHUNKS,
)
from src.embedder import Embedder
from src.vector_store import VectorStore


SYSTEM_PROMPT = """You are JurissAi, a strict legal research AI. You answer questions exclusively from the legal documents provided to you.

ABSOLUTE RULES — violating any of these is unacceptable:

1. You ONLY use information present in the provided documents. You never invent, assume, or infer facts that are not explicitly stated in the documents.

2. If the answer is not in the documents, respond with exactly this sentence and nothing else: "The uploaded documents do not contain information to answer this question. Please upload a relevant legal document."

3. When asked to summarize, produce a real summary of what is actually in the documents — parties, subject matter, key terms, obligations, rights, liabilities, dates, and consequences. Do not give a generic or vague response.

4. When the answer involves legal definitions, quote the exact text from the document in quotation marks before explaining it.

5. When the answer involves liability, state precisely: who is liable, for what act or omission, under what conditions, and any caps or exclusions stated in the document.

6. When the answer involves obligations, categorize each one as: mandatory (shall/must), conditional (if/then), or prohibited (shall not/must not).

7. Do not add legal opinions, cautions, disclaimers, or advice not supported by the document text.

8. Structure every answer with bold headings. End with a one-sentence Key Takeaway.

9. Never use filler phrases like "based on the context provided" or "according to the documents". State facts directly.

10. Temperature is set to zero. You are deterministic. Give the same answer every time for the same input."""


def _tokenize(text: str) -> List[str]:
    return re.findall(r"\w+", text.lower())


def _clean_answer(text: str) -> str:
    text = text.replace("\\n", "\n")
    text = text.replace("\\t", " ")
    text = text.replace("\\r", "")
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
    text = text.replace("/*", "").replace("*/", "")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


class Retriever:

    def __init__(self, embedder: Embedder = None, vector_store: VectorStore = None):
        self.embedder = embedder or Embedder()
        self.vector_store = vector_store or VectorStore()
        # Keep Groq client available as a fallback, but prefer Google Gemini for answers.
        self.client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None
        print(f"Loading cross-encoder reranker: {RERANKER_MODEL}")
        self.reranker = CrossEncoder(RERANKER_MODEL)
        print("Reranker ready")

    def _semantic_search(
        self, query: str, top_k: int, namespace: str
    ) -> List[Dict[str, Any]]:
        query_embedding = self.embedder.embed_query(query)
        results = self.vector_store.search(
            query_embedding, top_k=top_k, namespace=namespace
        )
        return results

    def _keyword_search(
        self, query: str, top_k: int, namespace: str
    ) -> List[Dict[str, Any]]:
        doc_count = self.vector_store.count_documents(namespace=namespace)
        if doc_count > BM25_MAX_CHUNKS:
            print(f"  Skipping BM25: {doc_count} chunks exceeds limit of {BM25_MAX_CHUNKS}")
            return []

        all_docs = self.vector_store.fetch_all_texts(namespace=namespace)
        if not all_docs:
            return []

        corpus_tokens = [_tokenize(doc["text"]) for doc in all_docs]
        bm25 = BM25Okapi(corpus_tokens)
        query_tokens = _tokenize(query)
        scores = bm25.get_scores(query_tokens)

        scored_docs = []
        for i, doc in enumerate(all_docs):
            scored_docs.append({
                "id": doc["id"],
                "score": float(scores[i]),
                "text": doc["text"],
                "raw_text": doc.get("raw_text", doc["text"]),
                "has_tables": False,
                "has_images": False,
            })

        scored_docs.sort(key=lambda x: x["score"], reverse=True)
        return scored_docs[:top_k]

    def _reciprocal_rank_fusion(
        self,
        semantic_results: List[Dict[str, Any]],
        keyword_results: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        rrf_scores: Dict[str, float] = defaultdict(float)
        doc_map: Dict[str, Dict[str, Any]] = {}

        for rank, doc in enumerate(semantic_results, start=1):
            doc_id = doc["id"]
            rrf_scores[doc_id] += SEMANTIC_WEIGHT / (RRF_K + rank)
            doc_map[doc_id] = doc

        for rank, doc in enumerate(keyword_results, start=1):
            doc_id = doc["id"]
            rrf_scores[doc_id] += KEYWORD_WEIGHT / (RRF_K + rank)
            if doc_id not in doc_map:
                doc_map[doc_id] = doc

        fused = []
        for doc_id, score in sorted(
            rrf_scores.items(), key=lambda x: x[1], reverse=True
        ):
            entry = doc_map[doc_id].copy()
            entry["rrf_score"] = score
            fused.append(entry)

        return fused

    def _rerank(
        self, query: str, candidates: List[Dict[str, Any]], top_k: int
    ) -> List[Dict[str, Any]]:
        if not candidates:
            return []

        pairs = [(query, doc["text"]) for doc in candidates]
        raw_scores = self.reranker.predict(pairs)

        for i, doc in enumerate(candidates):
            doc["rerank_score"] = round(1 / (1 + math.exp(-float(raw_scores[i]))), 4)

        candidates.sort(key=lambda x: x["rerank_score"], reverse=True)
        return candidates[:top_k]

    def retrieve(
        self, query: str, top_k: int = RERANKER_TOP_K, namespace: str = ""
    ) -> List[Dict[str, Any]]:
        semantic_results = self._semantic_search(query, RETRIEVER_INITIAL_TOP_K, namespace)
        reranked = self._rerank(query, semantic_results, top_k)
        return reranked

    def generate_answer(
        self, query: str, top_k: int = RERANKER_TOP_K, namespace: str = ""
    ) -> Dict[str, Any]:
        chunks = self.retrieve(query, top_k=top_k, namespace=namespace)

        if not chunks:
            return {
                "query": query,
                "answer": "The uploaded documents do not contain information to answer this question. Please upload a relevant legal document.",
                "sources": [],
            }

        context = ""
        for i, chunk in enumerate(chunks):
            context += f"\n--- Document {i + 1} ---\n"
            context += f"{chunk['text']}\n"

        user_message = f"""You are performing a legal research query. Analyze the legal documents below and answer the question with full legal precision.

LEGAL DOCUMENTS (retrieved and ranked by relevance):
{context}

LEGAL QUERY: {query}

INSTRUCTIONS:
- Identify the type of legal question being asked (definition / liability / obligation / summary / clause analysis / compliance / general)
- Answer using ONLY information found in the documents above
- Use the exact legal language from the source where it matters — quote directly when relevant
- If the query involves liability: identify who is liable, for what, and under what conditions
- If the query involves obligations: list them clearly as mandatory / conditional / prohibited
- If the query is definitional: quote the definition exactly, then explain in plain language
- If the query is a summary request: cover parties, subject, key provisions, and consequences
- Structure your response with bold section headings
- End with a concise 'Key Takeaway' in one sentence
- If documents lack the needed information, clearly state that and do NOT invent any legal information"""

        prompt = f"SYSTEM:\n{SYSTEM_PROMPT}\n\nUSER:\n{user_message}"

        # Prefer Google Gemini (Azure-safe), fallback to Groq only if configured.
        answer = None
        if GOOGLE_API_KEY_1:
            try:
                print(f"[GOOGLE][ANSWER] Calling Gemini model={GOOGLE_MODEL} (key_1)...")
                client = genai.Client(api_key=GOOGLE_API_KEY_1)
                resp = client.models.generate_content(model=GOOGLE_MODEL, contents=prompt)
                if resp and resp.text:
                    answer = _clean_answer(resp.text)
                    print("[GOOGLE][ANSWER] Gemini key_1 succeeded.")
            except Exception as e:
                print(f"[GOOGLE][ANSWER] Gemini key_1 FAILED. type={type(e)}, detail={repr(e)}")

        if not answer and GOOGLE_API_KEY_2:
            try:
                print(f"[GOOGLE][ANSWER] Calling Gemini model={GOOGLE_MODEL} (key_2)...")
                client = genai.Client(api_key=GOOGLE_API_KEY_2)
                resp = client.models.generate_content(model=GOOGLE_MODEL, contents=prompt)
                if resp and resp.text:
                    answer = _clean_answer(resp.text)
                    print("[GOOGLE][ANSWER] Gemini key_2 succeeded.")
            except Exception as e:
                print(f"[GOOGLE][ANSWER] Gemini key_2 FAILED. type={type(e)}, detail={repr(e)}")

        if not answer and self.client:
            try:
                print(f"[GROQ][ANSWER] Falling back to Groq model={GROQ_MODEL}...")
                response = self.client.chat.completions.create(
                    model=GROQ_MODEL,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_message},
                    ],
                    temperature=0,
                    max_tokens=4096,
                )
                answer = _clean_answer(response.choices[0].message.content)
                print("[GROQ][ANSWER] Groq fallback succeeded.")
            except Exception as e:
                print(f"[GROQ][ANSWER] Groq fallback FAILED. type={type(e)}, detail={repr(e)}")

        if not answer:
            answer = "Sorry, I encountered an error generating the answer."

        return {
            "query": query,
            "answer": answer,
            "sources": [
                {
                    "id": c["id"],
                    "text": c["text"][:200],
                }
                for c in chunks
            ],
        }
