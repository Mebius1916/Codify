import type { Node as FigmaNode } from "@figma/rest-api-spec";
import { hasVisibleStyles } from "../utils/node-check.js";

const DEFAULT_ICON_SIZE = 64;
const ILLUSTRATION_ICON_SIZE = 300;

// 基础图形
const ICON_PRIMITIVE_TYPES: Set<string> = new Set([
  "ELLIPSE",
  "RECTANGLE",
  "LINE",
]);

// 复杂矢量
const ICON_COMPLEX_VECTOR_TYPES: Set<string> = new Set([
  "VECTOR",
  "BOOLEAN_OPERATION",
  "STAR",
  "POLYGON",
]);

// 容器
const ICON_CONTAINER_TYPES: Set<string> = new Set([
  "FRAME",
  "GROUP",
  "COMPONENT",
  "INSTANCE",
]);

// 黑名单
const DISALLOWED_CHILD_TYPES: Set<string> = new Set([
  "TEXT",
  "SLICE",
  "CONNECTOR",
  "STICKY",
  "SHAPE_WITH_TEXT",
  "CODE_BLOCK",
  "WIDGET",
  "COMPONENT_SET",
]);

export function isIcon(node: FigmaNode): boolean {
  //  导出设置检测
  if ("exportSettings" in node && Array.isArray(node.exportSettings)) {
    if (node.exportSettings.some((setting) => setting.format === "SVG")) {
      return true;
    }
  }

  const isPrimitive = ICON_PRIMITIVE_TYPES.has(node.type);
  const isComplexVector = ICON_COMPLEX_VECTOR_TYPES.has(node.type);
  const isContainer = ICON_CONTAINER_TYPES.has(node.type);

  if (!isPrimitive && !isComplexVector && !isContainer) {
    return false;
  }

  const bbox = "absoluteBoundingBox" in node ? node.absoluteBoundingBox : null;
  const width = bbox?.width ?? 0;
  const height = bbox?.height ?? 0;
  
  if (width === 0 || height === 0) return false; // Invisible or empty

  if (isPrimitive) {
    if (width > DEFAULT_ICON_SIZE || height > DEFAULT_ICON_SIZE) return false;
  }
  
  if (isComplexVector) {
    return true;
  }

  if (isContainer) {
    // 如果尺寸超大，直接拒绝（除非有特殊命名）
    if (width > ILLUSTRATION_ICON_SIZE || height > ILLUSTRATION_ICON_SIZE) return false;

    // 命名检查
    const name = node.name.toLowerCase();
    if (name.includes("icon") || name.startsWith("ic_") || name.includes("svg") || 
        name.includes("logo") || name.includes("illustration") || 
        name.includes("pic") || name.includes("img")) {
      return checkChildrenRecursively(node).isValidIcon;
    }

    const isLargeIcon = width > DEFAULT_ICON_SIZE || height > DEFAULT_ICON_SIZE;

    // 递归检查子节点
    const checkResult = checkChildrenRecursively(node);
    if (!checkResult.isValidIcon) return false;

    // 空容器如果具有可见的样式（如边框、填充），且尺寸符合图标标准，也应视为图标
    if (!checkResult.hasVectorContent) {
      if (hasVisibleStyles(node) && !isLargeIcon) return true; // 大尺寸空容器不视为 Icon
      return false;
    }
    
    return true;
  }

  return true;
}

// 递归检查子节点
function checkChildrenRecursively(node: FigmaNode): { isValidIcon: boolean; hasVectorContent: boolean } {
  // 无子节点，直接返回
  if (!("children" in node) || !Array.isArray(node.children) || node.children.length === 0) {
    // 检查自身是否有可见样式（针对空 Frame 作为占位符图标的情况）
    if (hasVisibleStyles(node)) {
        return { isValidIcon: true, hasVectorContent: false };
    }
    return { isValidIcon: true, hasVectorContent: false };
  }

  let hasVectorContent = false;

  for (const child of node.children) {
    if ("visible" in child && child.visible === false) continue;

    if (DISALLOWED_CHILD_TYPES.has(child.type)) {
      return { isValidIcon: false, hasVectorContent: false };
    }
    
    // 递归检查嵌套容器 (GROUP, FRAME, INSTANCE, COMPONENT)
    if (
      child.type === "GROUP" ||
      child.type === "FRAME" ||
      child.type === "INSTANCE" ||
      child.type === "COMPONENT"
    ) {
      const subCheck = checkChildrenRecursively(child);
      if (!subCheck.isValidIcon) return { isValidIcon: false, hasVectorContent: false };
      if (subCheck.hasVectorContent) hasVectorContent = true;
    } else {
      // 遇到合法的 Vector/Shape
      hasVectorContent = true;
    }
  }

  return { isValidIcon: true, hasVectorContent };
}
