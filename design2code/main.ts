import type {
  GetFileResponse,
  GetFileNodesResponse,
} from "@figma/rest-api-spec";
import codegen, { type CodegenResult } from "./core/codegen/index.js";
import { simplifyRawFigmaObjectWithImages, type FetcherAdapter } from "./core/extractors/pipeline/design-extractor.js";
import { InstrumentationHub } from "./core/instrumentation/hub.js";
import type { SimplifiedDesign } from "./core/types/extractor-types.js";

interface ExtractFigmaAsJSONOptions {
  fileKey: string;
  token: string;
  format?: "png" | "jpg" | "svg" | "pdf";
  scale?: number;
  assetsDir?: string;
  assetsUrlPrefix?: string;
  fetcher?: FetcherAdapter;
  skipAssetFetch?: boolean;
  collectInstrumentation?: boolean;
}

export async function convertFigmaToCode(
  figmaData: GetFileResponse | GetFileNodesResponse,
  options: ExtractFigmaAsJSONOptions,
): Promise<CodegenResult> {
  // 仅在显式开启时才创建采集中心，默认不影响原有转换行为
  const hub = options.collectInstrumentation ? new InstrumentationHub() : undefined;
  const simplifiedDesign = await extractFigmaAsJSON(figmaData, options, hub);
  const result = codegen(simplifiedDesign);
  return hub ? { ...result, instrumentation: hub.collectPackets() } : result;
}

async function extractFigmaAsJSON(
  figmaData: GetFileResponse | GetFileNodesResponse,
  options: ExtractFigmaAsJSONOptions,
  hub?: InstrumentationHub,
): Promise<SimplifiedDesign> {
  return simplifyRawFigmaObjectWithImages(figmaData, { ...options, instrumentation: hub });
}
