import { useEffect, useState } from 'react'
import headerIconUrl from '@assets/Icon.svg'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from './toast'
import { cn } from '@/utils/cn'

const APP_TOAST_EVENT = 'app-toast'
const TOAST_DURATION_MS = 5000

type AppToastVariant = 'default' | 'success' | 'error'

interface AppToastDetail {
  message: string
  title?: string
  actionLabel?: string
  variant?: AppToastVariant
}

type AppToast = AppToastDetail & {
  id: number
  variant: AppToastVariant
}

const toastTone = {
  default: {
    button: 'bg-[#1337EC] hover:bg-[#1337EC]/90',
    iconWrap: 'border-[#1337EC]/20 bg-[#1337EC]/10',
    icon: 'text-[#8EA2FF]',
  },
  success: {
    button: 'bg-[#1337EC] hover:bg-[#1337EC]/90',
    iconWrap: 'border-emerald-500/20 bg-emerald-500/10',
    icon: 'text-emerald-400',
  },
  error: {
    button: 'bg-[#1337EC] hover:bg-[#1337EC]/90',
    iconWrap: 'border-red-500/20 bg-red-500/10',
    icon: 'text-red-400',
  },
} satisfies Record<AppToastVariant, Record<'button' | 'iconWrap' | 'icon', string>>

const toastIcon = {
  default: Info,
  success: CheckCircle2,
  error: AlertTriangle,
} satisfies Record<AppToastVariant, typeof Info>

export function showToast(detail: AppToastDetail) {
  window.dispatchEvent(
    new CustomEvent<AppToastDetail>(APP_TOAST_EVENT, {
      detail,
    }),
  )
}

export function AppToaster() {
  const [toast, setToast] = useState<AppToast | null>(null)

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<AppToastDetail>).detail
      if (!detail?.message) return

      setToast({
        id: Date.now(),
        title: detail.title,
        message: detail.message,
        actionLabel: detail.actionLabel,
        variant: detail.variant ?? 'default',
      })
    }

    window.addEventListener(APP_TOAST_EVENT, onToast)
    return () => window.removeEventListener(APP_TOAST_EVENT, onToast)
  }, [])

  return (
    <ToastProvider swipeDirection="up">
      {toast && (
        (() => {
          const StatusIcon = toastIcon[toast.variant]

          return (
            <Toast
              key={toast.id}
              open
              duration={TOAST_DURATION_MS}
              onOpenChange={(open) => {
                if (!open) setToast(null)
              }}
              className="w-[min(calc(100vw-32px),420px)] flex-col items-stretch gap-0 overflow-hidden rounded-xl border-[#2A2F4C] bg-[#1A1E32] p-0 text-[#E5E7EB] shadow-2xl outline outline-1 -outline-offset-1 outline-[#2A2F4C]"
            >
              <div className="flex w-full items-center justify-between border-b border-[#2A2F4C] bg-[#15182A]/50 px-5 py-4">
                <div className="flex items-center gap-2">
                  <img src={headerIconUrl} alt="" className="size-[17px]" />
                  <ToastTitle className="text-sm font-semibold leading-5 text-white">
                    {toast.title ?? (toast.variant === 'error' ? 'System Message' : 'System Message')}
                  </ToastTitle>
                </div>
                <ToastClose
                  aria-label="Close"
                  className="rounded-md p-1 text-[#9CA3AF] hover:bg-white/5 hover:text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                >
                  <X className="size-3.5" />
                </ToastClose>
              </div>

              <div className="flex w-full flex-col items-center px-6 py-8">
                <div className={cn('mb-4 flex size-12 items-center justify-center rounded-full border', toastTone[toast.variant].iconWrap)}>
                  <StatusIcon className={cn('size-6', toastTone[toast.variant].icon)} />
                </div>
                <ToastDescription className="max-w-[310px] text-center text-sm font-normal leading-[22px] text-[#D1D5DB]">
                  {toast.message}
                </ToastDescription>
              </div>

              <div className="flex w-full justify-end border-t border-[#2A2F4C] bg-[#15182A]/50 px-5 py-4">
                <ToastClose
                  aria-label={toast.actionLabel ?? 'Confirm'}
                  className={cn(
                    'flex h-8 items-center justify-center rounded-md px-5 text-xs font-bold leading-4 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#1337EC]/40',
                    toastTone[toast.variant].button,
                  )}
                >
                  {toast.actionLabel ?? 'Confirm'}
                </ToastClose>
              </div>
            </Toast>
          )
        })()
      )}
      <ToastViewport />
    </ToastProvider>
  )
}
