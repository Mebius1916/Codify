import { createAgent, type AnyAgentMiddleware } from "langchain";

import type {
  RunSourceAgentInput,
  RunSourceAgentResult,
} from "./interfaces/index.js";
import { createReadyCodeGraph } from "./runtime/bootstrap/codeGraphRuntime.js";
import { createLLM } from "./llm/createLLM.js";
import { formatCodeGraphStats } from "./runtime/profile/codeGraphStats.js";
import { createContextCompressionMiddleware } from "./runtime/bootstrap/contextCompression.js";
import { createLoopTerminationMiddleware } from "./runtime/loop/loopTermination.js";
import { createRepoProfile } from "./runtime/profile/repoProfile.js";
import { createSourceExplorerPrompt } from "./runtime/prompt/sourceExplorerPrompt.js";
import { createSourceQuestionMessage } from "./runtime/bootstrap/sourceQuestionPrompt.js";
import { assertReadySourceState } from "./runtime/bootstrap/sourceStateAssert.js";
import { createSourceTools } from "./tools/source/sourceTools.js";
import { extractMessageText } from "./utils/text.js";

export { LocalSourceRepository } from "./sourceRepository/index.js";
export type {
  LocalSourceFileInput,
  LocalSourceFileRecord,
  LocalSourceReadRange,
  OverwriteSourceFilesInput,
  SourceRepositoryState,
} from "./sourceRepository/index.js";

const DEFAULT_MAX_TOOL_CALLS = 18; // 最多调用次数

export async function runEvolvingAgent(
  input: RunSourceAgentInput,
): Promise<RunSourceAgentResult> {
  assertReadySourceState(input.sourceState);

  input.onProgress?.({
    event: "evolvingAgent.start",
    details: {
      repoRoot: input.repoRoot,
      includeDirs: input.includeDirs ?? [],
      sourceState: input.sourceState,
    },
  });

  const codeGraph = await createReadyCodeGraph(input.repoRoot);
  const repoProfile = await createRepoProfile({
    repoRoot: input.repoRoot,
    includeDirs: input.includeDirs,
    codeGraphSummary: formatCodeGraphStats(codeGraph.getStats()),
  });
  const evidence: RunSourceAgentResult["evidence"] = [];
  const toolTrace: RunSourceAgentResult["toolTrace"] = [];
  const llm = createLLM({
    model: input.model,
    apiKey: input.apiKey,
    baseUrl: input.baseUrl,
    temperature: input.temperature ?? 0,
    timeout: input.timeout,
  });
  const contextCompressionMiddleware = createContextCompressionMiddleware(
    llm,
    input.contextCompression,
  );
  const anomalyGate = { strategy: null };

  // 激活工具
  const tools = createSourceTools({
    repoRoot: input.repoRoot,
    includeDirs: input.includeDirs,
    codeGraph,
    budget: input.budget,
    evidence,
    toolTrace,
    instrumentationProvider: input.instrumentationProvider,
    anomalyGate,
    onToolCall: (trace) => {
      input.onProgress?.({
        event: "evolvingAgent.tool",
        details: {
          toolName: trace.toolName,
          input: trace.input,
        },
      });
    },
  });
  const loopTerminationMiddleware = createLoopTerminationMiddleware({
    evidence,
    toolTrace,
    anomalyGate,
    hasInstrumentation: Boolean(input.instrumentationProvider),
    onProgress: input.onProgress,
  });
  const middleware: AnyAgentMiddleware[] = [
    ...contextCompressionMiddleware,
    loopTerminationMiddleware,
  ];

  // 创建智能体
  const agent = createAgent({
    model: llm,
    tools,
    middleware,
    systemPrompt: createSourceExplorerPrompt(
      repoProfile,
      Boolean(input.instrumentationProvider),
    ),
  });

  input.onProgress?.({
    event: "evolvingAgent.graphReady",
    details: {
      toolCount: tools.length,
    },
  });

  try {
    const result = await agent.invoke(
      {
        messages: [
          createSourceQuestionMessage(input.question),
        ],
      },
      {
        signal: input.abortSignal,
        recursionLimit: input.budget?.maxToolCalls ?? DEFAULT_MAX_TOOL_CALLS,
      },
    );
    const messages = result.messages ?? [];
    const lastMessage = messages[messages.length - 1];

    return {
      answer: lastMessage ? extractMessageText(lastMessage) : "",
      evidence,
      toolTrace,
    };
  } finally {
    codeGraph.close();
  }
}
