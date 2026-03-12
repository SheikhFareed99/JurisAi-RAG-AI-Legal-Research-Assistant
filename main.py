import json
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
            chunks = retriever.retrieve(req.query, top_k=req.top_k, namespace=req.book_name)

            if not chunks:
                yield f"data: {json.dumps({'type': 'error', 'content': 'The provided documents do not contain sufficient information to answer this question.'})}\n\n"
                return

            # Send sources first
            sources = [
                {
                    "id": c["id"],
                    "text": c["text"][:300],
                }
                for c in chunks
            ]
            yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

            # Build context
            context = ""
            for i, chunk in enumerate(chunks):
                context += f"\n--- Document {i + 1} ---\n"
                context += f"{chunk['text']}\n"

            user_message = f"""You are performing a legal research query. Analyze the legal documents below and answer the question with full legal precision.

LEGAL DOCUMENTS (retrieved and ranked by relevance):
{context}

LEGAL QUERY: {req.query}

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

            from groq import Groq
            from src.config import GROQ_API_KEY, GROQ_MODEL
            from src.retriever import SYSTEM_PROMPT
            
            def get_llm_stream():
                print("[GROQ][STREAM] Initializing Groq streaming call...")
                try:
                    client_groq = Groq(api_key=GROQ_API_KEY)
                    stream = client_groq.chat.completions.create(
                        model=GROQ_MODEL,
                        messages=[
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": user_message},
                        ],
                        temperature=0,
                        max_tokens=4096,
                        stream=True,
                    )
                    print("[GROQ][STREAM] Groq streaming call created successfully.")

                    def groq_stream():
                        for chunk_delta in stream:
                            token = chunk_delta.choices[0].delta.content
                            if token:
                                yield token

                    return groq_stream()
                except Exception as e:
                    print(f"[GROQ][STREAM] Groq streaming init FAILED. type={type(e)}, detail={repr(e)}")
                    raise

            llm_stream = get_llm_stream()
            for token in llm_stream:
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

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
        messages=[{"role":"user","content":"Hello"}]
    )
    return {"msg": r.choices[0].message.content}