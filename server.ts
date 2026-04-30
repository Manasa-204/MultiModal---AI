import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import pdf from "pdf-parse";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { StateGraph, START, END } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Document } from "@langchain/core/documents";

// Initialize AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Ensure uploads directory exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
  modelName: "gemini-1.5-flash",
  maxRetries: 2,
});
const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GEMINI_API_KEY,
  modelName: "embedding-001",
});

// Simple In-Memory Vector Store
const vectorStore = new MemoryVectorStore(embeddings);

// Simple Knowledge Graph logic
// Nodes: concept names. Edges: related_to relation
const knowledgeGraph: Record<string, string[]> = {
  "Neural Networks": ["Backpropagation", "Neurons", "Activation Functions", "Layers"],
  "Backpropagation": ["Gradients", "Chain Rule", "Loss Function", "Weight Update"],
  "CNN": ["Convolution", "Pooling", "Feature Maps", "Computer Vision"],
  "Deep Learning": ["Neural Networks", "SGD", "Optimization", "Machine Learning"],
  "Activation Functions": ["ReLU", "Sigmoid", "Softmax", "Tanh"],
};

// --- LangGraph Definitions ---

const TutorState = Annotation.Root({
  query: Annotation<string>(),
  intent: Annotation<"explanation" | "summary" | "quiz">(),
  context: Annotation<string[]>(),
  graphConcepts: Annotation<string[]>(),
  modality: Annotation<"text" | "image" | "audio">(),
  files: Annotation<any[]>(),
  response: Annotation<string>(),
});

// Node: Classification
const classifierNode = async (state: typeof TutorState.State) => {
  const prompt = `Classify this academic query into one of these intents: explanation, summary, quiz. Query: ${state.query}`;
  const res = await model.invoke(prompt);
  const text = res.content.toString().toLowerCase();
  let intent: "explanation" | "summary" | "quiz" = "explanation";
  if (text.includes("summary")) intent = "summary";
  else if (text.includes("quiz")) intent = "quiz";
  return { intent };
};

// Node: Retrieval
const retrieverNode = async (state: typeof TutorState.State) => {
  const results = await vectorStore.similaritySearch(state.query, 3);
  const context = results.map(r => r.pageContent);
  
  // Graph expansion
  const words = state.query.split(" ");
  const related = new Set<string>();
  for (const word of words) {
    const cleanWord = word.replace(/[?,.!]/g, "");
    if (knowledgeGraph[cleanWord]) {
      knowledgeGraph[cleanWord].forEach(c => related.add(c));
    }
  }

  return { 
    context, 
    graphConcepts: Array.from(related) 
  };
};

// Node: Generation
const generatorNode = async (state: typeof TutorState.State) => {
  const contextStr = state.context.join("\n\n");
  const graphStr = state.graphConcepts.length > 0 
    ? `\nRelated concepts to explore: ${state.graphConcepts.join(", ")}` 
    : "";
  
  let systemPrompt = "";
  if (state.intent === "summary") {
    systemPrompt = "You are an academic tutor. Summarize the provided context clearly.";
  } else if (state.intent === "quiz") {
    systemPrompt = "You are an academic tutor. Generate 3 multiple choice questions based on the context.";
  } else {
    systemPrompt = "You are an academic tutor. Explain the topic in detail using the context.";
  }

  const userPrompt = `Context: ${contextStr}\n\nQuery: ${state.query}${graphStr}`;
  const res = await model.invoke([["system", systemPrompt], ["user", userPrompt]]);
  return { response: res.content.toString() };
};

// Compile Graph
const workflow = new StateGraph(TutorState)
  .addNode("classifier", classifierNode)
  .addNode("retriever", retrieverNode)
  .addNode("generator", generatorNode)
  .addEdge(START, "classifier")
  .addEdge("classifier", "retriever")
  .addEdge("retriever", "generator")
  .addEdge("generator", END);

const appletAgent = workflow.compile();

// --- Server Setup ---

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  const upload = multer({ dest: "uploads/" });

  // API: Upload Materials
  app.post("/api/upload", upload.array("files"), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) return res.status(400).json({ error: "No files uploaded" });

      for (const file of files) {
        if (file.mimetype === "application/pdf") {
          const dataBuffer = fs.readFileSync(file.path);
          const data = await pdf(dataBuffer);
          const docs = [new Document({ pageContent: data.text, metadata: { source: file.originalname } })];
          await vectorStore.addDocuments(docs);
        } else if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("audio/")) {
          // In a real multi-modal app, we'd describe or embed the image/audio
          // For this demo, we'll use Gemini to describe it and store description
          const genModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          const fileData = fs.readFileSync(file.path);
          const result = await genModel.generateContent([
            "Describe this diagram or audio content for academic study.",
            { inlineData: { data: fileData.toString("base64"), mimeType: file.mimetype } }
          ]);
          const description = result.response.text();
          await vectorStore.addDocuments([new Document({ pageContent: description, metadata: { source: file.originalname } })]);
        }
        // Cleanup local file
        fs.unlinkSync(file.path);
      }

      res.json({ message: "Files processed and indexed successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to process files" });
    }
  });

  // API: Query Tutor
  app.post("/api/query", async (req, res) => {
    const { query } = req.body;
    try {
      const result = await appletAgent.invoke({ query });
      res.json({
        answer: result.response,
        intent: result.intent,
        related: result.graphConcepts,
        contextUsed: result.context.length > 0
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Agent execution failed" });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
