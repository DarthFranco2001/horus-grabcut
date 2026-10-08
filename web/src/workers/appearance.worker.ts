import { prepareAppearance } from '../core/gmm'
import type { AppearanceRequest, AppearanceResponse } from './appearance.types'

self.onmessage = (event: MessageEvent<AppearanceRequest>) => {
  try {
    const { pixels, labels, k } = event.data
    const result = prepareAppearance(pixels, labels, k)
    const response: AppearanceResponse = { ok: true, result }
    self.postMessage(response, {
      transfer: [result.backgroundCosts.buffer as ArrayBuffer, result.foregroundCosts.buffer as ArrayBuffer],
    })
  } catch (cause) {
    const response: AppearanceResponse = {
      ok: false,
      error: cause instanceof Error ? cause.message : 'No se pudieron preparar los modelos de apariencia.',
    }
    self.postMessage(response)
  }
}
