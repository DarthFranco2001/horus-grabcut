import type { AppearanceResult } from '../core/gmm'

export interface AppearanceRequest {
  pixels: Uint8Array
  labels: Uint8Array
  k: number
}

export type AppearanceResponse =
  | { ok: true; result: AppearanceResult }
  | { ok: false; error: string }
