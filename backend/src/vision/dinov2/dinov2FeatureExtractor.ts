import { Injectable } from '@nestjs/common'
import { fileURLToPath } from 'node:url'
import { AutoModel, AutoProcessor, RawImage, Tensor, env } from '@huggingface/transformers'
import type { RgbaImage } from '../utils/pngImage.ts'

const DEFAULT_DINOV2_MODEL_ID = fileURLToPath(new URL('../../../models/dinov2-small', import.meta.url))

export interface DinoPatchFeatures {
  features: Float32Array
  gridWidth: number
  gridHeight: number
  hiddenSize: number
}

interface Dinov2Runtime {
  model: (inputs: Record<string, unknown>) => Promise<Record<string, unknown>>
  processor: (image: RawImage) => Promise<Record<string, unknown>>
}

@Injectable()
export class Dinov2FeatureExtractorService {
  private runtimePromise?: Promise<Dinov2Runtime>

  async extractPatchFeatures(image: RgbaImage): Promise<DinoPatchFeatures> {
    const runtime = await this.getRuntime()

    const rawImage = new RawImage(new Uint8ClampedArray(image.data), image.width, image.height, 4)
    const inputs = await runtime.processor(rawImage)
    const output = await runtime.model(inputs)
    // 输出的token特征
    const tensor = output.last_hidden_state
    if (!(tensor instanceof Tensor)) throw new Error('DINOv2 output missing last_hidden_state tensor')

    //     传入图片数   token数   token特征向量维度 
    const [batchSize, tokenCount, hiddenSize] = tensor.dims
    if (batchSize !== 1 || !tokenCount || !hiddenSize) throw new Error(`Unexpected DINOv2 output shape: ${tensor.dims.join('x')}`)

    const rawFeatures = tensor.data
    if (!(rawFeatures instanceof Float32Array)) throw new Error('DINOv2 output data is not Float32Array')

    const gridWithCls = this.inferPatchGrid(tokenCount - 1)
    const gridWithoutCls = this.inferPatchGrid(tokenCount)
    const hasClsToken = Boolean(gridWithCls)
    const grid = gridWithCls ?? gridWithoutCls
    if (!grid) throw new Error(`Unable to infer DINOv2 patch grid from ${tokenCount} tokens`)

    const patchCount = grid.width * grid.height
    const features = new Float32Array(patchCount * hiddenSize)
    const sourceOffset = hasClsToken ? hiddenSize : 0
    features.set(rawFeatures.subarray(sourceOffset, sourceOffset + features.length))

    return {
      features,
      gridWidth: grid.width,
      gridHeight: grid.height,
      hiddenSize,
    }
  }

  // 获取状态
  private async getRuntime(): Promise<Dinov2Runtime> {
    if (!this.runtimePromise) {
      this.runtimePromise = this.createRuntime()
    }
    return this.runtimePromise
  }

  // 模型加载
  private async createRuntime(): Promise<Dinov2Runtime> {
    env.allowRemoteModels = false
    const [processor, model] = await Promise.all([
      AutoProcessor.from_pretrained(DEFAULT_DINOV2_MODEL_ID, { local_files_only: true }),
      AutoModel.from_pretrained(DEFAULT_DINOV2_MODEL_ID, { local_files_only: true, dtype: 'fp32' }),
    ])

    return {
      processor: processor as unknown as Dinov2Runtime['processor'],
      model: model as unknown as Dinov2Runtime['model'],
    }
  }

  // 把一维token映射为二维网格
  private inferPatchGrid(tokenCount: number): { width: number; height: number } | undefined {
    if (tokenCount <= 0) return undefined
    const side = Math.sqrt(tokenCount)
    if (!Number.isInteger(side)) return undefined
    return { width: side, height: side }
  }
}
