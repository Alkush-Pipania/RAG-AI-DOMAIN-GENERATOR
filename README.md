# RAG AI Domain Name Generator

Hey there! This is a fun little project I whipped up—a domain name generator that uses Retrieval-Augmented Generation (RAG) to come up with creative, unique .com names. It’s built from scratch using **LangChain.js**, powered by **Google Gemini 1.5 Flash**, and leans on **Text Embedding 003** for embedding and vector search. The goal? To suggest domain names that stand out, inspired by a "Creative Domain Naming Guide" PDF.

## What It Does
- Takes a user input (like "an app for finding restaurants") and digs into the naming guide for context.
- Uses RAG to blend that context with AI creativity.
- Spits out 3 unique .com domain name suggestions, each with a short explanation.
- Keeps things short, pronounceable, and avoids boring clichés like "app" or "online."

## Tech Stack
- **LangChain.js**: The backbone for building the RAG pipeline.
- **Google Gemini 1.5 Flash**: The AI model driving the name generation.
- **Text Embedding 003**: Handles embeddings and vector search to pull relevant bits from the guide.
- **TypeScript**: Keeps the code clean and maintainable.
- **Node.js**: Runs the whole thing.

## How It Works
1. Loads the "Creative Domain Naming Guide" PDF (you’ll need to add your own copy in `backend/material/`).
2. Splits the PDF into chunks and creates a vector store using `MemoryVectorStore`.
3. Uses a retrieval chain to grab relevant context from the guide based on your input.
4. Feeds that into a prompt with Gemini 1.5 Flash to generate 3 domain names in a neat JSON format.

## Getting Started

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **Google API Key** (for Gemini access—set it in a `.env` file)
- A PDF file named `naming-guide.pdf` in `backend/material/` (not included here, add your own!)

