export type BBox = [number, number, number, number]

export interface InternalRegion {
  id: string
  bbox: BBox
  diffScore: number
}
