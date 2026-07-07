import { Module } from '@nestjs/common'
import { RenderController } from './renderController.ts'
import { RenderService } from './renderService.ts'

@Module({
  controllers: [RenderController],
  providers: [RenderService],
  exports: [RenderService],
})
export class RenderModule {}
