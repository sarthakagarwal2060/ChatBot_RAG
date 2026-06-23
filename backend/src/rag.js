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
    if (!json.data || !Array.isArray(json.data)) {
      console.error("[Embedding] Unexpected API response:", JSON.stringify(json).substring(0, 500));
      throw new Error(`Embedding API returned malformed response (missing 'data' array)`);
    }
    return json.data
      .sort((a, b) => a.index - b.index)
      .map(d => d.embedding);
  }

  async embedDocuments(texts) { return this._embed(texts); }
  async embedQuery(text)      { return (await this._embed([text]))[0]; }
}

const embeddings = new OpenRouterEmbeddings();

const GENERATION_MODEL = "llama-3.3-70b-versatile";   // Groq — powerful, for final answer
const SLM_MODEL = "llama-3.1-8b-instant";              // Groq — fast, for rewriting & judging

const client = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY,
  fetch: globalThis.fetch,
});

const MAX_CORRECTIVE_ITERATIONS = 2;

// ─── Indexing Pipeline (unchanged) ───────────────────────────────────────────

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
    // chunkOverlap: 190,
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

// ─── Step 1: Query Translation (Rewriting) ───────────────────────────────────
// Fix typos, add contextual detail, make the query more precise for embedding.

async function rewriteQuery(originalQuery, feedback = null) {
  let prompt = `You are a query rewriting assistant. Your job is to take a user's search query and rewrite it to be more effective for semantic search against a document.

Rules:
- Fix any typos or spelling mistakes
- Expand abbreviations
- Add relevant contextual keywords that would help find the right document sections
- Keep the rewritten query concise (1-3 sentences max)
- Return ONLY the rewritten query, nothing else

User's original query: "${originalQuery}"`;

  if (feedback) {
    prompt += `\n\nAdditional context: A previous search with a rewritten query retrieved some irrelevant chunks. Here is what was NOT relevant:\n${feedback}\n\nPlease rewrite the query differently to avoid retrieving similar irrelevant content.`;
  }

  console.log(`[Query Translation] Rewriting query...`);

  const response = await client.chat.completions.create({
    model: SLM_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  });

  const rewritten = response.choices[0].message.content.trim();
  console.log(`[Query Translation] Original: "${originalQuery}"`);
  console.log(`[Query Translation] Rewritten: "${rewritten}"`);
  return rewritten;
}

// ─── Step 2: LLM as a Judge ─────────────────────────────────────────────────
// Validate whether each retrieved chunk is relevant to the ORIGINAL user query.

async function judgeChunks(originalQuery, chunks) {
  if (chunks.length === 0) return { good: [], bad: [] };

  const chunkDescriptions = chunks
    .map((chunk, i) => `Chunk ${i + 1}:\n${chunk.pageContent.substring(0, 500)}`)
    .join("\n\n");

  const prompt = `You are a relevance judge. Given a user's query and a list of document chunks, determine which chunks are relevant to answering the query.

User's query: "${originalQuery}"

${chunkDescriptions}

For each chunk, respond with ONLY a JSON array of objects like:
[{"chunk": 1, "relevant": true}, {"chunk": 2, "relevant": false}]

Return ONLY the JSON array, no other text.`;

  console.log(`[LLM Judge] Evaluating ${chunks.length} chunks for relevance...`);

  const response = await client.chat.completions.create({
    model: SLM_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
  });

  const rawResponse = response.choices[0].message.content.trim();

  let judgments;
  try {
    // Extract JSON from the response (handle markdown code blocks)
    const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
    judgments = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch (e) {
    console.warn(`[LLM Judge] Failed to parse judgment, treating all chunks as good`);
    return { good: chunks, bad: [] };
  }

  const good = [];
  const bad = [];

  for (const judgment of judgments) {
    const idx = judgment.chunk - 1;
    if (idx >= 0 && idx < chunks.length) {
      if (judgment.relevant) {
        good.push(chunks[idx]);
      } else {
        bad.push(chunks[idx]);
      }
    }
  }

  console.log(`[LLM Judge] Result: ${good.length} good chunks, ${bad.length} bad chunks`);
  return { good, bad };
}

// ─── Main Query Pipeline (Corrective RAG) ────────────────────────────────────

export async function queryDocument(userQuery, collectionName) {
  const vectorStore = await QdrantVectorStore.fromExistingCollection(
    embeddings,
    {
      url: process.env.QDRANT_URL || "http://localhost:6333",
      apiKey: process.env.QDRANT_API_KEY,
      collectionName,
    }
  );

  const retriever = vectorStore.asRetriever({ k: 5 });

  // Deduplicate chunks across iterations using content hash
  const seenChunks = new Set();
  const allGoodChunks = [];
  let rewrittenQuery = "";
  let iterations = 0;
  let feedback = null;

  // ── Corrective RAG Loop ──
  for (let i = 0; i < MAX_CORRECTIVE_ITERATIONS; i++) {
    iterations = i + 1;
    console.log(`\n── Corrective RAG Iteration ${iterations} ──`);

    // Step 1: Query Translation
    rewrittenQuery = await rewriteQuery(userQuery, feedback);

    // Step 2: Retrieve chunks using rewritten query
    const searchedChunks = await callWithRetry(
      () => retriever.invoke(rewrittenQuery),
      "Vector Retrieval"
    );
    console.log(`[Retrieval] Got ${searchedChunks.length} chunks from vector search`);

    // Deduplicate against previously seen chunks
    const newChunks = searchedChunks.filter((chunk) => {
      const key = chunk.pageContent.substring(0, 200);
      if (seenChunks.has(key)) return false;
      seenChunks.add(key);
      return true;
    });

    if (newChunks.length === 0) {
      console.log(`[Corrective RAG] No new chunks found, stopping loop`);
      break;
    }

    // Step 3: LLM as a Judge — check relevance against ORIGINAL query
    const { good, bad } = await judgeChunks(userQuery, newChunks);
    allGoodChunks.push(...good);

    // If no bad chunks, the retrieval was clean — stop the loop
    if (bad.length === 0) {
      console.log(`[Corrective RAG] All chunks are relevant, stopping loop`);
      break;
    }

    // Build feedback for corrective rewrite
    feedback = bad
      .map((chunk) => `- "${chunk.pageContent.substring(0, 200)}..."`)
      .join("\n");
    console.log(`[Corrective RAG] Found ${bad.length} irrelevant chunks, will rewrite query`);
  }

  // If somehow no good chunks survived, fall back to a direct search
  if (allGoodChunks.length === 0) {
    console.log(`[Fallback] No good chunks after corrective RAG, using direct search`);
    const fallbackChunks = await retriever.invoke(userQuery);
    allGoodChunks.push(...fallbackChunks);
  }

  console.log(`\n[Generation] Using ${allGoodChunks.length} verified chunks for answer generation`);

  // ── Final Generation ──
  const system_prompt = `You are an AI Assistant who helps resolving the user query based on the available context provided to you from a document with the content and page number.
      Rules:
      - Only answer based on the available context from the document.
      - If the context does not contain enough information to answer, say so clearly.

      context : ${JSON.stringify(allGoodChunks)}`;

  const response = await client.chat.completions.create({
    model: GENERATION_MODEL,
    messages: [
      { role: "system", content: system_prompt },
      { role: "user", content: userQuery },
    ],
  });

  return {
    answer: response.choices[0].message.content,
    rewrittenQuery,
    iterations,
    sources: allGoodChunks.map((chunk, i) => ({
      index: i + 1,
      page: chunk.metadata?.loc?.pageNumber || null,
      content: chunk.pageContent.substring(0, 300),
    })),
  };
}
