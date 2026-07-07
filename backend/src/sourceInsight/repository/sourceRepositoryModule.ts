import { Module } from '@nestjs/common'
import { SourceRepositoryService } from './sourceRepositoryService.ts'

@Module({
  providers: [SourceRepositoryService],
  exports: [SourceRepositoryService],
})
export class SourceRepositoryModule {}
