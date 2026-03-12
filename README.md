# JurisAi — AI-Powered Legal Research Assistant

> Built by **Sheikh Fareed**

JurisAi is a production-grade, full-stack legal research assistant powered by a Retrieval-Augmented Generation (RAG) pipeline. Upload any legal document — contract, statute, case brief, or regulation — and ask precise natural-language questions. Every answer is grounded strictly in the uploaded source, fully source-cited, and streams to your browser in real time.

---

## Table of Contents

1. [What It Does](#what-it-does)
2. [Architecture](#architecture)
3. [RAG Pipeline — Deep Dive](#rag-pipeline--deep-dive)
4. [Tech Stack](#tech-stack)
5. [Project Structure](#project-structure)
6. [Running Locally](#running-locally)
7. [Environment Variables](#environment-variables)
8. [API Reference](#api-reference)
9. [Deployment](#deployment)
10. [The Debugging Journey — 3 Failed LLM Providers](#the-debugging-journey--3-failed-llm-providers)
11. [Known Limitations](#known-limitations)

---

## What It Does

| Feature | Details |
|---|---|
| Document ingestion | Upload PDF, DOCX, PPTX, DOC files; OCR runs on embedded images |
| RAG-based Q&A | Semantic vector search + BM25 keyword search fused via Reciprocal Rank Fusion |
| Cross-encoder reranking | Re-scores candidates with ms-marco-MiniLM before passing to LLM |
| Streaming answers | Server-Sent Events (SSE) deliver tokens as they are generated |
| Source citation | Every answer references the exact chunks retrieved with relevance scores |
| Query history | All sessions persisted to MongoDB; searchable by document |
| Analytics dashboard | Queries per day, most researched documents, category breakdown |
| User auth | JWT-based registration/login with bcrypt password hashing |
| Cloud file storage | Raw files stored in Azure Blob Storage; only URLs travel the wire |

---

## Architecture

```
┌───────────────────────────────┐
│   React 18 + Vite (client)    │   port 5173
│   Tailwind CSS, React Query   │
│   SSE streaming consumer      │
└──────────────┬────────────────┘
               │ REST  /  SSE
               ▼
┌───────────────────────────────┐
│  Express.js API Gateway       │   port 5000
│  (Node.js, Mongoose, multer)  │
│                               │
│  ├─ MongoDB Atlas             │  users · documents · query history
│  └─ Azure Blob Storage        │  raw PDF/DOCX/PPTX files
└──────────────┬────────────────┘
               │ HTTP proxy (axios)
               ▼
┌───────────────────────────────┐
│  FastAPI RAG Backend          │   port 8000
│  (Python 3.11, Uvicorn)       │
│                               │
│  ├─ Pinecone (vector DB)      │  384-dim embeddings, serverless AWS us-east-1
│  ├─ Sentence Transformers     │  all-MiniLM-L6-v2 embedder
│  ├─ Cross-Encoder reranker    │  ms-marco-MiniLM-L-6-v2
│  ├─ BM25 (rank-bm25)          │  keyword retrieval
│  └─ OpenRouter API            │  LLM inference — meta-llama/llama-3.1-8b-instruct
└───────────────────────────────┘
```

---

## RAG Pipeline — Deep Dive

### Ingestion Flow

```
User uploads file (browser)
        │
        ▼
Express receives file via multer (memory buffer)
        │
        ▼
File uploaded to Azure Blob Storage → URL returned
        │
        ▼
Document metadata saved to MongoDB
        │
        ▼
Express calls FastAPI  POST /ingest  { url, book_name }
        │
        ▼
FastAPI downloads file from Azure URL
        │
        ▼
┌─ Loader (loader.py) ─────────────────────────────────────┐
│  PyMuPDF  → extracts text from PDF pages                  │
│  EasyOCR  → runs OCR on embedded images in PDFs           │
│  python-pptx → extracts text from PowerPoint slides       │
│  docx2txt → extracts text from DOCX/DOC files             │
└──────────────────────────────────────────────────────────┘
        │  raw text
        ▼
┌─ Chunker (chunker.py) ────────────────────────────────────┐
│  LangChain RecursiveCharacterTextSplitter                  │
│  chunk_size=800 chars, overlap=150 chars                   │
│  Title-aware: prepends section heading to each chunk       │
└──────────────────────────────────────────────────────────┘
        │  List[Chunk]
        ▼
┌─ Summarizer (summarizer.py) ──────────────────────────────┐
│  Calls OpenRouter (llama-3.1-8b-instruct)                  │
│  Generates a 2-3 sentence AI summary per chunk             │
│  Summary stored alongside chunk as metadata                │
└──────────────────────────────────────────────────────────┘
        │  chunks + summaries
        ▼
┌─ Embedder (embedder.py) ──────────────────────────────────┐
│  sentence-transformers all-MiniLM-L6-v2                    │
│  384-dimensional dense vectors                             │
└──────────────────────────────────────────────────────────┘
        │  (vector, metadata) pairs
        ▼
┌─ Vector Store (vector_store.py) ──────────────────────────┐
│  Pinecone serverless index "smart-classroom"               │
│  Each document gets its own namespace (book_name)          │
│  Metadata: text, summary, title, page, chunk_index        │
└──────────────────────────────────────────────────────────┘
```

### Query Flow

```
User types question (ResearchChat.jsx)
        │
        ▼
Express  GET /api/query/stream  (SSE) or  POST /api/query
        │
        ▼
JWT auth middleware verifies token
        │
        ▼
Express calls FastAPI  POST /query  or  POST /query/stream
        │
        ▼
┌─ Retriever (retriever.py) ────────────────────────────────┐
│                                                            │
│  1. Embed query with Sentence Transformer                  │
│  2. Pinecone semantic search  → top-20 candidates          │
│  3. BM25 keyword search       → top-20 candidates          │
│  4. Reciprocal Rank Fusion    → merged ranked list         │
│  5. Cross-Encoder reranker    → re-scores merged list      │
│  6. Take top-k (default 5) highest-scoring chunks          │
│                                                            │
│  7. Format chunks as legal context block                   │
│  8. Build prompt with SYSTEM_PROMPT + context + question   │
│  9. Call OpenRouter (llama-3.1-8b-instruct)                │
│ 10. Stream tokens via SSE or return full response          │
└──────────────────────────────────────────────────────────┘
        │  answer + sources
        ▼
Express saves { query, answer, sources, document } to MongoDB
        │
        ▼
Client renders streaming markdown with source citations
```

### System Prompt Design

The retriever uses a strict system prompt that:
- Identifies the AI as "JurisAi, created by Sheikh Fareed"
- Forces the LLM to answer only from the provided context (no hallucination)
- Classifies each query into: `definition`, `liability`, `obligation`, `summary`, or `clause_analysis`
- Mandates structured output with headers, bullet points, and numbered citations

---

## Tech Stack

### Frontend
| Package | Version | Purpose |
|---|---|---|
| React | 18.3.1 | UI library |
| Vite | 5.4.2 | Build tool & dev server |
| Tailwind CSS | 3.4.1 | Utility-first styling (navy + gold palette) |
| React Router | v6.22.3 | Client-side routing |
| TanStack React Query | v5.28.0 | Server state, caching, background refetch |
| Axios | 1.6.7 | HTTP client with JWT interceptor |
| react-markdown + remark-gfm | 9.x / 4.x | Renders LLM markdown output |
| Recharts | 2.12.2 | Analytics charts |
| lucide-react | 0.344.0 | Icon library |
| react-hot-toast | 2.4.1 | Toast notifications |

### API Gateway (Node.js)
| Package | Version | Purpose |
|---|---|---|
| Express | 4.18.3 | HTTP server & routing |
| Mongoose | 8.2.1 | MongoDB ODM |
| multer | 2.1.1 | Multipart file upload (memory storage) |
| @azure/storage-blob | 12.31.0 | Upload files to Azure Blob Storage |
| jsonwebtoken | 9.0.2 | JWT signing & verification |
| bcryptjs | 2.4.3 | Password hashing |
| cors | 2.8.5 | Cross-Origin Resource Sharing |
| axios | 1.6.7 | HTTP proxy to FastAPI |

### AI Backend (Python)
| Package | Purpose |
|---|---|
| FastAPI + Uvicorn | Async web framework & ASGI server |
| sentence-transformers | all-MiniLM-L6-v2 embeddings (384-dim) |
| cross-encoder/ms-marco-MiniLM-L-6-v2 | Reranker for candidate re-scoring |
| pinecone | Serverless vector database client |
| rank-bm25 | BM25 sparse keyword retrieval |
| langchain-text-splitters | RecursiveCharacterTextSplitter |
| PyMuPDF (fitz) | PDF text extraction |
| easyocr | OCR for image-embedded text in PDFs |
| python-pptx | PowerPoint parsing |
| docx2txt | DOCX/DOC parsing |
| Pillow + numpy | Image preprocessing for OCR |
| requests | OpenRouter HTTP calls |
| python-dotenv | `.env` loading |
| python-multipart | Multipart form data parsing |

### Infrastructure & Cloud
| Service | Purpose |
|---|---|
| MongoDB Atlas | Primary database — users, documents, query history |
| Pinecone (serverless, AWS us-east-1) | Vector search — index: `smart-classroom` |
| Azure Blob Storage | File hosting — container: `test20` |
| OpenRouter API | LLM inference gateway (model: `meta-llama/llama-3.1-8b-instruct`) |
| Azure App Service | CI/CD target for FastAPI via GitHub Actions |
| Render.com | Express gateway deployment |
| Vercel | React frontend deployment |

---

## Project Structure

```
ai_backend - Copy/
│
├── main.py                   # FastAPI app — /ingest /query /query/stream
├── requirements.txt          # Python dependencies
├── runtime.txt               # python-3.11.9
├── .env                      # FastAPI environment variables
│
├── src/                      # Python RAG modules
│   ├── config.py             # All constants: chunk size, model names, weights
│   ├── loader.py             # PDF (fitz+OCR) / DOCX / PPTX document loading
│   ├── chunker.py            # Title-aware recursive text chunking
│   ├── summarizer.py         # Per-chunk AI summary via OpenRouter
│   ├── embedder.py           # Sentence Transformer dense vectors
│   ├── vector_store.py       # Pinecone upsert / query / delete
│   ├── retriever.py          # Semantic + BM25 → RRF → rerank → LLM generation
│   └── pipeline.py           # IngestionPipeline orchestrator
│
├── server/                   # Node.js Express API gateway
│   ├── index.js              # App entry: MongoDB connect, route registration, port 5000
│   ├── package.json
│   ├── .env                  # Server environment variables
│   ├── middleware/
│   │   └── auth.js           # JWT verify middleware
│   ├── models/
│   │   ├── User.js           # Mongoose schema: email, passwordHash, createdAt
│   │   ├── Document.js       # Mongoose schema: user, filename, blobUrl, chunks, status
│   │   └── QueryHistory.js   # Mongoose schema: user, document, query, answer, sources
│   └── routes/
│       ├── auth.js           # POST /register  POST /login  GET /me
│       ├── documents.js      # GET/POST/DELETE /api/documents + stats
│       ├── query.js          # POST /api/query  GET /api/query/stream (SSE)
│       └── history.js        # GET /api/history  GET /api/history/analytics/summary
│
├── client/                   # React 18 + Vite frontend
│   ├── index.html            # Shell HTML — favicon + root div
│   ├── vite.config.js        # Dev server port 5173
│   ├── tailwind.config.js    # navy + gold color palette, Inter font, custom animations
│   ├── postcss.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx          # React root — BrowserRouter, QueryClientProvider, AuthProvider, Toaster
│       ├── App.jsx           # Route map — public: / /auth  protected: /app/*
│       ├── index.css         # Global styles + Tailwind directives
│       ├── context/
│       │   └── AuthContext.jsx  # JWT storage, login/logout, /api/auth/me bootstrap
│       ├── lib/
│       │   └── api.js           # Axios instance — base URL + JWT Authorization header interceptor
│       ├── components/
│       │   └── Layout.jsx       # App shell: sidebar nav, user info, mobile menu
│       └── pages/
│           ├── LandingPage.jsx      # Marketing landing page
│           ├── AuthPage.jsx         # Login / register form
│           ├── Dashboard.jsx        # Overview: document count, recent queries, quick-start
│           ├── ResearchChat.jsx     # Core AI chat — document selector, SSE stream renderer
│           ├── DocumentLibrary.jsx  # Upload, list, delete documents; status badges
│           ├── Analytics.jsx        # Recharts: queries/day, top docs, category pie
│           └── HistoryPage.jsx      # Paginated query history with full answer expansion
│
└── .github/
    └── workflows/
        └── main_jurisai.yml  # GitHub Actions: push to main → deploy to Azure Web App
```

---

## Running Locally

### Prerequisites

- Python 3.11+
- Node.js 18+
- MongoDB Atlas cluster (free tier works)
- Pinecone account (free serverless tier)
- Azure Blob Storage account
- OpenRouter API key

### 1. FastAPI RAG Backend

```bash
cd "ai_backend - Copy"
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Create `.env` in the root:

```env
pine_corn_api=your_pinecone_key
openrouter_api=your_openrouter_key
connectionstring=your_azure_blob_connection_string
blob_container=test20
Mongo_URL=mongodb+srv://user:pass@cluster.mongodb.net/jurisai
```

The backend will be available at `http://localhost:8000`. Interactive API docs at `http://localhost:8000/docs`.

### 2. Express API Gateway

```bash
cd server
npm install
node index.js
# or with auto-restart:
npx nodemon index.js
```

Create `server/.env`:

```env
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/jurisai
JWT_SECRET=your_random_secret_min_32_chars
FASTAPI_URL=http://localhost:8000
PORT=5000
AZURE_CONNECTION_STRING=your_azure_blob_connection_string
AZURE_CONTAINER=test20
```

Runs on `http://localhost:5000`.

### 3. React Frontend

```bash
cd client
npm install
npm run dev
```

Runs on `http://localhost:5173`. Update `client/src/lib/api.js` to point to `http://localhost:5000/api` for local development.

---

## Environment Variables

### FastAPI Backend (`/.env`)

| Variable | Description |
|---|---|
| `pine_corn_api` | Pinecone API key |
| `openrouter_api` | OpenRouter API key (current LLM provider) |
| `connectionstring` | Azure Blob Storage full connection string |
| `blob_container` | Azure container name (default: `test20`) |
| `Mongo_URL` | MongoDB Atlas connection URI |
| `google_api_1` | Legacy — Google Gemini key (no longer used) |
| `google_api_2` | Legacy — Google Gemini key (no longer used) |
| `groq_api` | Legacy — Groq key (no longer used) |

### Express Gateway (`/server/.env`)

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB Atlas connection URI |
| `JWT_SECRET` | Secret for signing JWTs |
| `FASTAPI_URL` | FastAPI base URL |
| `PORT` | Express listen port (default: 5000) |
| `AZURE_CONNECTION_STRING` | Azure Blob Storage connection string |
| `AZURE_CONTAINER` | Azure container name |

---

## API Reference

### FastAPI Endpoints (`http://localhost:8000`)

| Method | Endpoint | Body | Description |
|---|---|---|---|
| `GET` | `/` | — | Health check |
| `POST` | `/ingest` | `{ url: string, book_name: string }` | Download file, chunk, embed, store in Pinecone |
| `POST` | `/query` | `{ book_name, query, top_k? }` | Semantic + BM25 retrieval, rerank, LLM generation |
| `POST` | `/query/stream` | `{ book_name, query, top_k? }` | Same as above but streams tokens via SSE |

### Express Gateway Endpoints (`http://localhost:5000`)

**Auth**

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | No | Register new user (email + password) |
| `POST` | `/api/auth/login` | No | Returns signed JWT |
| `GET` | `/api/auth/me` | JWT | Returns current user profile |

**Documents**

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/documents` | JWT | List current user's documents |
| `POST` | `/api/documents` | JWT | Upload file → Azure Blob → ingest via FastAPI |
| `DELETE` | `/api/documents/:id` | JWT | Delete document metadata + Pinecone namespace |
| `GET` | `/api/documents/stats` | JWT | Aggregate stats: total docs, total chunks, categories |

**Query**

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/query` | JWT | Standard query, saves history, returns full answer |
| `GET` | `/api/query/stream` | JWT | SSE streaming; params: `book_name`, `query` |

**History**

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/history` | JWT | Paginated query history list |
| `GET` | `/api/history/analytics/summary` | JWT | Queries/day, top documents, category stats |
| `GET` | `/api/history/:id` | JWT | Full detail of a single query session |

---

## Deployment

The three services deploy independently:

### React Frontend → Vercel

```bash
cd client
npm run build
# deploy dist/ to Vercel
```

Set environment variable in Vercel dashboard:
```
VITE_API_URL=https://your-express-backend.onrender.com/api
```

Update `client/src/lib/api.js` base URL to use `import.meta.env.VITE_API_URL`.

### Express Gateway → Render.com

- Connect GitHub repo, set build command: `cd server && npm install`
- Set start command: `node server/index.js`
- Add all `server/.env` variables in Render's environment settings
- Current deployed URL: `https://jurisai-rag-ai-legal-research-assistant.onrender.com`

### FastAPI Backend → Azure App Service

CI/CD is already configured via GitHub Actions (`.github/workflows/main_jurisai.yml`).

Every push to `main`:
1. GitHub Actions runner sets up Python 3.11
2. Installs `requirements.txt` into a virtual environment
3. Deploys to Azure Web App named `JurisAi` using OIDC authentication

Required GitHub Secrets:
```
AZUREAPPSERVICE_CLIENTID
AZUREAPPSERVICE_TENANTID
AZUREAPPSERVICE_SUBSCRIPTIONID
```

Add all FastAPI `.env` variables to Azure → App Service → Configuration → Application settings.

---

## The Debugging Journey — 3 Failed LLM Providers

Building JurisAi's LLM layer was the hardest part of this project. Here is an honest account of what broke, why, and how each failure led to the final solution.

---

### Attempt 1: Groq (llama-3.3-70b-versatile)

**What I tried:** Groq's API is blazing fast and the `llama-3.3-70b-versatile` model looked perfect for legal reasoning. Initial tests worked in isolation — the model was sharp, responses were detailed.

**What broke:** Once integrated into the full RAG pipeline, requests started failing unpredictably:
- Rate-limit errors on the free tier hit after only a handful of documents
- The `llama-3.3-70b-versatile` model had stricter context window limits than advertised when combined with long legal chunk contexts
- The Groq client would silently time out during document ingestion, leaving the pipeline in a broken half-ingested state
- Retry logic helped intermittently but the failures were non-deterministic — very hard to reproduce reliably

**Verdict:** Groq's free tier is not reliable for a pipeline that processes 800-char chunks with summarization calls plus answer generation in the same request flow. **Abandoned.**

Git evidence: commits `00352c6` ("chaning groq model") and `3e586db` ("debugging") document the attempts to swap Groq models and fix the integration.

---


### Attempt 2: Google Gemini (gemini-pro via LangChain)

**What I tried:** Switched direction entirely. Google's Gemini API has a generous free tier, excellent rate limits, and LangChain has first-class `ChatGoogleGenerativeAI` support. Set up two separate Google Cloud projects and API keys (`google_api_1`, `google_api_2` — both still visible in `.env` as legacy variables). Installed `langchain-google-genai` and rewrote the retriever around `gemini-pro`.

**What broke:** Regional access restrictions.

The Gemini API via Google AI Studio is not available in all countries. Every request returned HTTP `400` or `403` errors with messages indicating the service was unavailable in the region. Two separate API keys from two separate Google projects produced the same result. The restrictions were at the API endpoint level, not the account level.

Attempts to use a VPN introduced enough latency to break SSE streaming — tokens would buffer and arrive in bursts instead of flowing smoothly, making the real-time chat experience completely unusable.

**Verdict:** No code-level fix exists for a regional restriction imposed by the provider. **Abandoned.**

Git evidence: commit `3b8a293` ("google llm's fail due to regional restrictions now using open router") documents this failure directly.

---

### Final Solution: OpenRouter

**Why it worked:**
- OpenRouter is a unified LLM gateway that routes to multiple providers through a single OpenAI-compatible API
- No regional restrictions — OpenRouter's infrastructure handles geographic routing transparently
- `meta-llama/llama-3.1-8b-instruct` handles legal context windows well and is cost-effective
- The migration was minimal: change `base_url` to `https://openrouter.ai/api/v1`, swap the API key
- Free tier is sufficient for development; production scales on pay-per-token

**Changes made in the codebase:**
- `src/retriever.py` — replaced provider-specific client with a `requests.post()` call to OpenRouter's chat completions endpoint
- `src/summarizer.py` — same pattern for per-chunk summarization calls
- `src/config.py` — added `openrouter_api` and `openrouter_model` constants

The final production model: **`meta-llama/llama-3.1-8b-instruct`** via OpenRouter.

Git evidence: commits `3b8a293` and `9c593fd` ("making strong system prompt adding retriver add chunking with title too") show the OpenRouter migration and the subsequent system prompt hardening that followed once the LLM layer was finally stable.

---

**Summary of the LLM provider journey:**

```
Groq (llama-3.3-70b)         → Rate limits + silent timeouts on free tier
         ↓ failed
Azure OpenAI (GPT-3.5/4)     → Free trial does NOT include Azure OpenAI access
         ↓ failed
Google Gemini (gemini-pro)   → Regional access restrictions, no workaround
         ↓ failed
OpenRouter (llama-3.1-8b)    → Works in production ✓
```

---

## Known Limitations

- **Pinecone cold start**: The serverless Pinecone index can take 1–2 seconds to initialize on the first query after inactivity.
- **EasyOCR memory**: OCR on large image-heavy PDFs uses significant RAM. Not suitable for serverless functions with memory limits below 1 GB.
- **Render.com free tier**: The Express gateway spins down after 15 minutes of inactivity. The first request after sleep takes ~30 seconds.
- **BM25 in-memory**: The BM25 index is rebuilt from Pinecone metadata on every query. For very large document namespaces this adds latency.
- **OpenRouter free tier**: Rate limits apply. For production workloads, use a paid OpenRouter plan.
- **Shared Pinecone index**: All users share the `smart-classroom` index, namespaced per document. Consider a per-user index if the dataset grows large.

---

## Author

**Sheikh Fareed** — Full-stack AI engineer.

JurisAi is the persona name of the AI assistant embedded in this application. The system prompt instructs the LLM to identify itself as "JurisAi, created by Sheikh Fareed."
