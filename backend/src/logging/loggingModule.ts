import { Global, Module } from '@nestjs/common'
import { LoggingService } from './loggingService.ts'

@Global()
@Module({
  providers: [LoggingService],
  exports: [LoggingService],
})
export class LoggingModule {}
