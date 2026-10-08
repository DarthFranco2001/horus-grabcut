import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import { test } from 'node:test'
import { readGrayscalePng } from './helpers/grayscale-png.mjs'
import { prepareAppearance } from '../src/core/gmm.ts'
import { initializeLabels } from '../src/core/initialization.ts'
import { iterateGrabcut } from '../src/core/grabcut.ts'

const reference = JSON.parse(readFileSync(new URL('./fixtures/grabcut-python.json', import.meta.url)))
const hash = (data) => createHash('sha256').update(data).digest('hex')
const close = (a, b) => assert.ok(Math.abs(a - b) <= 1e-7 + 1e-9 * Math.abs(b), `${a} != ${b}`)
for (const fixture of reference.fixtures) for (const run of fixture.runs) {
  test(`tres iteraciones coinciden con Python: ${fixture.caseId}, K=${run.k}`, () => {
    const path = new URL(`../../data/images/${fixture.caseId}.png`, import.meta.url)
    assert.equal(hash(readFileSync(path)), fixture.imageSha256)
    const image = readGrayscalePng(path)
    assert.equal(hash(image.pixels), fixture.pixelsSha256, 'La lectura PNG coincide con OpenCV')
    const initial = initializeLabels(image, fixture.roi)
    let labels = initial.labels
    let appearance = prepareAppearance(image.pixels, labels, run.k)
    for (const [iteration, expected] of run.iterations.entries()) {
      const original = labels.slice()
      const result = iterateGrabcut(image, fixture.roi, labels, appearance, iteration)
      assert.deepEqual(result.labels, new Uint8Array(inflateSync(Buffer.from(expected.labelsZlibBase64, 'base64'))))
      assert.deepEqual(labels, original, 'No modifica las etiquetas de entrada')
      assert.equal(result.iteration, iteration + 1)
      assert.equal(result.changed, expected.changed)
      assert.equal(result.foregroundCount, expected.foregroundCount)
      close(result.energyBefore, expected.energyBefore)
      close(result.energyAfter, expected.energyAfter)
      close(result.beta, fixture.beta)
      assert.equal(result.gamma, reference.gamma)
      assert.ok(result.energyAfter <= result.energyBefore + 1e-7)
      for (let i = 0; i < result.labels.length; i++) if (!initial.labels[i]) assert.equal(result.labels[i], 0)
      labels = result.labels
      appearance = result.appearance
    }
  })
}

test('imagen uniforme: máscara vacía válida, clase vacía reutilizable y sin NaN', () => {
  const image = { width: 4, height: 4, pixels: new Uint8Array(16).fill(42) }
  const roi = { x: 1, y: 1, width: 2, height: 2 }
  const initial = initializeLabels(image, roi)
  const prepared = prepareAppearance(image.pixels, initial.labels, 4)
  const first = iterateGrabcut(image, roi, initial.labels, prepared, 0)
  assert.equal(first.foregroundCount, 0)
  const second = iterateGrabcut(image, roi, first.labels, first.appearance, 1)
  assert.equal(second.changed, 0)
  assert.ok(Number.isFinite(second.energyAfter))
  assert.ok(second.energyAfter < 0, 'Los costos negativos conservan la constante retirada')
  assert.throws(() => iterateGrabcut(image, roi, Uint8Array.of(0), prepared, 0))
  assert.throws(() => iterateGrabcut(image, roi, initial.labels, prepared, -1))
  const corrupt = initial.labels.slice(); corrupt[0] = 1
  assert.throws(() => iterateGrabcut(image, roi, corrupt, prepared, 0), /exterior/)
})
