import { HumanMessage } from "@langchain/core/messages";
import codeGraphPackage, {
  type CodeGraph as UpstreamCodeGraphInstance,
} from "@colbymchenry/codegraph";
import { createAgent } from "langchain";

import type {
  RunSourceAgentInput,
  RunSourceAgentResult,
} from "./interfaces/index.js";
import { createLLM } from "./llm/createLLM.js";
import { formatCodeGraphStats } from "./runtime/codeGraphStats.js";
import { createRepoProfile } from "./runtime/repoProfile.js";
import { createSourceExplorerPrompt } from "./runtime/sourceExplorerPrompt.js";
import { createSourceTools } from "./tools/sourceTools.js";
import { extractMessageText } from "./utils/text.js";

const { CodeGraph } = codeGraphPackage;
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

  const codeGraph = await createCodeGraph(input.repoRoot);
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

  // 激活工具
  const tools = createSourceTools({
    repoRoot: input.repoRoot,
    includeDirs: input.includeDirs,
    codeGraph,
    budget: input.budget,
    evidence,
    toolTrace,
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

  // 创建智能体
  const agent = createAgent({
    model: llm,
    tools,
    systemPrompt: createSourceExplorerPrompt(repoProfile),
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
          new HumanMessage({
            content: [
              "Answer the source question below by autonomously inspecting the repository.",
              "Use exploreSource first for architecture, flow, or feature questions.",
              "The caller has already configured the available source range; focus on what to search, not where to search.",
              "exploreSource already returns the file structure; do not pass file listing controls.",
              "Use readFileRange only when you need live focused evidence beyond CodeGraph output.",
              "Keep the final answer concise, evidence-backed, and cite file paths with line ranges.",
              "",
              "<question>",
              input.question,
              "</question>",
            ].join("\n"),
          }),
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

async function createCodeGraph(
  repoRoot: string,
): Promise<UpstreamCodeGraphInstance> {
  const graph = CodeGraph.isInitialized(repoRoot)
    ? await CodeGraph.open(repoRoot, { sync: true })
    : await CodeGraph.init(repoRoot, { index: false });

  if (graph.getStats().fileCount === 0 || graph.isIndexStale()) {
    await graph.indexAll();
  }

  return graph;
}

function assertReadySourceState(
  sourceState: RunSourceAgentInput["sourceState"],
): void {
  if (!sourceState) return;

  if (sourceState.indexStatus !== "ready") {
    throw new Error(
      `Source index is not ready: ${sourceState.indexStatus}`,
    );
  }

  if (sourceState.sourceVersion !== sourceState.indexVersion) {
    throw new Error(
      `Source/index version mismatch: sourceVersion=${sourceState.sourceVersion}, indexVersion=${sourceState.indexVersion}`,
    );
  }
}
