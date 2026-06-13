/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL?: string
  readonly MODEL_API?: string
  readonly MODEL_NAME?: string
}

declare module '*.svg' {
  const content: string
  export default content
}

declare module '*?worker' {
  const workerConstructor: {
    new (): Worker
  }
  export default workerConstructor
}
