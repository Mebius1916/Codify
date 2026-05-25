import type { ConvertStage } from '../interfaces/model'
import { cn } from '@/utils/cn'
import { CONVERT_STAGE_ITEMS, getConvertStageIndex } from './convertStageMeta'

interface ConvertStageRailProps {
  stage?: ConvertStage
}

export function ConvertStageRail({ stage }: ConvertStageRailProps) {
  const activeIndex = getConvertStageIndex(stage)
  const isFailed = stage === 'failed'

  return (
    <div className="grid grid-cols-8 gap-2">
      {CONVERT_STAGE_ITEMS.map((item, index) => {
        const isDone = !isFailed && (index < activeIndex || stage === 'completed')
        const isActive = !isFailed && index === activeIndex && stage !== 'completed'

        return (
          <div key={item.stage} className="min-w-0">
            <div
              className={cn(
                'mb-1.5 h-0.5 rounded-full transition-colors duration-300',
                isActive || isDone ? 'bg-[#6F85FF]' : 'bg-[#2A2F4C]',
              )}
            />
            <div
              className={cn(
                'truncate text-[10px] font-medium leading-4',
                isActive ? 'text-[#F3F4F6]' : isDone ? 'text-[#9AAEFF]' : 'text-[#626B86]',
              )}
            >
              {item.shortLabel}
            </div>
          </div>
        )
      })}
    </div>
  )
}
