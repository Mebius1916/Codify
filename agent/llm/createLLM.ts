import { ChatOpenAI } from "@langchain/openai";

export interface CreateLLMParams {
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  timeout?: number;
}

export function createLLM(params: CreateLLMParams) {
  return new ChatOpenAI({
    apiKey: params.apiKey,
    model: params.model,
    configuration: { baseURL: params.baseUrl },
    temperature: params.temperature,
    timeout: params.timeout,
  });
}
