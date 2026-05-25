import type { ConvertStageEvent, FigmaConvertResult } from '../interfaces/model'

type ConvertStreamEvent =
  | ({ type: ConvertStageEvent['stage'] } & Pick<ConvertStageEvent, 'label'>)
  | { type: 'result'; data: FigmaConvertResult }
  | { type: 'error'; message: string }

export async function readConvertStream(
  resp: Response,
  onStage?: (event: ConvertStageEvent) => void,
): Promise<FigmaConvertResult> {
  if (!resp.body) throw new Error('当前浏览器不支持流式读取转换结果')

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: FigmaConvertResult | null = null

  const handleLine = (line: string) => {
    if (!line.trim()) return
    const event = JSON.parse(line) as ConvertStreamEvent
    if (event.type === 'result') {
      result = event.data
      return
    }
    if (event.type === 'error') {
      throw new Error(event.message)
    }
    onStage?.({ stage: event.type, label: event.label })
  }

  while (true) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) handleLine(line)

    if (done) break
  }

  handleLine(buffer)
  if (!result) throw new Error('转换响应缺少最终结果')
  return result
}
