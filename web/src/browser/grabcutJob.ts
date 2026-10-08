import { initializeLabels } from '../core/initialization.ts'
import { validateComponentCount } from '../core/gmm.ts'
import type { AppearanceResult } from '../core/gmm'
import type { GrayscaleImage } from '../core/image'
import type { Roi } from '../core/roi'
import type { IterationResult } from '../core/grabcut'
import { MAX_ITERATIONS, startSegmentationJob } from './segmentationJob.ts'

type WorkerFactory = Parameters<typeof startSegmentationJob>[0]
type Job = ReturnType<typeof startSegmentationJob>

interface GrabCutOptions {
  image: GrayscaleImage
  roi: Roi
  k: number
  iterations: number
}

interface GrabCutCallbacks {
  onResult: (result: IterationResult, completed: number) => void
  onComplete: () => void
  onError: (message: string) => void
}

// One user action: prepare appearance, then perform exactly the requested cuts.
export function startGrabCutJob(createWorker: WorkerFactory, options: GrabCutOptions, callbacks: GrabCutCallbacks) {
  const { image, roi, k, iterations } = options
  if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > MAX_ITERATIONS) {
    throw new Error(`El número de iteraciones debe ser un entero entre 1 y ${MAX_ITERATIONS}.`)
  }
  const initial = initializeLabels(image, roi)
  validateComponentCount(k, initial.backgroundCount, initial.foregroundCount)
  let active: Job | null = null
  let closed = false
  let generation = 0
  let appearance: AppearanceResult | null = null

  function stop() {
    if (closed) return
    closed = true
    active?.stop()
  }

  function fail(message: string) {
    if (closed) return
    stop()
    callbacks.onError(message)
  }

  function launch(...args: Parameters<typeof startSegmentationJob>) {
    if (closed) return
    const token = ++generation
    try {
      const job = startSegmentationJob(...args)
      if (closed || token !== generation) job.stop()
      else active = job
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : 'No se pudo iniciar la segmentación.')
    }
  }

  launch(createWorker, { action: 'initialize', pixels: image.pixels, labels: initial.labels, k }, 1, {
    onResult(response) {
      if (response.action === 'initialize') appearance = response.result
    },
    onComplete() {
      if (closed || !appearance) return
      launch(createWorker, { action: 'iterate', image, roi, labels: initial.labels, appearance, completed: 0 }, iterations, {
        onResult(response, completed) {
          if (!closed && response.action === 'iterate') callbacks.onResult(response.result, completed)
        },
        onComplete() {
          if (closed) return
          closed = true
          active = null
          callbacks.onComplete()
        },
        onError: fail,
      })
    },
    onError: fail,
  })
  return { stop }
}
