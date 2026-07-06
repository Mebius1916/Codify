import { BadRequestException, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runVisualRepair, type AgentProgressEvent } from "@codify/agent";
import { convertHtmlCssToTailwind } from "@codify/converters";
import { env } from "../config/env.ts";
import type { ConvertProgressReporter } from "../conversion/convertProgress.ts";
import type {
  AiEnhanceResult,
  CodegenResult,
  ConvertProgressStage,
  FigmaNodeRef,
} from "../conversion/types.ts";
import {
  formatUserError,
  type AiEnhanceStage,
} from "../errors/userErrorEvents.ts";
import { formatError, formatErrorCause } from "../logging/loggingUtils.ts";
import { LoggingService } from "../logging/loggingService.ts";
import { RenderService } from "../render/renderService.ts";
import { SourceInsightService } from "../sourceInsight/sourceInsightService.ts";
import { VisualAttentionService } from "../vision/visualAttentionService.ts";
import type { ConvertFigmaDto } from "../figma/dto/convertFigmaDto.ts";
import { buildRenderableHtml } from "./utils/buildRenderableHtml.ts";

const FIGMA_AI_LLM_TIMEOUT_MS = 1 * 60_000;
const FIGMA_AI_DEBUG_IMAGE_DIR = resolve(
  process.cwd(),
  ".debug",
  "figma-ai-enhance",
);

interface AiEnhanceStageReporter {
  run<T>(stage: AiEnhanceStage, task: () => Promise<T>): Promise<T>;
}

function readPngSize(base64: string): { width: number; height: number } {
  const buffer = Buffer.from(base64, "base64");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

@Injectable()
export class AiEnhanceService {
  constructor(
    private readonly renderService: RenderService,
    private readonly visualAttentionService: VisualAttentionService,
    private readonly sourceInsightService: SourceInsightService,
    private readonly loggingService: LoggingService,
  ) {}

  async enhance(input: {
    dto: ConvertFigmaDto;
    nodeRef: FigmaNodeRef;
    baselinePngBase64: string;
    codegenResult: CodegenResult;
    convertProgress: ConvertProgressReporter;
    abortSignal?: AbortSignal;
  }): Promise<AiEnhanceResult> {
    const runId = randomUUID();
    const startedAt = Date.now();
    const events: AgentProgressEvent[] = [];
    const stage = this.createAiEnhanceStageReporter(
      runId,
      input.convertProgress,
    );
    const handleAgentProgress = (event: AgentProgressEvent) => {
      events.push(event);
      input.convertProgress.reportAgent(event);
      const status = String(event.details?.status ?? "");
      if (status !== "error") return;
      this.loggingService.error(`AI enhance agent ${event.event}`, {
        runId,
        module: "aiEnhance",
        source: "agent",
        agentEvent: event.event,
        details: event.details,
      });
    };

    try {
      const apiKey =
        env.model.apiKey.trim() || input.dto.aiOptions?.apiKey?.trim() || "";
      if (!apiKey) {
        throw new BadRequestException(
          formatUserError({ type: "ai.model_api_key.missing" }),
        );
      }
      if (!input.dto.aiOptions?.baseUrl?.trim()) {
        throw new BadRequestException(
          formatUserError({ type: "ai.model_endpoint.missing" }),
        );
      }
      const aiOptions = input.dto.aiOptions;

      const baselinePngBase64 = input.baselinePngBase64;
      const viewport = readPngSize(baselinePngBase64);
      const renderHtml = buildRenderableHtml(input.codegenResult);
      const { buffer } = await stage.run("render_current", () =>
        this.renderService.renderHtmlToImage({
          html: renderHtml,
          width: viewport.width,
          height: viewport.height,
          format: "png",
          fullPage: false,
          deviceScaleFactor: 1,
        }),
      );
      const currentPngBase64 = buffer.toString("base64");
      const visualAttention = await stage.run("visual_attention", () =>
        this.visualAttentionService.buildAttention({
          runId,
          figmaPngBase64: baselinePngBase64,
          renderedPngBase64: currentPngBase64,
        }),
      );
      await this.writeDebugImages(runId, {
        baseline: baselinePngBase64,
        current: currentPngBase64,
        evidence: visualAttention.visualEvidencePngBase64,
      });

      const currentHtml = await this.prepareCurrentHtml(input, runId);
      const result = await stage.run("agent_visual_repair", () =>
        runVisualRepair({
          visualEvidencePngBase64: visualAttention.visualEvidencePngBase64,
          html: currentHtml,
          model: aiOptions.model?.trim() || "gemini-2.5-flash",
          apiKey,
          baseUrl: aiOptions.baseUrl.trim(),
          temperature: aiOptions.temperature ?? 0,
          timeout: FIGMA_AI_LLM_TIMEOUT_MS,
          onProgress: handleAgentProgress,
          onObserve: (observe) => {
            const sourceInsightRunId = this.sourceInsightService.startFromObserve({
              aiEnhanceRunId: runId,
              nodeRef: input.nodeRef,
              observe,
              model: aiOptions.model?.trim() || "gemini-2.5-flash",
              apiKey,
              baseUrl: aiOptions.baseUrl.trim(),
            });
            this.loggingService.info("AI enhance source insight queued", {
              runId,
              module: "aiEnhance",
              source: "backend",
              sourceInsightRunId,
            });
          },
          abortSignal: input.abortSignal,
        }),
      );

      this.loggingService.info("AI enhance completed", {
        runId,
        module: "aiEnhance",
        source: "backend",
        durationMs: Date.now() - startedAt,
        sourceInsightEnabled: true,
      });
      return {
        result,
        meta: { enabled: true, status: "done", runId, events },
      };
    } catch (error) {
      this.loggingService.error("AI enhance failed", {
        runId,
        module: "aiEnhance",
        source: "backend",
        durationMs: Date.now() - startedAt,
        error: formatError(error),
        errorCause: formatErrorCause(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return {
        meta: {
          enabled: true,
          status: "failed",
          runId,
          error: formatError(error),
          events,
        },
      };
    }
  }

  private async prepareCurrentHtml(
    input: {
      codegenResult: CodegenResult;
    },
    runId: string,
  ): Promise<string> {
    try {
      const htmlFragment = (
        input.codegenResult.body || input.codegenResult.html
      ).trim();
      const tailwindFragment = (
        await convertHtmlCssToTailwind(
          htmlFragment,
          input.codegenResult.css,
        )
      ).trim();
      return tailwindFragment;
    } catch (error) {
      this.loggingService.warn(
        "AI enhance tailwind conversion fell back to raw html+css",
        {
          runId,
          module: "aiEnhance",
          source: "backend",
          error: formatError(error),
          errorCause: formatErrorCause(error),
        },
      );
      return (input.codegenResult.body || input.codegenResult.html).trim();
    }
  }

  private createAiEnhanceStageReporter(
    runId: string,
    convertProgress: ConvertProgressReporter,
  ): AiEnhanceStageReporter {
    return {
      run: async <T>(
        stage: AiEnhanceStage,
        task: () => Promise<T>,
      ): Promise<T> => {
        const startedAt = Date.now();
        const logStage = stage.replaceAll("_", "-");
        if (stage === "render_baseline" || stage === "render_current") {
          convertProgress.report(stage satisfies ConvertProgressStage);
        }
        try {
          const result = await task();
          return result;
        } catch (error) {
          this.loggingService.error("AI enhance stage failed", {
            runId,
            module: "aiEnhance",
            source: "backend",
            stage: logStage,
            durationMs: Date.now() - startedAt,
            error: formatError(error),
            errorCause: formatErrorCause(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          throw new Error(
            formatUserError({
              type: "ai.enhance_stage.failed",
              stage,
              runId,
              error,
            }),
          );
        }
      },
    };
  }

  private async writeDebugImages(
    runId: string,
    images: { baseline: string; current: string; evidence: string },
  ): Promise<string> {
    const outputDir = resolve(FIGMA_AI_DEBUG_IMAGE_DIR, runId);
    await mkdir(outputDir, { recursive: true });
    const writes = [
      writeFile(
        resolve(outputDir, "baseline.png"),
        Buffer.from(images.baseline, "base64"),
      ),
      writeFile(
        resolve(outputDir, "current.png"),
        Buffer.from(images.current, "base64"),
      ),
      writeFile(
        resolve(outputDir, "visual-evidence.png"),
        Buffer.from(images.evidence, "base64"),
      ),
    ];
    await Promise.all(writes);
    return outputDir;
  }
}
