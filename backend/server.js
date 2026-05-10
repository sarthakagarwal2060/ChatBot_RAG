import "dotenv/config";
import express from "express";
import multer from "multer";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { indexDocument, queryDocument } from "./src/rag.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({
  dest: uploadsDir,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if ([".pdf", ".txt"].includes(ext)) cb(null, true);
    else cb(new Error("Only PDF and TXT files are supported"));
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

const documents = new Map();

app.post("/api/upload", (req, res, next) => {
  upload.single("file")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const docId = crypto.randomUUID();
      const ext = path.extname(req.file.originalname).toLowerCase();
      const newPath = req.file.path + ext;
      fs.renameSync(req.file.path, newPath);

      const collectionName = `doc_${docId.replace(/-/g, "_")}`;
      const chunkCount = await indexDocument(newPath, req.file.originalname, collectionName);

      const doc = {
        id: docId,
        filename: req.file.originalname,
        collectionName,
        chunkCount,
        uploadedAt: new Date().toISOString(),
      };
      documents.set(docId, doc);

      try { fs.unlinkSync(newPath); } catch {}

      res.json({ success: true, document: doc });
    } catch (error) {
      console.error("Upload error:", error?.message || error);
      console.error(error?.stack || "");
      res.status(500).json({ error: error.message });
    }
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { query, documentId } = req.body;
    if (!query || !documentId)
      return res.status(400).json({ error: "query and documentId are required" });

    const doc = documents.get(documentId);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    const result = await queryDocument(query, doc.collectionName);
    res.json(result);
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`RAG NotebookLM is running on port ${PORT}`);
});
