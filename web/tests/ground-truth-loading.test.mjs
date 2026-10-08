import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadGroundTruth } from '../src/browser/groundTruth.ts'

// Exercise the browser loader's failure/cleanup contracts without adding a DOM dependency.
test('carga nativa, errores, tamaños incompatibles y cancelación de referencia', async () => {
  const original = Object.fromEntries(['fetch','createImageBitmap','document'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  let closed = 0, drawn = 0
  const controller = new AbortController()
  const pixels = Uint8ClampedArray.of(255,0,0,255)
  try {
    globalThis.fetch = async (_url, { signal }) => { assert.equal(signal, controller.signal); return { ok: true, blob: async () => ({}) } }
    globalThis.createImageBitmap = async () => ({ width:1, height:1, close() { closed++ } })
    globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() { drawn++ }, getImageData: () => ({ data:pixels }) }) }) }
    const valid = await loadGroundTruth('/horus-grabcut/contours/case.png', { width:1, height:1 }, controller.signal)
    assert.equal(valid.foregroundCount, 1)
    assert.equal(closed, 1)
    await assert.rejects(loadGroundTruth('/test', { width:2, height:1 }, controller.signal), /tamaño diferente/)
    assert.equal(drawn, 1, 'No redimensiona una referencia incompatible')
    assert.equal(closed, 2)
    controller.abort()
    await assert.rejects(loadGroundTruth('/test', { width:1, height:1 }, controller.signal), { name:'AbortError' })
    assert.equal(closed, 3)
    globalThis.fetch = async () => ({ ok:false })
    await assert.rejects(loadGroundTruth('/missing', { width:1, height:1 }, new AbortController().signal), /cargar/)
    globalThis.fetch = async () => ({ ok:true, blob:async () => ({}) })
    globalThis.createImageBitmap = async () => { throw new Error('Imagen dañada') }
    await assert.rejects(loadGroundTruth('/broken', { width:1, height:1 }, new AbortController().signal), /dañada/)
  } finally {
    for (const [key, descriptor] of Object.entries(original)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
})
