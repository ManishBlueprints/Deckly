export const AI_PROVIDER_NAME = "openrouter";
export const AI_CHAT_COMPLETIONS_URL =
  "https://openrouter.ai/api/v1/chat/completions";

export const AI_SUMMARY_MODEL_IDENTIFIER = "openai/gpt-oss-120b:free";
export const AI_SUMMARY_MODEL_VERSION =
  "summary-openrouter-gpt-oss-120b-free-v1";

export const AI_CHAT_MODEL_IDENTIFIER = "openai/gpt-oss-120b:free";
export const AI_CHAT_MODEL_VERSION = "chat-openrouter-gpt-oss-120b-free-v1";

export const AI_EMBEDDING_MODEL_IDENTIFIER =
  "nvidia/llama-nemotron-embed-vl-1b-v2:free";
export const AI_EMBEDDING_MODEL_VERSION =
  "embedding-openrouter-llama-nemotron-embed-vl-1b-v2-free-v1";

// Current pgvector schema is VECTOR(1536), so active embeddings must match 1536
// dimensions unless a migration updates the column and dependent logic.
export const AI_EMBEDDING_VECTOR_DIMENSIONS = 1536;

export const AI_CONFIG = {
  provider: {
    name: AI_PROVIDER_NAME,
    chatCompletionsUrl: AI_CHAT_COMPLETIONS_URL,
  },
  summary: {
    modelIdentifier: AI_SUMMARY_MODEL_IDENTIFIER,
    modelVersion: AI_SUMMARY_MODEL_VERSION,
  },
  chat: {
    modelIdentifier: AI_CHAT_MODEL_IDENTIFIER,
    modelVersion: AI_CHAT_MODEL_VERSION,
  },
  embeddings: {
    modelIdentifier: AI_EMBEDDING_MODEL_IDENTIFIER,
    modelVersion: AI_EMBEDDING_MODEL_VERSION,
    vectorDimensions: AI_EMBEDDING_VECTOR_DIMENSIONS,
  },
} as const;
