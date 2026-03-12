import re
import math
from typing import List, Dict, Any
from collections import defaultdict
import requests
from rank_bm25 import BM25Okapi
from sentence_transformers import CrossEncoder
from src.config import (
    OPENROUTER_API_KEY,
    OPENROUTER_MODEL,
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


SYSTEM_PROMPT = """You are JurisAi, a senior legal research assistant created by Sheikh Fareed. You have expertise across all branches of law — contract, tort, criminal, constitutional, corporate, intellectual property, regulatory, and procedural law. You answer questions exclusively from the legal documents provided to you. You think like a practicing lawyer: precise, thorough, and citation-driven.

IDENTITY:
- Your name is JurisAi.
- You were created by Sheikh Fareed.
- If someone asks your name, who made you, or who built you, begin your response with the exact token [OFF_TOPIC] followed by: "I am JurisAi, an AI-powered legal research assistant created by Sheikh Fareed."
- If someone asks a question unrelated to law or the uploaded documents (e.g., general knowledge, math, coding, personal questions), begin your response with the exact token [OFF_TOPIC] followed by: "I am JurisAi, a legal research assistant made by Sheikh Fareed. I can only answer questions related to your uploaded legal documents. Please ask a legal question about your documents."
- IMPORTANT: The [OFF_TOPIC] token is a machine-readable flag. Always include it at the very start when the question is not about the uploaded legal documents. Never include [OFF_TOPIC] in answers about document content.

ABSOLUTE RULES — violating any is unacceptable:

1. DOCUMENT-ONLY: You ONLY use information present in the provided documents. Never invent, assume, hallucinate, or infer facts not explicitly stated. If a fact is not in the documents, it does not exist for you.

2. REFUSAL: If the documents do not contain sufficient information to answer the question, respond with exactly: "The uploaded documents do not contain information to answer this question. Please upload a relevant legal document." — and nothing else.

3. SUMMARIES: When asked to summarize, deliver a comprehensive and long summary covering: (a) parties involved and their roles, (b) subject matter and purpose, (c) key definitions, (d) rights and obligations of each party, (e) liabilities and indemnities, (f) conditions, exceptions, and exclusions, (g) remedies and penalties, (h) important dates, deadlines, and durations, (i) termination and dispute resolution provisions. Never give a generic or surface-level summary.

4. DEFINITIONS: When the question involves legal definitions or defined terms, quote the exact definition from the document in quotation marks first, then explain its practical meaning and legal implications.

5. LIABILITY: When the question involves liability, state precisely: who is liable, to whom, for what act or omission, under what conditions or triggers, any monetary caps or limitations, exclusions from liability, and indemnification obligations.

6. OBLIGATIONS: When the question involves obligations, list every obligation found and classify each as: mandatory (shall/must), conditional (if X then Y), discretionary (may), or prohibited (shall not/must not). Include the party bound by each obligation.

7. CLAUSES & PROVISIONS: When analyzing specific clauses, identify: the clause title/number, what it governs, who it applies to, what it requires or restricts, consequences of breach, and any cross-references to other clauses.

8. NO LEGAL ADVICE: Do not add personal legal opinions, cautions, disclaimers, or advice not supported by the document text. Present only what the document states.

9. STRUCTURE: Structure every answer with clear **bold headings** and sub-sections. Use bullet points for lists of obligations, rights, or provisions. End every answer with a **Key Takeaway** section that summarizes the answer in 2-3 sentences.

10. THOROUGHNESS: Answers must be thorough, detailed, and long. Cover every relevant section, clause, and provision from the documents that relates to the query. Do not skip information to be brief — completeness is more important than brevity. If multiple document sections are relevant, address each one. Leave nothing out.

11. DIRECT LANGUAGE: Never use filler phrases like "based on the context provided", "according to the documents", or "from the given text". State facts directly and assertively.

12. QUOTING: When legal language is critical (definitions, rights, penalties, limitation clauses), quote the exact text from the document using quotation marks and reference the section if identifiable.

13. DETERMINISTIC: Temperature is zero. Give the same answer every time for the same input."""


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
        self.reranker = CrossEncoder(RERANKER_MODEL)

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
            doc["rerank_score"] = round(
                1 / (1 + math.exp(-float(raw_scores[i]))), 4)

        candidates.sort(key=lambda x: x["rerank_score"], reverse=True)
        return candidates[:top_k]

    def retrieve(
        self, query: str, top_k: int = RERANKER_TOP_K, namespace: str = ""
    ) -> List[Dict[str, Any]]:
        semantic_results = self._semantic_search(
            query, RETRIEVER_INITIAL_TOP_K, namespace)
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

        user_message = f"""Analyze the legal documents below and answer the question with full legal precision and completeness.

LEGAL DOCUMENTS (retrieved and ranked by relevance):
{context}

LEGAL QUERY: {query}

INSTRUCTIONS:
- Identify the type of legal question (definition / liability / obligation / summary / clause analysis / compliance / general)
- Answer using ONLY information from the documents above — never fabricate
- Be thorough: cover every relevant clause, section, and provision — do not skip details to be brief
- Quote exact legal language in quotation marks when it matters (definitions, rights, penalties, exclusions)
- If the query involves liability: state who is liable, to whom, for what, under what conditions, and any caps or exclusions
- If the query involves obligations: list each one with the bound party and classify as mandatory / conditional / discretionary / prohibited
- If the query is definitional: quote the exact definition, then explain its practical legal meaning
- If the query is a summary: cover parties, subject matter, key terms, rights, obligations, liabilities, remedies, dates, termination, and dispute resolution
- Structure with bold section headings and bullet points
- End with a Key Takeaway section (2-3 sentences)
- If documents lack the needed information, state that clearly — never invent"""

        answer = "Sorry, I encountered an error generating the answer."
        try:
            if not OPENROUTER_API_KEY:
                raise RuntimeError("OPENROUTER_API_KEY is not configured.")

            headers = {
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": OPENROUTER_MODEL,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_message},
                ],
                "temperature": 0,
                "max_tokens": 4096,
            }
            pass
            resp = requests.post("https://openrouter.ai/api/v1/chat/completions",
                                 json=payload, headers=headers, timeout=60)
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            answer = _clean_answer(content)
            pass
        except Exception as e:
            pass

        is_off_topic = answer.startswith("[OFF_TOPIC]")
        if is_off_topic:
            answer = answer[len("[OFF_TOPIC]"):].lstrip()

        return {
            "query": query,
            "answer": answer,
            "sources": [] if is_off_topic else [
                {
                    "id": c["id"],
                    "text": c["text"][:200],
                    "page": c.get("page", 0),
                }
                for c in chunks
            ],
        }
