import { createAuthClient } from 'better-auth/react'

const backendUrl = import.meta.env.VITE_BACKEND_URL?.trim() || window.location.origin

export const authClient = createAuthClient({
  baseURL: backendUrl,
  fetchOptions: {
    credentials: 'include',
  },
})

export type AuthClientSession = typeof authClient.$Infer.Session
