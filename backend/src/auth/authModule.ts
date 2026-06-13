import { Module } from '@nestjs/common'
import { AuthGuard } from './authGuard.ts'

@Module({
  providers: [AuthGuard],
  exports: [AuthGuard],
})
export class AuthModule {}
