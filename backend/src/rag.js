import "dotenv/config";
import fs from "fs";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Embeddings } from "@langchain/core/embeddings";
import { QdrantVectorStore } from "@langchain/qdrant";
import { Document } from "@langchain/core/documents";
import { OpenAI } from "openai";

class OpenRouterEmbeddings extends Embeddings {
  constructor() {
    super({});
    this.apiKey  = process.env.OPENROUTER_API_KEY;
    this.model   = "nvidia/llama-nemotron-embed-vl-1b-v2:free";
    this.baseURL = "https://openrouter.ai/api/v1";
  }

  async _embed(texts) {
    const res = await fetch(`${this.baseURL}/embeddings`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Embedding API error ${res.status}: ${err}`);
    }
    const json = await res.json();
    return json.data
      .sort((a, b) => a.index - b.index)
      .map(d => d.embedding);
  }

  async embedDocuments(texts) { return this._embed(texts); }
  async embedQuery(text)      { return (await this._embed([text]))[0]; }
}

const embeddings = new OpenRouterEmbeddings();

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function indexDocument(filePath, filename, collectionName) {
  let rawDocs;

  if (filePath.endsWith(".pdf")) {
    const loader = new PDFLoader(filePath);
    rawDocs = await loader.load();
  } else {
    const text = fs.readFileSync(filePath, "utf-8");
    rawDocs = [
      new Document({
        pageContent: text,
        metadata: { source: filename },
      }),
    ];
  }

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const docs = await textSplitter.splitDocuments(rawDocs);

  console.log(`Loaded ${filename} and split it into ${docs.length} chunks`);

  const vectorStore = await QdrantVectorStore.fromDocuments(docs, embeddings, {
    url: process.env.QDRANT_URL || "http://localhost:6333",
    apiKey: process.env.QDRANT_API_KEY,
    collectionName,
  });

  console.log("Indexing completed");
  return docs.length;
}

export async function queryDocument(userQuery, collectionName) {
  const vectorStore = await QdrantVectorStore.fromExistingCollection(
    embeddings,
    {
      url: process.env.QDRANT_URL || "http://localhost:6333",
      apiKey: process.env.QDRANT_API_KEY,
      collectionName,
    }
  );

  const retriever = vectorStore.asRetriever({ k: 3 });
  const searchedChunks = await retriever.invoke(userQuery);

  const system_prompt = `You are an AI Assistant who helps resolving the user query based on the avaliable context provided to you from PDF file with the content and page number.
      Rule :
      - Only answer based on the avaliable context from the file only.

      context : ${JSON.stringify(searchedChunks)}`;

  const response = await client.chat.completions.create({
    model: "openai/gpt-oss-120b:free",
    messages: [
      { role: "system", content: system_prompt },
      { role: "user", content: userQuery },
    ],
  });

  return {
    answer: response.choices[0].message.content,
    sources: searchedChunks.map((chunk, i) => ({
      index: i + 1,
      page: chunk.metadata?.loc?.pageNumber || null,
      content: chunk.pageContent.substring(0, 300),
    })),
  };
}

