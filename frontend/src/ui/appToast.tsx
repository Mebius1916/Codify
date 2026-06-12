import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { Toast, ToastClose, ToastProvider, ToastViewport } from './toast'
import { cn } from '@/utils/cn'
import { Alert, AlertDescription, AlertTitle } from './alert'

const APP_TOAST_EVENT = 'app-toast'
const TOAST_DURATION_MS = 7000

type AppToastVariant = 'default' | 'success' | 'warning' | 'error'

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
    icon: 'text-blue-300',
    alert: 'border-[#2A2F4C] bg-[#101727] text-[#E5E7EB]',
  },
  success: {
    icon: 'text-emerald-300',
    alert: 'border-emerald-500/45 bg-[#0F1D18] text-emerald-100',
  },
  warning: {
    icon: 'text-amber-300',
    alert: 'border-amber-500/50 bg-[#211A10] text-amber-100',
  },
  error: {
    icon: 'text-red-300',
    alert: 'border-red-500/55 bg-[#211316] text-red-100',
  },
} satisfies Record<AppToastVariant, Record<'icon' | 'alert', string>>

const toastIcon = {
  default: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
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
    <ToastProvider swipeDirection="right">
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
              className="gap-0 border-none bg-transparent p-0 shadow-none"
            >
              <Alert className={cn('pr-10 shadow-lg', toastTone[toast.variant].alert)}>
                <StatusIcon className={cn('absolute left-4 top-4 size-4', toastTone[toast.variant].icon)} />
                <ToastClose
                  aria-label="Close"
                  className="absolute right-3 top-3 rounded-md p-1 text-current/60 hover:bg-white/5 hover:text-current focus:outline-none focus:ring-1 focus:ring-white/20"
                >
                  <X className="size-4" />
                </ToastClose>
                <AlertTitle className="pl-7 pr-2 text-sm font-medium leading-5">
                  {toast.title ?? (toast.variant === 'error' ? 'Action failed' : toast.variant === 'success' ? 'Completed' : toast.variant === 'warning' ? 'Needs attention' : 'System update')}
                </AlertTitle>
                <AlertDescription className="max-h-32 overflow-auto break-words pl-7 pr-1 text-xs leading-5 text-current/85">
                  {toast.message}
                </AlertDescription>
              </Alert>
            </Toast>
          )
        })()
      )}
      <ToastViewport />
    </ToastProvider>
  )
}
