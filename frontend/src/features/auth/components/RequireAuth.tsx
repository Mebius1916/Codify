import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { authClient } from '../lib/authClient'

interface RequireAuthProps {
  children: ReactNode
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#101322] text-white">
        <Loader2 className="h-5 w-5 animate-spin text-[#8F98B8]" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/" replace />
  }

  return children
}
