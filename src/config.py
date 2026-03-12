import os
from dotenv import load_dotenv

load_dotenv()

PINECONE_API_KEY = os.getenv("pine_corn_api")

OPENROUTER_API_KEY = os.getenv("openrouter_api")
OPENROUTER_MODEL = os.getenv(
    "openrouter_model") or "meta-llama/llama-3.1-8b-instruct"


PINECONE_INDEX_NAME = "smart-classroom"
PINECONE_CLOUD = "aws"
PINECONE_REGION = "us-east-1"

EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIMENSION = 384


CHUNK_MAX_CHARS = 1500
CHUNK_NEW_AFTER = 1200
CHUNK_COMBINE_UNDER = 300

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".doc", ".pptx", ".ppt"}

RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"
KEYWORD_WEIGHT = 0.20
SEMANTIC_WEIGHT = 0.80
RRF_K = 60
RETRIEVER_INITIAL_TOP_K = 15
RERANKER_TOP_K = 5
BM25_MAX_CHUNKS = 500
