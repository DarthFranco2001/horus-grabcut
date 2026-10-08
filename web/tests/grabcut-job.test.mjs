import assert from 'node:assert/strict'
import { test } from 'node:test'
import { startGrabCutJob } from '../src/browser/grabcutJob.ts'
import { prepareAppearance } from '../src/core/gmm.ts'
import { iterateGrabcut } from '../src/core/grabcut.ts'

const options = {
  image: { width: 4, height: 4, pixels: new Uint8Array(16).fill(42) },
  roi: { x: 1, y: 1, width: 2, height: 2 },
  k: 1,
  iterations: 3,
}

function harness(factoryError = false) {
  const workers = [], results = [], errors = []
  let completed = 0
  const job = startGrabCutJob(() => {
    if (factoryError && workers.length === 1) throw new Error('No se pudo crear el segundo worker')
    const worker = {
      sent: [], terminated: 0,
      postMessage(message) { this.sent.push(structuredClone(message)) },
      terminate() { this.terminated++ },
    }
    workers.push(worker)
    return worker
  }, options, {
    onResult(result, step) { results.push({ result, step }) },
    onComplete() { completed++ },
    onError(message) { errors.push(message) },
  })
  function finish(worker = workers.at(-1)) {
    const request = worker.sent.at(-1)
    const result = request.action === 'initialize'
      ? prepareAppearance(request.pixels, request.labels, request.k)
      : iterateGrabcut(request.image, request.roi, request.labels, request.appearance, request.completed)
    worker.onmessage({ data: { ok: true, action: request.action, result } })
  }
  return { job, workers, results, errors, finish, get completed() { return completed } }
}

test('Segmentar encadena inicialización y exactamente N cortes sin otra acción', () => {
  const h = harness()
  assert.equal(h.workers.length, 1)
  h.finish()
  assert.equal(h.workers.length, 2)
  assert.equal(h.workers[0].terminated, 1)
  assert.equal(h.results.length, 0, 'La inicialización no cuenta como iteración')
  for (let i = 1; i <= options.iterations; i++) {
    h.finish()
    assert.equal(h.results.at(-1).step, i)
    assert.equal(h.results.at(-1).result.iteration, i)
  }
  assert.equal(h.workers[1].sent.length, options.iterations)
  assert.equal(h.workers[1].terminated, 1)
  assert.equal(h.completed, 1)
  assert.deepEqual(h.errors, [])
})

test('detener durante la inicialización impide lanzar los cortes', () => {
  const h = harness()
  h.job.stop()
  h.job.stop()
  h.finish()
  assert.equal(h.workers.length, 1)
  assert.equal(h.workers[0].terminated, 1)
  assert.equal(h.results.length, 0)
  assert.equal(h.completed, 0)
})

test('detener tras un corte conserva el resultado e ignora respuestas tardías', () => {
  const h = harness()
  h.finish()
  h.finish()
  h.job.stop()
  h.finish()
  assert.equal(h.results.length, 1)
  assert.equal(h.workers[1].terminated, 1)
  assert.equal(h.completed, 0)
  assert.deepEqual(h.errors, [])
})

test('un fallo de inicialización o de creación del siguiente worker se comunica', () => {
  const h = harness()
  h.workers[0].onmessage({ data: { ok: false, error: 'Inicialización fallida' } })
  h.finish()
  assert.equal(h.workers.length, 1)
  assert.deepEqual(h.errors, ['Inicialización fallida'])
  const next = harness(true)
  next.finish()
  assert.equal(next.completed, 0)
  assert.equal(next.errors.length, 1)
  assert.match(next.errors[0], /segundo worker/)
})

test('un error de corte conserva resultados y no continúa', () => {
  const h = harness()
  h.finish()
  h.finish()
  h.workers[1].onerror({})
  h.finish()
  assert.equal(h.results.length, 1)
  assert.equal(h.errors.length, 1)
  assert.equal(h.completed, 0)
})

test('valida ROI, K e iteraciones antes de crear workers', () => {
  const factory = () => { assert.fail('No debe crear un worker') }
  assert.throws(() => startGrabCutJob(factory, { ...options, iterations: 0 }, {}), /iteraciones/)
  assert.throws(() => startGrabCutJob(factory, { ...options, k: 5 }, {}), /K/)
  assert.throws(() => startGrabCutJob(factory, { ...options, roi: { x: 0, y: 0, width: 4, height: 4 } }, {}), /fondo/)
})
