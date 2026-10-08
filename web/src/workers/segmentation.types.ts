import type { AppearanceResult } from '../core/gmm'
import type { GrayscaleImage } from '../core/image'
import type { Roi } from '../core/roi'
import type { IterationResult } from '../core/grabcut'

export type SegmentationRequest =
  | { action: 'initialize'; pixels: Uint8Array; labels: Uint8Array; k: number }
  | { action: 'iterate'; image: GrayscaleImage; roi: Roi; labels: Uint8Array; appearance: AppearanceResult; completed: number }

export type SegmentationResponse =
  | { ok: true; action: 'initialize'; result: AppearanceResult }
  | { ok: true; action: 'iterate'; result: IterationResult }
  | { ok: false; error: string }
