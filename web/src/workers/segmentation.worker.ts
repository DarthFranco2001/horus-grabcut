import { prepareAppearance } from '../core/gmm'
import { iterateGrabcut } from '../core/grabcut'
import type { SegmentationRequest, SegmentationResponse } from './segmentation.types'

self.onmessage = (event: MessageEvent<SegmentationRequest>) => {
  try {
    const request = event.data
    let response: SegmentationResponse
    const transfer: ArrayBuffer[] = []
    if (request.action === 'initialize') {
      const result = prepareAppearance(request.pixels, request.labels, request.k)
      response = { ok: true, action: 'initialize', result }
      transfer.push(result.backgroundCosts.buffer as ArrayBuffer, result.foregroundCosts.buffer as ArrayBuffer)
    } else {
      const result = iterateGrabcut(request.image, request.roi, request.labels, request.appearance, request.completed)
      response = { ok: true, action: 'iterate', result }
      transfer.push(result.labels.buffer as ArrayBuffer, result.appearance.backgroundCosts.buffer as ArrayBuffer, result.appearance.foregroundCosts.buffer as ArrayBuffer)
    }
    self.postMessage(response, { transfer })
  } catch (cause) {
    const response: SegmentationResponse = {
      ok: false,
      error: cause instanceof Error ? cause.message : 'No se pudo completar el cálculo.',
    }
    self.postMessage(response)
  }
}
