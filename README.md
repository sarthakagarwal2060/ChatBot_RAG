# Full-Stack RAG Applicatio

**🌟 Live Demo:** https://chatbotrag-rouge.vercel.app/

A comprehensive Retrieval-Augmented Generation (RAG) application that allows users to upload custom documents and chat with them using Large Language Models (LLMs).

## Features

- **📄 Document Upload**: Securely upload and store files (e.g., PDFs, text files) for the RAG pipeline.
- **🧠 Intelligent Retrieval**: Chunks, embeds, and retrieves relevant context from your documents to answer questions accurately.
- **💬 Conversational UI**: A sleek, responsive React frontend featuring a chat area, sidebar, and intuitive upload overlays.
- **⚡ Fast Setup**: Powered by Vite and Node.js for rapid development and lightning-fast performance.

## Tech Stack

**Backend**
- Node.js & Express (API Server)
- Custom RAG Pipeline (src/rag.js)
- File Handling (Uploads directory)

**Frontend**
- React
- Vite
- Modern CSS Layouts

## Project Structure

`	ext
RAG-1/
├── backend/
│   ├── package.json
│   ├── server.js          # Express app and API routes
│   ├── uploads/           # Directory for uploaded documents
│   └── src/
│       └── rag.js         # LLM integration, embeddings, and retrieval logic
└── frontend/
    ├── package.json
    ├── vite.config.js     # Vite configuration
    └── src/
        ├── App.jsx        # Root component
        └── components/
            ├── ChatArea.jsx       # Chat interface
            ├── Sidebar.jsx        # Navigation and document list
            └── UploadOverlay.jsx  # Drag-and-drop file upload UI
`

## Local Setup & Installation

Follow these instructions to run the application locally on your machine.

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- API Keys for your LLM and Embedding providers (e.g., OpenAI, Cohere)

### 1. Backend Setup

Open a terminal and navigate to the backend folder:

`ash
cd backend
npm install
`

Create a .env file in the ackend/ directory:
`env
PORT=5000
# Example API Keys for RAG
OPENAI_API_KEY=your_api_key_here
`

Start the backend server:
`ash
npm run start
# For development (if nodemon is installed): npm run dev
`

### 2. Frontend Setup

Open a new terminal and navigate to the frontend folder:

`ash
cd frontend
npm install
`

Create a .env file in the rontend/ directory (if needed):
`env
VITE_API_URL=http://localhost:5000
`

Start the development server:
`ash
npm run dev
`

## Usage

1. Open your browser to http://localhost:5173 (default Vite port).
2. Click the **Upload** button to add knowledge documents to your backend.
3. Start typing in the **Chat Area**. The system will contextually search your uploaded documents and generate an informed response based on the contents!

## License
MIT
//checking webhook
