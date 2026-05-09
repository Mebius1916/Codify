import 'dotenv/config'

interface EnvConfig {
  port: number
  renderEndpoint: string
}

export const env: EnvConfig = {
  port: Number(process.env.PORT),
  renderEndpoint: process.env.RENDER_ENDPOINT ?? '',
}
