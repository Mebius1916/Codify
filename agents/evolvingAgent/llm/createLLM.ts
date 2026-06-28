import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export interface CreateLLMParams {
  model: string;
  apiKey: string;
  baseUrl?: string;
  temperature: number;
  timeout?: number;
}

export function createLLM(params: CreateLLMParams): BaseChatModel {
  return new ChatGoogleGenerativeAI({
    model: params.model,
    apiKey: params.apiKey,
    baseUrl: params.baseUrl,
    temperature: params.temperature,
    thinkingConfig: {
      includeThoughts: false,
      thinkingLevel: "LOW",
    },
  });
}
