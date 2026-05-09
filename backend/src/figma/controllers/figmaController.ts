import { Body, Controller, Post } from '@nestjs/common'
import type { ConvertFigmaDto } from '../dto/convertFigmaDto.ts'
import { FigmaService } from '../services/figmaService.ts'

@Controller('/api/figma')
export class FigmaController {
  constructor(private readonly figmaService: FigmaService) {}

  @Post('/convert')
  convert(@Body() body: ConvertFigmaDto) {
    return this.figmaService.convert(body)
  }
}
