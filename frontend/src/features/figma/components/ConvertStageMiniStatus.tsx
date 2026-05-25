import type { ConvertStageEvent } from '../interfaces/model'
import { cn } from '@/utils/cn'
import { getConvertStageMeta, getConvertStageProgress } from './convertStageMeta'

interface ConvertStageMiniStatusProps {
  stage?: ConvertStageEvent
}

export function ConvertStageMiniStatus({ stage }: ConvertStageMiniStatusProps) {
  const currentStage = stage?.stage
  const currentMeta = getConvertStageMeta(currentStage)
  const progress = getConvertStageProgress(currentStage)
  const isCompleted = currentStage === 'completed'
  const isFailed = currentStage === 'failed'
  const CurrentIcon = currentMeta.Icon
  const stageKey = currentStage ?? 'preparing'

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md border bg-[#15182A]/95 px-3 py-2 shadow-[0_10px_24px_rgba(0,0,0,0.24)]',
        isFailed ? 'border-red-500/35' : 'border-[#2A2F4C]',
      )}
    >
      {!isFailed && <div className="pointer-events-none absolute inset-0 convert-stage-ambient opacity-70" />}
      <div className="relative flex items-center gap-2">
        <div
          key={stageKey}
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-full border convert-stage-swap',
            isFailed
              ? 'border-red-500/35 bg-red-500/10 text-red-300'
              : isCompleted
                ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-300'
                : 'border-[#4F6BFF]/35 bg-[#1337EC]/15 text-[#9AAEFF]',
          )}
        >
          {isCompleted || isFailed ? (
            <CurrentIcon className="size-3" />
          ) : (
            <CurrentIcon className="size-3 animate-pulse" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div key={`${stageKey}-compact-copy`} className="convert-stage-copy-enter">
            <div className="truncate text-[10px] font-semibold uppercase leading-3 tracking-[0.12em] text-[#8F98B8]">
              {currentMeta.title}
            </div>
            <div className="truncate text-[11px] font-medium leading-4 text-[#E5E7EB]">
              {stage?.label ?? '转换准备中'}
            </div>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#0E111D]">
            <div
              className={cn('h-full rounded-full transition-[width] duration-500', isFailed ? 'bg-red-500' : 'bg-[#4F6BFF]')}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
