import json
import errno
import requests
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from src.pipeline import IngestionPipeline
from src.retriever import Retriever

app = FastAPI(title="JurissAi RAG API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_pipeline = None
_retriever = None


def get_pipeline() -> IngestionPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = IngestionPipeline()
    return _pipeline


def get_retriever() -> Retriever:
    global _retriever
    if _retriever is None:
        _retriever = Retriever()
    return _retriever


class IngestRequest(BaseModel):
    url: str
    book_name: str


class QueryRequest(BaseModel):
    book_name: str
    query: str
    top_k: int = 5


@app.get("/")
def root():
    return {"status": "ok", "message": "JurissAi RAG API v3"}


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(content=b"", media_type="image/x-icon")


@app.post("/ingest")
def ingest(req: IngestRequest):
    try:
        pipeline = get_pipeline()
        result = pipeline.ingest_from_url(req.url, req.book_name)
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query")
def query(req: QueryRequest):
    try:
        retriever = get_retriever()
        result = retriever.generate_answer(
            req.query, top_k=req.top_k, namespace=req.book_name
        )
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query/stream")
def query_stream(req: QueryRequest):
    retriever = get_retriever()

    def event_generator():
        try:
            chunks = retriever.retrieve(
                req.query, top_k=req.top_k, namespace=req.book_name)

            if not chunks:
                yield f"data: {json.dumps({'type': 'error', 'content': 'The provided documents do not contain sufficient information to answer this question.'})}\n\n"
                return

            context = ""
            for i, chunk in enumerate(chunks):
                context += f"\n--- Document {i + 1} ---\n"
                context += f"{chunk['text']}\n"

            user_message = f"""Analyze the legal documents below and answer the question with full legal precision and completeness.

LEGAL DOCUMENTS (retrieved and ranked by relevance):
{context}

LEGAL QUERY: {req.query}

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

            from src.config import OPENROUTER_API_KEY, OPENROUTER_MODEL
            from src.retriever import SYSTEM_PROMPT

            def get_llm_stream():
                if not OPENROUTER_API_KEY:
                    raise RuntimeError("OPENROUTER_API_KEY is not configured.")

                prompt = f"SYSTEM:\n{SYSTEM_PROMPT}\n\nUSER:\n{user_message}"

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

                print(
                    f"[OPENROUTER][STREAM] Requesting completion model={OPENROUTER_MODEL}...")
                resp = requests.post(
                    "https://openrouter.ai/api/v1/chat/completions", json=payload, headers=headers, timeout=120)
                resp.raise_for_status()
                data = resp.json()
                full_text = data["choices"][0]["message"]["content"]
                print(
                    "[OPENROUTER][STREAM] Completion received, streaming to client...")

                def stream_text():
                    chunk_size = 80
                    for i in range(0, len(full_text), chunk_size):
                        yield full_text[i: i + chunk_size]

                return stream_text(), full_text

            llm_stream, full_answer = get_llm_stream()
            is_off_topic = full_answer.startswith("[OFF_TOPIC]")
            if is_off_topic:
                cleaned = full_answer[len("[OFF_TOPIC]"):].lstrip()

                def make_stream(text):
                    chunk_size = 80
                    for i in range(0, len(text), chunk_size):
                        yield text[i: i + chunk_size]
                llm_stream = make_stream(cleaned)
                yield f"data: {json.dumps({'type': 'sources', 'sources': []})}\n\n"
            else:
                sources = [
                    {
                        "id": c["id"],
                        "text": c["text"][:300],
                        "page": c.get("page", 0),
                    }
                    for c in chunks
                ]
                yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

            for token in llm_stream:
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except GeneratorExit:
            return
        except OSError as oe:
            if getattr(oe, "winerror", None) == 10038:
                return
            if oe.errno in (errno.EPIPE, errno.ECONNRESET, errno.ECONNABORTED):
                return
            print(f"[STREAM] Unexpected OSError: {oe}")
            return
        except Exception as e:
            if "WinError 10038" in str(e):
                return
            try:
                yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
            except Exception:
                pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/groqtest")
def groqtest():
    from groq import Groq
    client = Groq(api_key=GROQ_API_KEY)

    r = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": "Hello"}]
    )
    return {"msg": r.choices[0].message.content}
