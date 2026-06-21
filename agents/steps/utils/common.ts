export function toPngDataUrl(base64OrDataUrl: string): string {
  if (base64OrDataUrl.startsWith("data:")) {
    return base64OrDataUrl;
  }
  return `data:image/png;base64,${base64OrDataUrl}`;
}
