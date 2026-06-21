export function extractDataIds(html?: string): Set<string> {
  const dataIds = new Set<string>();

  if (!html) {
    return dataIds;
  }

  const quotedAttrPattern = /\bdata-id\s*=\s*(["'])(.*?)\1/g;
  for (const match of html.matchAll(quotedAttrPattern)) {
    const dataId = match[2]?.trim();
    if (dataId) {
      dataIds.add(dataId);
    }
  }

  const unquotedAttrPattern = /\bdata-id\s*=\s*([^\s"'=<>`]+)/g;
  for (const match of html.matchAll(unquotedAttrPattern)) {
    const dataId = match[1]?.trim();
    if (dataId) {
      dataIds.add(dataId);
    }
  }

  return dataIds;
}

export function getDataIdRemovalState(input: {
  previousHtml: string;
  nextHtml: string;
  declaredRemovedDataIds: Set<string>;
}) {
  const previousDataIds = extractDataIds(input.previousHtml);
  const nextDataIds = extractDataIds(input.nextHtml);
  const invalidRemovedDataIds = [...input.declaredRemovedDataIds].filter(
    (dataId) => !previousDataIds.has(dataId)
  );
  const missingDataIds = [...previousDataIds].filter(
    (dataId) => !nextDataIds.has(dataId)
  );
  const undeclaredMissingDataIds = missingDataIds.filter(
    (dataId) => !input.declaredRemovedDataIds.has(dataId)
  );

  return {
    invalidRemovedDataIds,
    missingDataIds,
    undeclaredMissingDataIds,
  };
}
