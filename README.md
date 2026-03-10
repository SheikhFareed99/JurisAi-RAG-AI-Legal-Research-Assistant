# JurisAi

JurisAi is a full-stack AI-powered legal research assistant built on a Retrieval-Augmented Generation (RAG) pipeline. It allows lawyers, paralegals, and law students to upload legal documents and ask precise questions — receiving source-cited, structured answers without hallucinations.

The project demonstrates end-to-end integration of a production-grade AI backend with a modern web application, covering vector search, document ingestion, cloud storage, real-time streaming, and user authentication.

---

## Architecture

```
Client (React + Vite)
    |
    | REST / SSE
    v
Express.js API Gateway (Node.js)
    |-- MongoDB Atlas  (users, documents, query history)
    |-- Azure Blob Storage  (uploaded PDF/DOCX files)
    |
    | HTTP proxy
    v
FastAPI RAG Backend (Python)
    |-- Pinecone  (vector database)
    |-- Groq  (LLM inference, llama-3.3-70b)
    |-- Sentence Transformers  (embeddings + cross-encoder reranker)
```

---

## Features

**Document Management**
- Upload PDF, DOCX, TXT, or PPTX files directly from any device
- Files are stored in Azure Blob Storage automatically
- Documents are chunked, embedded, and indexed into Pinecone by unique namespace
- Library page shows indexing status and chunk count per document

**AI Legal Research**
- Ask any legal question against a selected document
- Answers are grounded strictly in the uploaded source — no fabrication
- System identifies query type: definition, liability, obligation, summary, or clause analysis
- Each answer cites retrieved source excerpts with relevance scores
- Responses stream in real time, token by token

**Chat History**
- Every query and answer is persisted to MongoDB per user
- History page shows all past sessions with the full answer and sources
- Organized by document and timestamp

**Analytics**
- Queries per day (last 7 days) bar chart
- Most researched documents ranked by query count
- Documents by category pie chart
- Estimated time saved vs manual research

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, React Router v6 |
| State / Data | TanStack React Query, Axios |
| Backend gateway | Node.js, Express.js |
| Database | MongoDB Atlas, Mongoose |
| File storage | Azure Blob Storage |
| AI backend | FastAPI, Python |
| Vector store | Pinecone |
| LLM | Groq (llama-3.3-70b-versatile) |
| Embeddings | Sentence Transformers (all-MiniLM-L6-v2) |
| Reranker | Cross-Encoder (ms-marco-MiniLM-L-6-v2) |

---

## Project Structure

```
ai_backend - Copy/
├── main.py              # FastAPI app — /ingest and /query endpoints
├── src/
│   ├── config.py        # Environment variable loading
│   ├── loader.py        # PDF/DOCX/PPTX document loading
│   ├── chunker.py       # Text chunking
│   ├── summarizer.py    # AI content summarization
│   ├── embedder.py      # Sentence transformer embeddings
│   ├── vector_store.py  # Pinecone operations
│   ├── retriever.py     # Semantic search + reranker + LLM answer generation
│   └── pipeline.py      # End-to-end ingestion pipeline
│
├── server/              # Express.js API gateway
│   ├── index.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Document.js
│   │   └── QueryHistory.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── documents.js
│   │   ├── query.js
│   │   └── history.js
│   └── middleware/auth.js
│
└── client/              # React frontend
    └── src/
        ├── pages/
        │   ├── LandingPage.jsx
        │   ├── AuthPage.jsx
        │   ├── Dashboard.jsx
        │   ├── ResearchChat.jsx
        │   ├── DocumentLibrary.jsx
        │   └── Analytics.jsx
        ├── components/Layout.jsx
        ├── context/AuthContext.jsx
        └── lib/api.js
```

---

## Running Locally

### Prerequisites

- Node.js 18+
- Python 3.10+
- MongoDB Atlas account
- Pinecone account
- Groq API key
- Azure Blob Storage account

### 1. FastAPI Backend

```bash
cd "ai_backend - Copy"
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r req.txt
uvicorn main:app --reload --port 8000
```

The `.env` file in this directory must contain:

```
pine_corn_api=...
groq_api=...
connectionstring=...
blob_container=...
Mongo_URL=...
```

### 2. Express Server

```bash
cd server
npm install
node index.js
```

Runs on `http://localhost:5000`. Requires a `server/.env`:

```
MONGO_URI=...
JWT_SECRET=...
FASTAPI_URL=http://localhost:8000
PORT=5000
AZURE_CONNECTION_STRING=...
AZURE_CONTAINER=...
```

### 3. React Client

```bash
cd client
npm install
npm run dev
```

Runs on `http://localhost:5173` (or `5174` if port is taken).

---

## API Reference

### FastAPI

| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | /ingest | `{ url, book_name }` | Download, chunk, embed, and store a document |
| POST | /query | `{ book_name, query, top_k }` | Retrieve relevant chunks and generate a cited legal answer |

### Express Gateway

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /api/auth/register | No | Register new user |
| POST | /api/auth/login | No | Login, returns JWT |
| GET | /api/documents | Yes | List user's documents |
| POST | /api/documents | Yes | Upload file to Azure, trigger ingestion |
| DELETE | /api/documents/:id | Yes | Remove document |
| POST | /api/query | Yes | Query RAG, save to history |
| GET | /api/query/stream | Yes | Streaming query via SSE |
| GET | /api/history | Yes | Paginated query history |
| GET | /api/history/analytics/summary | Yes | Analytics aggregation |

---

## RAG Pipeline

1. User uploads a file from their browser
2. Express receives the file in memory via multer
3. File is uploaded to Azure Blob Storage, URL is returned
4. Express saves document metadata to MongoDB and calls FastAPI `/ingest`
5. FastAPI downloads the file, runs it through the loader, chunker, and summarizer
6. Chunks are embedded using Sentence Transformers and stored in Pinecone under the document's namespace
7. When a user submits a query, Express calls FastAPI `/query`
8. FastAPI performs semantic vector search in Pinecone, reranks results with a cross-encoder
9. Top-k chunks are formatted as legal context and passed to Groq (llama-3.3-70b)
10. The LLM generates a structured, cited legal answer
11. Express saves the query + answer + sources to MongoDB and returns the response to the client

---

## Environment Variables

| Variable | Location | Description |
|---|---|---|
| `pine_corn_api` | FastAPI `.env` | Pinecone API key |
| `groq_api` | FastAPI `.env` | Groq API key |
| `connectionstring` | FastAPI `.env` | Azure Blob connection string |
| `blob_container` | FastAPI `.env` | Azure container name |
| `Mongo_URL` | FastAPI `.env` | MongoDB Atlas URI |
| `MONGO_URI` | Server `.env` | MongoDB Atlas URI |
| `JWT_SECRET` | Server `.env` | JWT signing secret |
| `FASTAPI_URL` | Server `.env` | FastAPI base URL |
| `AZURE_CONNECTION_STRING` | Server `.env` | Azure Blob connection string |
| `AZURE_CONTAINER` | Server `.env` | Azure container name |

---

## Deployment

The three services can be deployed independently:

- **FastAPI** — Railway, Render, or Azure App Service (ensure Python 3.10+, install `req.txt`)
- **Express server** — Railway or Render (Node 18+)
- **React client** — Vercel (set `VITE_API_URL` env var to the deployed Express URL)

Update CORS origins in `server/index.js` and the base URL in `client/src/lib/api.js` before deploying.
