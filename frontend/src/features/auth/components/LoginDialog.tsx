import { useState } from 'react'
import { Github, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog'
import { authClient } from '../lib/authClient'

interface LoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  prompt?: string
}

type SocialProvider = 'google' | 'github'

function GoogleMark() {
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[13px] font-semibold text-[#202534]">
      G
    </span>
  )
}

export function LoginDialog({ open, onOpenChange, prompt }: LoginDialogProps) {
  const [pendingProvider, setPendingProvider] = useState<SocialProvider | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSocialSignIn = async (provider: SocialProvider) => {
    setPendingProvider(provider)
    setError(null)

    const result = await authClient.signIn.social({
      provider,
      callbackURL: window.location.href,
      errorCallbackURL: window.location.href,
    })

    if (result.error) {
      setError(result.error.message || '登录服务暂时不可用，请稍后重试。')
      setPendingProvider(null)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setError(null)
          setPendingProvider(null)
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="w-[440px] max-w-[calc(100vw-32px)] rounded-lg border-[#303653] bg-[#171B2D] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <DialogHeader className="border-b-0 px-6 pb-2 pt-6">
          <div className="space-y-2">
            <DialogTitle className="text-[22px] leading-7">Sign in to Codify</DialogTitle>
            <DialogDescription className="leading-5">
              {prompt || 'Use a trusted provider to continue.'}
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogBody className="gap-4 px-6 pb-6 pt-3">
          <div className="grid gap-3">
            <button
              type="button"
              className="flex h-12 w-full items-center justify-center gap-3 rounded-md border border-white/10 bg-white/[0.06] px-4 text-sm font-medium text-white transition-colors hover:border-white/20 hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B7CFF] disabled:pointer-events-none disabled:opacity-60"
              onClick={() => handleSocialSignIn('google')}
              disabled={pendingProvider !== null}
            >
              {pendingProvider === 'google' ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleMark />}
              Continue with Google
            </button>

            <button
              type="button"
              className="flex h-12 w-full items-center justify-center gap-3 rounded-md border border-white/10 bg-[#0F1220] px-4 text-sm font-medium text-white transition-colors hover:border-white/20 hover:bg-[#12172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B7CFF] disabled:pointer-events-none disabled:opacity-60"
              onClick={() => handleSocialSignIn('github')}
              disabled={pendingProvider !== null}
            >
              {pendingProvider === 'github' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Github className="h-5 w-5" />}
              Continue with GitHub
            </button>
          </div>

          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm leading-5 text-red-100">
              {error}
            </div>
          )}

          <div className="border-t border-white/10 pt-4 text-xs leading-5 text-[#8F98B8]">
            Signing in creates a local Codify session on this backend.
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
