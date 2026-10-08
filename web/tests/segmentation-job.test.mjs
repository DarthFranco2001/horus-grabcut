import assert from 'node:assert/strict'
import { test } from 'node:test'
import { startSegmentationJob } from '../src/browser/segmentationJob.ts'
import { prepareAppearance } from '../src/core/gmm.ts'
import { initializeLabels } from '../src/core/initialization.ts'
import { iterateGrabcut } from '../src/core/grabcut.ts'

function request() {
  const image = { width: 4, height: 4, pixels: new Uint8Array(16).fill(42) }
  const roi = { x: 1, y: 1, width: 2, height: 2 }
  const { labels } = initializeLabels(image, roi)
  return { action: 'iterate', image, roi, labels, appearance: prepareAppearance(image.pixels, labels, 1), completed: 0 }
}

function harness(first = request(), total = 5) {
  const sent = [], results = [], failures = []
  let terminated = 0, completed = 0
  const worker = {
    postMessage(message) { sent.push(structuredClone(message)) },
    terminate() { terminated++ },
  }
  const job = startSegmentationJob(() => worker, first, total, {
    onResult(response, step) { results.push({ response: structuredClone(response), step }) },
    onError(message) { failures.push(message) },
    onComplete() { completed++ },
  })
  function finish(index = sent.length - 1) {
    const current = sent[index]
    const result = current.action === 'initialize'
      ? prepareAppearance(current.pixels, current.labels, current.k)
      : iterateGrabcut(current.image, current.roi, current.labels, current.appearance, current.completed)
    worker.onmessage({ data: { ok: true, action: current.action, result } })
  }
  return { worker, sent, results, failures, job, finish, get terminated() { return terminated }, get completed() { return completed } }
}

test('ejecuta cinco cortes secuenciales y no se detiene porque una máscara no cambie', () => {
  const h = harness()
  for (let step = 1; step <= 5; step++) {
    assert.equal(h.sent.length, step, 'No hay dos cálculos simultáneos')
    h.finish()
    assert.equal(h.results.at(-1).step, step)
    assert.equal(h.results.at(-1).response.result.iteration, step)
  }
  assert.equal(h.sent.length, 5)
  assert.equal(h.completed, 1)
  assert.equal(h.terminated, 1)
  assert.equal(h.results[1].response.result.changed, 0)
  assert.deepEqual(h.failures, [])
  for (let i = 1; i < h.sent.length; i++) {
    assert.deepEqual(h.sent[i].labels, h.results[i - 1].response.result.labels)
    assert.deepEqual(h.sent[i].appearance, h.results[i - 1].response.result.appearance)
  }
})

test('detener conserva el último resultado, ignora mensajes tardíos y permite continuar', () => {
  const h = harness()
  h.finish()
  h.finish()
  h.job.stop()
  h.job.stop()
  const accepted = structuredClone(h.results)
  h.finish() // A queued response from the terminated worker must be ignored.
  h.worker.onerror({})
  h.worker.onmessageerror({})
  assert.deepEqual(h.results, accepted)
  assert.equal(h.results.length, 2)
  assert.equal(h.sent.length, 3)
  assert.equal(h.terminated, 1)
  assert.equal(h.completed, 0)
  assert.deepEqual(h.failures, [])
  const last = h.results.at(-1).response.result
  const resumed = harness({ ...request(), labels: last.labels, appearance: last.appearance, completed: last.iteration }, 1)
  resumed.finish()
  assert.equal(resumed.results[0].response.result.iteration, 3)
  assert.equal(resumed.completed, 1)
})

test('cancelar antes del primer resultado impide que una ROI/caso anterior se publique', () => {
  const h = harness()
  h.job.stop()
  h.finish()
  assert.equal(h.results.length, 0)
  assert.equal(h.sent.length, 1)
  assert.equal(h.completed, 0)
})

test('un error a mitad conserva resultados y no programa más cortes', () => {
  for (const kind of ['response', 'error', 'messageerror']) {
    const h = harness()
    h.finish()
    if (kind === 'response') h.worker.onmessage({ data: { ok: false, error: 'Fallo de prueba' } })
    else if (kind === 'error') h.worker.onerror({})
    else h.worker.onmessageerror({})
    h.finish()
    assert.equal(h.results.length, 1)
    assert.equal(h.sent.length, 2)
    assert.equal(h.terminated, 1)
    assert.equal(h.completed, 0)
    assert.equal(h.failures.length, 1)
  }
})

test('rechaza límites inválidos antes de crear un worker', () => {
  for (const value of [0, -1, 1.5, 21, NaN, Infinity]) {
    assert.throws(() => startSegmentationJob(() => { throw new Error('No debe crear worker') }, request(), value, {}), /entero entre 1 y 20/)
  }
})

test('una iteración manual y la inicialización terminan sin iniciar un lote', () => {
  const first = request()
  const manual = harness(first, 1)
  manual.finish()
  assert.equal(manual.sent.length, 1)
  assert.equal(manual.completed, 1)
  const initialize = harness({ action: 'initialize', pixels: first.image.pixels, labels: first.labels, k: 1 }, 1)
  initialize.finish()
  assert.equal(initialize.results[0].response.action, 'initialize')
  assert.equal(initialize.completed, 1)
})

test('fallos al enviar o presentar resultados cierran el worker y permiten reintentar', () => {
  for (const phase of ['postMessage', 'onResult']) {
    let terminated = 0
    const failures = []
    const worker = {
      postMessage() { if (phase === 'postMessage') throw new Error('No se pudo enviar') },
      terminate() { terminated++ },
    }
    startSegmentationJob(() => worker, request(), 5, {
      onResult() { throw new Error('No se pudo mostrar') },
      onError(error) { failures.push(error) },
      onComplete() { assert.fail('No debe terminar con éxito') },
    })
    if (phase === 'onResult') worker.onmessage({ data: { ok: true, action: 'iterate', result: {} } })
    assert.equal(terminated, 1)
    assert.equal(failures.length, 1)
  }
})
