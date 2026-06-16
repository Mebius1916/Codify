import type { HasFramePropertiesTrait, HasLayoutTrait, Node as FigmaDocumentNode, Style } from "@figma/rest-api-spec";
import type { NodeFeatures } from "../extractors/analysis/types.js";
import type { SmartNode } from "../extractors/analysis/index.js";
import type { 
  SimplifiedTextStyle, 
  SimplifiedLayout, 
  SimplifiedFill, 
  SimplifiedStroke, 
  SimplifiedEffects,
  SimplifiedNodeStyle,
  SimplifiedCompositeStyle
} from "./simplified-types.js";
import type {
  ComponentProperties,
  SimplifiedComponentDefinition,
  SimplifiedComponentSetDefinition,
} from "../transformers/component.js";

export type StyleTypes =
  | SimplifiedTextStyle
  | SimplifiedFill[]
  | SimplifiedLayout
  | SimplifiedStroke
  | SimplifiedEffects
  | SimplifiedNodeStyle
  | SimplifiedCompositeStyle
  | string;

export interface LayoutMeta {
  layoutAlignSelf?: HasLayoutTrait["layoutAlign"];
  layoutSizing?: {
    horizontal?: HasLayoutTrait["layoutSizingHorizontal"];
    vertical?: HasLayoutTrait["layoutSizingVertical"];
  };
  layoutGrow?: number;
  layoutMode?: HasFramePropertiesTrait["layoutMode"];
  layoutPositioning?: HasLayoutTrait["layoutPositioning"];
}

export interface GlobalVars {
  styles: Record<string, StyleTypes>;
  styleCache?: Map<string, string>;
  classNameMap?: Record<string, string>;
  imageAssets?: {
    nodeIds: string[];
    imageRefs: string[];
    svgNodeIds?: string[];
  };
  layoutMetaById?: Record<string, LayoutMeta>;
}

export interface TraversalContext {
  globalVars: GlobalVars & { extraStyles?: Record<string, Style> };
  currentDepth: number;
  parent?: FigmaDocumentNode;
  // Smart Node
  smartNode?: SmartNode;
}

/**
 * An extractor function that extracts specific properties from a Figma node.
 * It returns a Partial<SimplifiedNode> which will be merged into the final result.
 * It should NOT modify the 'children' property.
 *
 * @param node - The current Figma node being processed
 * @param context - Traversal context including globalVars and parent info.
 * @returns Partial object containing extracted properties
 */
export type ExtractorFn = (
  node: FigmaDocumentNode,
  context: TraversalContext,
) => Partial<Omit<SimplifiedNode, "children">>;

export interface SimplifiedDesign {
  name: string;
  canvasSize?: {
    width: number;
    height: number;
  };
  nodes: SimplifiedNode[];
  components: Record<string, SimplifiedComponentDefinition>;
  componentSets: Record<string, SimplifiedComponentSetDefinition>;
  globalVars: GlobalVars;
}

export interface SimplifiedNode {
  id: string;
  name: string;
  type: "SVG" | "TEXT" | "CONTAINER" | "IMAGE";
  src?: string; // For IMAGE nodes
  visible?: boolean;
  // Geometry for occlusion detection
  absRect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  // text
  textStyle?: string;
  richText?: {
    text: string;
    style: SimplifiedTextStyle;
    effects?: SimplifiedEffects;
  }[];
  // appearance
  fills?: string;
  styles?: string;
  strokes?: string;
  strokeWeight?: string;
  strokeDashes?: number[];
  strokeWeights?: string;
  effects?: string;
  opacity?: number;
  borderRadius?: string;
  rotation?: number; // degrees
  transform?: string; // css transform string
  blendMode?: string;
  // layout & alignment
  layout?: SimplifiedLayout | string;
  // for rect-specific strokes, etc.
  componentId?: string;
  componentProperties?: ComponentProperties[];
  // children
  children?: SimplifiedNode[];
  semanticTag?: 
    "list" | "icon" | "group" | "button" | "input" | "section" | 
    "header" | "footer" | "nav" | "article" | "aside" | "main" | 
    "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  // visual fingerprint for list inference
  visualSignature?: string;
  // internal marker: downstream reconstruction passes should enter this generated child layer
  needsDownstreamProcessing?: boolean;
}
