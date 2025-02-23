import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import path from "node:path";
import { CharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { TaskType } from "@google/generative-ai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import util from "node:util";

// Load environment variables
config();

// System prompts
export const systemPrompts: Record<string, string> = {
  normal: `
    You are a creative domain name assistant built to help users find unique, memorable domain names.
    Use the context from the "Creative Domain Naming Guide" to suggest names.
    Rules: Combine unexpected words, invent new terms, avoid clichés like "app" or "online," keep it short and pronounceable.
    Suggest 3 domain names with ".com" and explain each in 1-2 sentences.
    Format your response as a JSON object per the required structure.
  `,
  deepthink: `
    You are an inventive domain name architect crafting extraordinary names.
    Reflect on the user’s project essence and use the "Creative Domain Naming Guide" context to inspire.
    Suggest 3 ".com" names with 2-3 sentence explanations.
    Format your response as a JSON object per the required structure.
  `,
};

// Interface for constructor args
interface IMain {
  model: string;
  pdfDocument: string;
  chunkSize: number;
  chunkOverlap: number;
  searchType?: "similarity" | "mmr";
  kDocuments: number;
}

class Main {
  private model: string;
  private pdfDocument: string;
  private chunkSize: number;
  private chunkOverlap: number;
  private searchType: "similarity" | "mmr" | undefined;
  private kDocuments: number;
  private llm: ChatGoogleGenerativeAI;
  private document: any[] | null = null;
  private texts: any[] | null = null;
  private db: MemoryVectorStore | null = null;
  private selectEmbedding = new GoogleGenerativeAIEmbeddings({
    model: "text-embedding-004",
    taskType: TaskType.RETRIEVAL_DOCUMENT,
    title: "Document title",
    apiKey: process.env.GOOGLE_API_KEY as string, // Added API key here
  });
  private retriever: any | null = null;
  private systemPrompts: Record<string, string>;
  private chain: any | null = null;
  private outputParser = StructuredOutputParser.fromZodSchema(
    z.object({
      intro: z.string().min(20),
      suggestions: z.array(
        z.object({
          domain: z.string(),
          explanation: z.string().min(10),
        })
      ).length(3),
      outro: z.string().min(20),
    })
  );
  private formatInstructions: string;

  constructor({ model, pdfDocument, chunkSize, chunkOverlap, searchType = "similarity", kDocuments }: IMain) {
    this.model = model;
    this.pdfDocument = pdfDocument;
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
    this.searchType = searchType;
    this.kDocuments = kDocuments;
    this.systemPrompts = systemPrompts;
    console.log("Init chat model");
    this.llm = new ChatGoogleGenerativeAI({
      model: this.model,
      temperature: 0.5,
      maxRetries: 2,
      apiKey: process.env.GOOGLE_API_KEY as string,
    });
    this.formatInstructions = this.outputParser.getFormatInstructions();
  }

  async init(): Promise<this> {
    try {
      await this.loadDocument();
      await this.splitDocument();
      await this.createVectorStore();
      this.createRetriever();
      this.chain = await this.createChain();
      return this;
    } catch (error) {
      console.error("Initialization failed:", error);
      throw error;
    }
  }

  private async loadDocument(): Promise<void> {
    console.log("Loading document...");
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const pdfPath = path.join(__dirname, this.pdfDocument);
    const pdfLoader = new PDFLoader(pdfPath);
    this.document = await pdfLoader.load();
    if (!this.document || this.document.length === 0) {
      throw new Error("Failed to load PDF document or document is empty.");
    }
  }

  private async splitDocument(): Promise<void> {
    if (!this.document) {
      throw new Error("No document loaded to split.");
    }
    console.log("Splitting document...");
    const textSplitter = new CharacterTextSplitter({
      separator: " ",
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
    });
    this.texts = await textSplitter.splitDocuments(this.document);
    if (!this.texts || this.texts.length === 0) {
      throw new Error("Failed to split document into chunks.");
    }
  }

  private async createVectorStore(): Promise<void> {
    if (!this.texts) {
      throw new Error("No text chunks available to create vector store.");
    }
    console.log("Creating document embeddings...");
    this.db = await MemoryVectorStore.fromDocuments(this.texts, this.selectEmbedding);
    if (!this.db) {
      throw new Error("Failed to create vector store.");
    }
  }

  private createRetriever(): void {
    if (!this.db) {
      throw new Error("Vector store not initialized; cannot create retriever.");
    }
    console.log("Creating retriever...");
    this.retriever = this.db.asRetriever({
      k: this.kDocuments,
      searchType: this.searchType,
    });
  }

  public getUpdatedSystemPrompt(type: string): string {
    return `${this.systemPrompts[type]}\n\nRequired output format:\n${this.formatInstructions}`;
  }

  private async createChain(): Promise<any> {
    if (!this.retriever) {
      throw new Error("Retriever not initialized; cannot create chain.");
    }
    console.log("Creating retrieval QA chain...");
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "{systemPrompt}\n\nContext from guide: {context}"],
      ["human", "{input}"],
    ]);

    const combineDocsChain = await createStuffDocumentsChain({
      llm: this.llm,
      prompt,
      outputParser: this.outputParser, // Added output parser here
    });

    const chain = await createRetrievalChain({
      combineDocsChain,
      retriever: this.retriever,
    });

    return chain;
  }

  queryChain(): any {
    if (!this.chain) {
      throw new Error("Chain not initialized; call init() first.");
    }
    return this.chain;
  }
}

(async () => {
  const pdfDocument = "../material/naming-guide.pdf";

  try {
    const chat = await new Main({
      model: "gemini-1.5-flash",
      pdfDocument,
      chunkSize: 1000,
      chunkOverlap: 0,
      searchType: "similarity",
      kDocuments: 3,
    }).init();

    const chatChain = chat.queryChain();

    const answer1 = await chatChain.invoke({
      input: "I am building a new app that helps people find the best restaurants in their area.",
      systemPrompt: chat.getUpdatedSystemPrompt("normal"),
    });
    console.log("Answer:", util.inspect(answer1, { depth: null, colors: true }));
  } catch (error) {
    console.error("Error during execution:", error);
  }
})();