import type { SegmentationRequest, SegmentationResponse } from '../workers/segmentation.types'

export const DEFAULT_ITERATIONS = 5
export const MAX_ITERATIONS = 20

type WorkerPort = Pick<Worker, 'onmessage' | 'onerror' | 'onmessageerror' | 'postMessage' | 'terminate'>
type SuccessfulResponse = Extract<SegmentationResponse, { ok: true }>

interface JobCallbacks {
  onResult: (response: SuccessfulResponse, completed: number) => void
  onComplete: () => void
  onError: (message: string) => void
}

// One request at a time. Only a completed result becomes the input to the next cut.
// The injected worker factory lets tests exercise cancellation without a browser.
export function startSegmentationJob(
  createWorker: () => WorkerPort,
  firstRequest: SegmentationRequest,
  iterations: number,
  callbacks: JobCallbacks,
) {
  if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > MAX_ITERATIONS
    || (firstRequest.action === 'initialize' && iterations !== 1)) {
    throw new Error(`El número de iteraciones debe ser un entero entre 1 y ${MAX_ITERATIONS}.`)
  }
  const worker = createWorker()
  let closed = false
  let completed = 0
  let request = firstRequest

  function stop() {
    if (closed) return
    closed = true
    worker.terminate()
  }

  function fail(message: string) {
    if (closed) return
    stop()
    callbacks.onError(message)
  }

  function send() {
    try {
      // Structured cloning keeps the last accepted mask/models available after cancellation.
      worker.postMessage(request)
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : 'No se pudo iniciar el cálculo.')
    }
  }

  worker.onmessage = (event: MessageEvent<SegmentationResponse>) => {
    if (closed) return
    const response = event.data
    if (!response.ok) { fail(response.error); return }
    if (response.action !== request.action) { fail('Se recibió un resultado inesperado. Vuelve a intentarlo.'); return }
    try {
      callbacks.onResult(response, ++completed)
      if (closed) return
      if (completed === iterations) {
        stop()
        callbacks.onComplete()
      } else if (request.action === 'iterate' && response.action === 'iterate') {
        request = {
          ...request,
          labels: response.result.labels,
          appearance: response.result.appearance,
          completed: response.result.iteration,
        }
        send()
      }
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : 'No se pudo mostrar el resultado.')
    }
  }
  worker.onerror = () => fail('No se pudo completar el cálculo. Puedes volver a intentarlo.')
  worker.onmessageerror = () => fail('No se pudo recibir el resultado. Puedes volver a intentarlo.')
  send()
  return { stop }
}
