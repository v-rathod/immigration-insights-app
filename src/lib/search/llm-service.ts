/**
 * LLM Service — Tier 3 of RAG architecture.
 *
 * Four backends (tried in order):
 *   1. **Groq** — free cloud LLM (Llama 3.3 70B via Groq LPU).
 *      Get a free API key at https://console.groq.com
 *      Set NEXT_PUBLIC_GROQ_API_KEY in .env.local
 *   2. **OpenAI** — production (GPT-4o-mini). Reserved for go-live.
 *      Set NEXT_PUBLIC_OPENAI_API_KEY in .env.local
 *   3. **Ollama** — free local LLM (llama3.2, etc.)
 *      Runs at http://localhost:11434
 *   4. **Mock** — zero-cost fallback, stitches pre-computed chunks.
 *
 * The LLM never searches anything itself — we retrieve relevant
 * chunks via Fuse.js (Tier 2), then hand them to the LLM as context.
 */

import type { SearchResult } from "./rag-search";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LlmRequest {
  query: string;
  context: SearchResult[];
}

export interface LlmResponse {
  answer: string;
  model: string;
  sources: string[];
  isMock: boolean;
}

export type LlmBackend = "groq" | "openai" | "ollama" | "mock";

// ---------------------------------------------------------------------------
// Configuration (via environment variables in .env.local)
// Next.js inlines process.env.NEXT_PUBLIC_* at compile time —
// do NOT wrap in typeof/ternary or the compiler won't substitute.
// ---------------------------------------------------------------------------

const GROQ_API_KEY: string = process.env.NEXT_PUBLIC_GROQ_API_KEY ?? "";
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";

const OPENAI_API_KEY: string = process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? "";
const OPENAI_BASE_URL = "https://api.openai.com/v1";
const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";

const OLLAMA_BASE_URL = "http://localhost:11434";
const OLLAMA_DEFAULT_MODEL = "llama3.2";

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an immigration data analyst for NorthStar Compass.
Answer the user's question based ONLY on the provided context.
If the context doesn't contain enough information, say so clearly.
Never make up statistics or dates. Cite the source artifacts when possible.
Keep answers concise (2-4 paragraphs max). Use plain language.`;

const OFF_TOPIC_SYSTEM_PROMPT = `You are NorthStar Compass, a U.S. employment-based immigration insights assistant.
The user asked a question that is NOT about immigration. Politely redirect them.
Mention the topics you CAN help with: priority dates, visa bulletins, employer sponsorship,
green card categories (EB1/EB2/EB3), salary benchmarks, processing times, and backlog estimates.
Keep it friendly, 2-3 sentences max.`;

function buildContextBlock(context: SearchResult[]): string {
  return context
    .map(
      (c, i) =>
        `[Source ${i + 1}: ${c.sources.join(", ")} | Topic: ${c.topic}]\n${c.content}`
    )
    .join("\n\n---\n\n");
}

// Used for future OpenAI integration reference
function buildPrompt(query: string, context: SearchResult[]): string {
  return `${SYSTEM_PROMPT}\n\n---\nCONTEXT:\n${buildContextBlock(context)}\n\n---\nUSER QUESTION: ${query}`;
}

// ---------------------------------------------------------------------------
// OpenAI-compatible API (works for Groq and OpenAI)
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionResponse {
  choices: Array<{
    message: { role: string; content: string };
  }>;
  model: string;
}

/** Call an OpenAI-compatible chat completions API */
async function openAiCompatibleChat(
  messages: ChatMessage[],
  baseUrl: string,
  apiKey: string,
  model: string
): Promise<ChatCompletionResponse> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM API error ${res.status}: ${text}`);
  }
  return res.json();
}

/** Get an answer from an OpenAI-compatible API (Groq or OpenAI) */
async function cloudLlmAnswer(
  request: LlmRequest,
  baseUrl: string,
  apiKey: string,
  model: string
): Promise<LlmResponse> {
  const { query, context } = request;
  const sources = [...new Set(context.flatMap((c) => c.sources))];

  const systemPrompt = context.length === 0 ? OFF_TOPIC_SYSTEM_PROMPT : SYSTEM_PROMPT;
  const userContent =
    context.length === 0
      ? query
      : `CONTEXT:\n${buildContextBlock(context)}\n\n---\nQUESTION: ${query}`;

  const resp = await openAiCompatibleChat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    baseUrl,
    apiKey,
    model
  );

  const answer = resp.choices[0]?.message?.content?.trim() ?? "No response generated.";

  return {
    answer,
    model: resp.model,
    sources: context.length === 0 ? [] : sources,
    isMock: false,
  };
}

// ---------------------------------------------------------------------------
// Ollama integration (local LLM — $0 cost)
// ---------------------------------------------------------------------------

let ollamaAvailable: boolean | null = null;

interface OllamaChatResponse {
  message: { role: string; content: string };
  done: boolean;
  model: string;
}

async function checkOllamaAvailable(): Promise<boolean> {
  if (ollamaAvailable !== null) return ollamaAvailable;
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    ollamaAvailable = res.ok;
  } catch {
    ollamaAvailable = false;
  }
  return ollamaAvailable;
}

async function ollamaAnswer(request: LlmRequest): Promise<LlmResponse> {
  const { query, context } = request;
  const sources = [...new Set(context.flatMap((c) => c.sources))];

  const systemPrompt = context.length === 0 ? OFF_TOPIC_SYSTEM_PROMPT : SYSTEM_PROMPT;
  const userContent =
    context.length === 0
      ? query
      : `CONTEXT:\n${buildContextBlock(context)}\n\n---\nQUESTION: ${query}`;

  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_DEFAULT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      stream: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }

  const resp: OllamaChatResponse = await res.json();
  return {
    answer: resp.message.content.trim(),
    model: resp.model,
    sources: context.length === 0 ? [] : sources,
    isMock: false,
  };
}

// ---------------------------------------------------------------------------
// Mock LLM (fallback when no real LLM is available)
// ---------------------------------------------------------------------------

function offTopicReply(query: string): string {
  const variations = [
    `Thanks for asking! However, I'm specifically designed to answer questions about U.S. immigration — topics like priority dates, visa bulletins, employer sponsorship, green card categories, salary benchmarks, and processing times. I wasn't able to find anything relevant to "${query}" in my immigration knowledge base. Feel free to ask me anything immigration-related and I'll do my best to help!`,
    `Great question, but this falls outside my area of expertise. I specialize in U.S. employment-based immigration data — think visa bulletins, EB category forecasts, employer sponsorship scores, and wage analysis. If you have any immigration-related questions, I'd love to help with those!`,
    `I appreciate your curiosity! My knowledge is focused on U.S. immigration topics such as priority date forecasts, sponsor reliability, processing times, and backlog estimates. "${query}" doesn't seem to be immigration-related, so I can't provide a meaningful answer. Try asking about green cards, H-1B visas, or employer sponsorship instead!`,
    `I'm NorthStar's immigration insights assistant, so I'm best at answering questions about visa bulletins, EB categories, employer sponsorship reliability, salary benchmarks, and processing timelines. I don't have information about "${query}" — but if you rephrase with an immigration angle, I might be able to help!`,
  ];
  return variations[Math.floor(Math.random() * variations.length)];
}

function mockLlmAnswer(request: LlmRequest): LlmResponse {
  const { query, context } = request;

  if (context.length === 0) {
    return {
      answer: offTopicReply(query),
      model: "mock-local",
      sources: [],
      isMock: true,
    };
  }

  const qaMatch = context.find((c) => c.type === "qa" && c.score > 0.6);
  if (qaMatch) {
    return {
      answer: qaMatch.content,
      model: "mock-local",
      sources: qaMatch.sources,
      isMock: true,
    };
  }

  const topChunks = context.filter((c) => c.type === "chunk").slice(0, 3);
  const allSources = [...new Set(topChunks.flatMap((c) => c.sources))];

  const intro = `Based on NorthStar Meridian data, here's what I found about "${query}":\n\n`;
  const body = topChunks
    .map((c) => {
      const sentences = c.content.split(/\.\s+/).slice(0, 2);
      return sentences.join(". ") + ".";
    })
    .join("\n\n");

  const footer =
    "\n\n*Note: This answer was generated from pre-computed data summaries. " +
    "Visit the relevant dashboard for interactive charts and detailed analysis.*";

  return {
    answer: intro + body + footer,
    model: "mock-local",
    sources: allSources,
    isMock: true,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Current LLM backend — resolved after first call */
let resolvedBackend: LlmBackend | null = null;

export function getLlmBackend(): LlmBackend | null {
  return resolvedBackend;
}

export function isLlmEnabled(): boolean {
  return resolvedBackend !== null && resolvedBackend !== "mock";
}

/**
 * Detect which backend is available.
 * Priority: Groq → OpenAI → Ollama → Mock
 */
export async function detectLlmBackend(): Promise<LlmBackend> {
  if (resolvedBackend !== null) return resolvedBackend;

  if (GROQ_API_KEY) {
    resolvedBackend = "groq";
    return "groq";
  }

  if (OPENAI_API_KEY) {
    resolvedBackend = "openai";
    return "openai";
  }

  if (await checkOllamaAvailable()) {
    resolvedBackend = "ollama";
    return "ollama";
  }

  resolvedBackend = "mock";
  return "mock";
}

/**
 * Get an LLM-generated answer using retrieved context.
 * Tries Groq → OpenAI → Ollama → Mock in order.
 */
export async function getLlmAnswer(request: LlmRequest): Promise<LlmResponse> {
  const backend = await detectLlmBackend();

  if (backend === "groq") {
    try {
      return await cloudLlmAnswer(request, GROQ_BASE_URL, GROQ_API_KEY, GROQ_DEFAULT_MODEL);
    } catch (err) {
      console.warn("[LLM] Groq call failed, falling back:", err);
      // Try next backend
      if (OPENAI_API_KEY) {
        resolvedBackend = "openai";
        return cloudLlmAnswer(request, OPENAI_BASE_URL, OPENAI_API_KEY, OPENAI_DEFAULT_MODEL);
      }
    }
  }

  if (backend === "openai") {
    try {
      return await cloudLlmAnswer(request, OPENAI_BASE_URL, OPENAI_API_KEY, OPENAI_DEFAULT_MODEL);
    } catch (err) {
      console.warn("[LLM] OpenAI call failed, falling back:", err);
    }
  }

  if (backend === "ollama") {
    try {
      return await ollamaAnswer(request);
    } catch (err) {
      console.warn("[LLM] Ollama call failed, falling back to mock:", err);
      resolvedBackend = "mock";
    }
  }

  // Mock fallback
  await new Promise((resolve) => setTimeout(resolve, 800));
  return mockLlmAnswer(request);
}

// Keep buildPrompt referenced for future use
void buildPrompt;
