export function formatError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export function formatErrorCause(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined
  const cause = (error as { cause?: unknown }).cause
  if (!cause) return undefined
  return formatError(cause)
}
