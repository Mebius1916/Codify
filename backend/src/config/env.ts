import 'dotenv/config'

interface EnvConfig {
  port: number
}

export const env: EnvConfig = {
  port: Number(process.env.PORT),
}
