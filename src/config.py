import os
from dotenv import load_dotenv

load_dotenv()

PINECONE_API_KEY = os.getenv("pine_corn_api")
GROQ_API_KEY = os.getenv("groq_api")
GOOGLE_API_KEY = os.getenv("google_api")

PINECONE_INDEX_NAME = "smart-classroom"
PINECONE_CLOUD = "aws"
PINECONE_REGION = "us-east-1"

EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIMENSION = 384

GROQ_MODEL = "llama-3.3-70b-versatile"
GOOGLE_MODEL = "gemini-2.0-flash"

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
