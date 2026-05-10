# 📚 RAG NotebookLM — Chat with Your Documents

A full **RAG (Retrieval-Augmented Generation)** pipeline that lets you upload any PDF or text document and have AI-powered conversations grounded entirely in the document's content — just like Google NotebookLM.

---

## ✨ Features

- **Upload Documents** — PDF or TXT files via web UI
- **Page-Based Chunking** — PDFLoader splits each PDF page into a separate chunk
- **Vector Search** — Qdrant-powered semantic similarity search with OpenAI embeddings
- **Grounded Answers** — LLM answers strictly from document content via OpenRouter
- **Source Citations** — Every answer shows which chunks/pages were used
- **Multi-Document** — Upload and switch between multiple documents
- **Premium Dark UI** — Glassmorphism, animations, and modern design

---

## 🏗️ Architecture & RAG Pipeline

```
User Upload ──► PDFLoader (page-based chunking) ──► OpenAI Embeddings (text-embedding-3-large)
                                                              │
                                                       Qdrant Vector DB
                                                              │
User Question ──► Embed Query ──► Qdrant Similarity Search (k=3)
                                                              │
                                                   OpenRouter LLM (with context)
                                                              │
                                                    Grounded Answer + Sources
```

### Pipeline Stages

| Stage         | Technology                          | Description                                    |
|---------------|-------------------------------------|------------------------------------------------|
| **Ingestion** | LangChain `PDFLoader`               | Loads PDF files, 1 document per page            |
| **Chunking**  | `PDFLoader` built-in page splitting | Each page becomes one chunk with page metadata  |
| **Embedding** | OpenAI `text-embedding-3-large`     | High-dimensional vector embeddings via `@langchain/openai` |
| **Storage**   | Qdrant Vector Database              | `QdrantVectorStore.fromDocuments()` stores all chunks |
| **Retrieval** | Qdrant similarity search (k=3)      | `vectorStore.asRetriever({ k: 3 })` finds top 3 chunks |
| **Generation**| OpenRouter (OpenAI SDK)             | LLM generates answer using `JSON.stringify(searchedChunks)` as context |

---

## 📐 Chunking Strategy

### Page-Based Chunking via PDFLoader

The chunking strategy uses **LangChain's `PDFLoader`**, which automatically splits a PDF into one chunk per page. Each chunk retains metadata including:

- `source` — original filename
- `loc.pageNumber` — the page number in the PDF

**Why this strategy?**
- **Natural document boundaries** — pages are a natural unit of information in PDFs
- **Preserves page context** — each chunk maps to a specific page, making citations meaningful
- **Simple and reliable** — no risk of splitting mid-sentence or mid-paragraph
- **Metadata-rich** — page numbers allow precise source attribution

For **TXT files**, the entire file content is loaded as a single document chunk.

---

## 🚀 Setup Instructions

### Prerequisites

- **Node.js** ≥ 18
- **Docker** (for running Qdrant locally)
- **OpenAI API Key** — for embeddings (`text-embedding-3-large`)
- **OpenRouter API Key** — for LLM generation

### 1. Start Qdrant (Docker)

```bash
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

### 2. Install Dependencies

```bash
cd RAG-1
npm install
```

### 3. Configure Environment

Edit `.env` with your API keys:

```env
OPENAI_API_KEY=sk-your-openai-key
OPENROUTER_API_KEY=sk-or-your-openrouter-key
LLM_MODEL=google/gemini-2.0-flash-001
QDRANT_URL=http://localhost:6333
```

### 4. Run the Application

```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## 📖 Usage

1. **Upload** — Click "Upload Document" and select a PDF or TXT file
2. **Wait** — The system chunks, embeds, and indexes into Qdrant
3. **Chat** — Select the document and ask natural language questions
4. **Sources** — Click source chips to see the exact text chunks used

---

## 🗂️ Project Structure

```
RAG-1/
├── server.js           # Express server with REST API routes
├── src/
│   └── rag.js          # Core RAG pipeline (index + retrieve + generate)
├── public/
│   ├── index.html      # Frontend UI
│   ├── style.css       # Premium dark theme
│   └── app.js          # Frontend logic
├── uploads/            # Temporary file uploads
├── package.json
├── .env                # API keys and config
├── .gitignore
└── README.md
```

---

## 🛠️ Tech Stack

| Component   | Technology                          |
|-------------|-------------------------------------|
| Backend     | Node.js + Express                   |
| Frontend    | Vanilla HTML / CSS / JavaScript     |
| Vector DB   | **Qdrant**                          |
| Embeddings  | OpenAI `text-embedding-3-large` via `@langchain/openai` |
| LLM         | **OpenRouter** (via OpenAI SDK)     |
| PDF Parsing | LangChain `PDFLoader` + `pdf-parse` |

---

## 📝 API Endpoints

| Method   | Endpoint              | Description                      |
|----------|-----------------------|----------------------------------|
| `POST`   | `/api/upload`         | Upload & index a document        |
| `POST`   | `/api/chat`           | Ask a question about a document  |
| `GET`    | `/api/documents`      | List all indexed documents       |
| `DELETE` | `/api/documents/:id`  | Delete a document and its index  |
