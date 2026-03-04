// netlify/functions/modelos.js
// Lista modelos por provedor

const MODELOS = {
  groq: [
    "llama-3.3-70b-versatile",
    "llama-3.1-70b-versatile",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
    "llama-3.1-8b-instant",
    "deepseek-r1-distill-llama-70b"
  ],
  gemini: [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-pro",
    "gemini-1.5-flash"
  ],
  openrouter: [
    "openrouter/free",
    "openrouter/optimus-alpha",
    "openrouter/quasar-alpha",
    "deepseek/deepseek-r1:free",
    "deepseek/deepseek-chat-v3-0324:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "openai/gpt-oss-120b:free",
    "qwen/qwen3-235b-a22b:free",
    "qwen/qwq-32b:free",
    "qwen/qwen2.5-coder-32b-instruct:free",
    "mistralai/mistral-small-3.1-24b-instruct:free",
    "mistralai/mistral-7b-instruct:free",
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "google/gemini-2.0-flash-001"
  ],
  scitely: [
    "deepseek-chat",
    "deepseek-reasoner",
    "qwen-plus",
    "qwen-max",
    "kimi-latest",
    "glm-4-flash",
    "llama-3.3-70b",
    "mixtral-8x7b"
  ],
  llmapi: [
    "gpt-4o-mini", "gpt-4o", "gpt-4.1-nano", "gpt-4.1-mini", "gpt-4.1",
    "gpt-5-nano", "gpt-5-mini", "gpt-5", "o3-mini", "o3",
    "claude-3-haiku-20240307", "claude-3-5-sonnet-20241022",
    "claude-3-7-sonnet-20250219",
    "gemini-2.0-flash", "gemini-2.5-flash",
    "qwen-max", "qwen-plus",
    "grok-3", "grok-3-mini"
  ],
  puter: [
    "gpt-5-nano", "gpt-5-mini", "gpt-5", "gpt-4.1-nano", "gpt-4o", "gpt-4o-mini",
    "claude-sonnet-4-5", "claude-haiku-4-5",
    "google/gemini-2.5-flash", "google/gemini-2.0-flash",
    "meta-llama/llama-3.3-70b-instruct",
    "deepseek/deepseek-chat-v3-0324", "deepseek/deepseek-r1",
    "mistralai/mistral-large-2512",
    "grok-4-1-fast", "grok-3",
    "z-ai/glm-5"
  ],
  custom: ["gpt-4o", "gpt-4o-mini", "claude-3-5-sonnet-20241022"]
};

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  // Pega o nome do provedor da query string ou path
  const fonte = event.queryStringParameters?.fonte ||
    event.path.split("/").pop() ||
    "groq";

  const modelos = MODELOS[fonte] || [];
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ modelos })
  };
};
