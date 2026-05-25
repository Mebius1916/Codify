import type { ConvertStageEvent } from '../interfaces/model'
import { cn } from '@/utils/cn'
import { ConvertStageRail } from './ConvertStageRail'
import {
  CONVERT_STAGE_ITEMS,
  getConvertStageIndex,
  getConvertStageMeta,
  getConvertStageProgress,
} from './convertStageMeta'

interface ConvertRuntimeViewProps {
  stage?: ConvertStageEvent
}

export function ConvertRuntimeView({ stage }: ConvertRuntimeViewProps) {
  const currentStage = stage?.stage
  const currentMeta = getConvertStageMeta(currentStage)
  const activeIndex = getConvertStageIndex(currentStage)
  const progress = getConvertStageProgress(currentStage)
  const isCompleted = currentStage === 'completed'
  const isFailed = currentStage === 'failed'
  const CurrentIcon = currentMeta.Icon
  const stageKey = currentStage ?? 'preparing'

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-6">
      <div className="relative h-[228px] w-full max-w-[620px] overflow-hidden rounded-2xl border border-[#2A2F4C] bg-[#111528]/90 shadow-[0_28px_80px_rgba(0,0,0,0.32)]">
        <div className="pointer-events-none absolute inset-0 convert-runtime-grid opacity-80" />
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-px convert-runtime-scan" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            key={stageKey}
            className={cn(
              'relative flex size-24 items-center justify-center rounded-2xl border convert-runtime-core',
              isFailed
                ? 'border-red-500/35 bg-red-500/10 text-red-300'
                : isCompleted
                  ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-300'
                  : 'border-[#4F6BFF]/35 bg-[#1337EC]/15 text-[#A9B8FF]',
            )}
          >
            <CurrentIcon className={cn('size-9', !isCompleted && !isFailed && 'animate-pulse')} />
          </div>
        </div>
        <div className="absolute bottom-5 left-5 right-5 grid grid-cols-8 gap-1.5">
          {CONVERT_STAGE_ITEMS.map((item, index) => {
            const isActive = !isFailed && index === activeIndex && currentStage !== 'completed'
            const isDone = !isFailed && (index < activeIndex || currentStage === 'completed')

            return (
              <div
                key={item.stage}
                className={cn(
                  'h-1 rounded-full transition-colors duration-300',
                  isActive || isDone ? 'bg-[#6F85FF]' : 'bg-[#2A2F4C]',
                )}
              />
            )
          })}
        </div>
      </div>

      <div className="mt-8 w-full max-w-3xl text-center">
        <div className="flex items-center justify-center gap-2">
          <span
            className={cn(
              'size-1.5 rounded-full',
              isFailed ? 'bg-red-400' : isCompleted ? 'bg-emerald-300' : 'bg-[#6F85FF] convert-stage-pulse',
            )}
          />
          <span className="text-[11px] font-semibold uppercase leading-4 tracking-[0.2em] text-[#8F98B8]">
            Conversion Runtime
          </span>
        </div>
        <div key={`${stageKey}-title`} className="convert-stage-copy-enter">
          <h2 className="mt-3 text-[32px] font-semibold leading-10 text-[#F3F4F6]">{currentMeta.title}</h2>
          <p className="mt-2 text-sm leading-6 text-[#9CA3AF]">{stage?.label ?? '转换准备中'}</p>
        </div>
      </div>

      <div className="mt-8 w-full max-w-3xl">
        <div className="relative h-1.5 overflow-hidden rounded-full bg-[#0E111D]">
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-500 ease-out',
              isFailed ? 'bg-red-500' : 'bg-[#4F6BFF]',
            )}
            style={{ width: `${progress}%` }}
          />
          {!isFailed && <div className="absolute inset-0 convert-stage-bar" />}
        </div>
        <div className="mt-4">
          <ConvertStageRail stage={currentStage} />
        </div>
        <div className="mt-4 text-center text-xs font-semibold leading-4 text-[#8F98B8]">
          {isFailed ? 'Error' : `${activeIndex + 1}/${CONVERT_STAGE_ITEMS.length}`}
        </div>
      </div>
    </div>
  )
}
