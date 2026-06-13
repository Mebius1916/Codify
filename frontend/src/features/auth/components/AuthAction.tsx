import { useEffect, useRef, useState } from 'react'
import { LogOut, Settings } from 'lucide-react'
import { Button } from '@/ui/button'
import { authClient } from '../lib/authClient'

interface AuthActionProps {
  onOpenSettings?: () => void
}

export function AuthAction({ onOpenSettings }: AuthActionProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { data: session, isPending, refetch } = authClient.useSession()

  const handleSignOut = async () => {
    await authClient.signOut()
    setMenuOpen(false)
    await refetch()
  }

  useEffect(() => {
    if (!menuOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  if (isPending) {
    return (
      <div className="h-8 w-8 animate-pulse rounded-full bg-white/5" aria-label="Loading user session" />
    )
  }

  if (!session) {
    return null
  }

  const userName = session.user.name || session.user.email
  const userEmail = session.user.email
  const initials = userName.slice(0, 1).toUpperCase()

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/10 text-sm font-semibold text-white transition-colors hover:border-white/25 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B7CFF]"
        onClick={() => setMenuOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Account menu"
      >
        {session.user.image ? (
          <img src={session.user.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          initials
        )}
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-10 z-50 w-[260px] overflow-hidden rounded-lg border border-[#303653] bg-[#171B2D] shadow-[0_18px_60px_rgba(0,0,0,0.42)]"
        >
          <div className="flex items-center gap-3 border-b border-white/10 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/10 text-sm font-semibold text-white">
              {session.user.image ? (
                <img src={session.user.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">{userName}</div>
              <div className="truncate text-xs text-[#8F98B8]">{userEmail}</div>
            </div>
          </div>

          <div className="p-2">
            {onOpenSettings && (
              <Button
                type="button"
                variant="ghost"
                className="h-9 w-full justify-start px-3 text-[#D1D5DB] hover:bg-white/5"
                onClick={() => {
                  setMenuOpen(false)
                  onOpenSettings()
                }}
                role="menuitem"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              className="h-9 w-full justify-start px-3 text-[#D1D5DB] hover:bg-white/5"
              onClick={handleSignOut}
              role="menuitem"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
