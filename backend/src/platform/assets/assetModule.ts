import { Module } from '@nestjs/common'
import { AssetController } from './assetController.ts'

@Module({
  controllers: [AssetController],
})
export class AssetModule {}
