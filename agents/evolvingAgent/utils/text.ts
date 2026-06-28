import type { BaseMessage, BaseMessageChunk } from "@langchain/core/messages";

export function extractMessageText(message: BaseMessage | BaseMessageChunk | string): string {
  if (typeof message === "string") {
    return message;
  }

  const { content } = message;
  if (typeof content === "string") {
    return content;
  }

  return content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }

      if ("text" in part && typeof part.text === "string") {
        return part.text;
      }

      return "";
    })
    .filter(Boolean)
    .join("\n");
}
