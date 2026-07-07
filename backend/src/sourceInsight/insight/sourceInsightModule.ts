import { Module } from '@nestjs/common'
import { SourceRepositoryModule } from '../repository/sourceRepositoryModule.ts'
import { SourceInsightService } from './sourceInsightService.ts'

@Module({
  imports: [SourceRepositoryModule],
  providers: [SourceInsightService],
  exports: [SourceInsightService],
})
export class SourceInsightModule {}
