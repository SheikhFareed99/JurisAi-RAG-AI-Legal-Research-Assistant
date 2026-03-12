import os
from dotenv import load_dotenv

load_dotenv()

PINECONE_API_KEY = os.getenv("pine_corn_api")

# OpenRouter configuration (primary and only LLM now)
OPENROUTER_API_KEY = os.getenv("openrouter_api")
OPENROUTER_MODEL = os.getenv("openrouter_model") or "meta-llama/llama-3.1-8b-instruct"

if OPENROUTER_API_KEY:
    print(
        f"[OPENROUTER][CONFIG] API key loaded: len={len(OPENROUTER_API_KEY)}, "
        f"prefix={OPENROUTER_API_KEY[:5]}, suffix={OPENROUTER_API_KEY[-4:]}, "
        f"model={OPENROUTER_MODEL}"
    )
else:
    print("[OPENROUTER][CONFIG] OPENROUTER_API_KEY is missing or empty")

PINECONE_INDEX_NAME = "smart-classroom"
PINECONE_CLOUD = "aws"
PINECONE_REGION = "us-east-1"

EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIMENSION = 384


CHUNK_MAX_CHARS = 1000
CHUNK_NEW_AFTER = 800
CHUNK_COMBINE_UNDER = 200

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".doc", ".pptx", ".ppt"}

RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"
KEYWORD_WEIGHT = 0.20
SEMANTIC_WEIGHT = 0.80
RRF_K = 60
RETRIEVER_INITIAL_TOP_K = 15
RERANKER_TOP_K = 5
BM25_MAX_CHUNKS = 500
