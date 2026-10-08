import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import { extractGroundTruth, compareMasks } from '../src/core/evaluation.ts'
import { readRgbaPng } from './helpers/grayscale-png.mjs'

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const reference = JSON.parse(readFileSync(new URL('./fixtures/evaluation-python.json', import.meta.url)))
const cuts = JSON.parse(readFileSync(new URL('./fixtures/grabcut-python.json', import.meta.url)))
for (const fixture of reference.fixtures) {
  test(`ground truth y evaluación Python: ${fixture.caseId}`, () => {
    const path = new URL(`../../data/contours/${fixture.caseId}.png`, import.meta.url)
    assert.equal(hash(readFileSync(path)), fixture.annotationSha256)
    const image = readRgbaPng(path)
    assert.equal(image.width, fixture.width)
    assert.equal(image.height, fixture.height)
    assert.equal(hash(image.rgba), fixture.rgbaSha256, 'El lector RGB coincide con OpenCV')
    const truth = extractGroundTruth(image.rgba, image)
    assert.equal(hash(truth.labels), fixture.labelsSha256)
    assert.equal(truth.foregroundCount, fixture.foregroundCount)
    for (const run of fixture.runs) {
      const encoded = cuts.fixtures.find((f) => f.caseId === fixture.caseId).runs.find((r) => r.k === run.k).iterations[run.iteration - 1].labelsZlibBase64
      const predicted = new Uint8Array(inflateSync(Buffer.from(encoded, 'base64')))
      const metrics = compareMasks(predicted, truth.labels, image, run.roi)
      assert.deepEqual(Object.keys(metrics).sort(), Object.keys(run.metrics).sort())
      for (const [key, expected] of Object.entries(run.metrics)) {
        assert.ok(Math.abs(metrics[key] - expected) < 1e-12, `${key}: ${metrics[key]} != ${expected}`)
      }
    }
  })
}

test('extrae rojo dominante, sin incluir gris, azul, verde o empates de canal', () => {
  const rgba = Uint8Array.from([255,0,0,255, 101,100,100,255, 100,100,100,255, 0,0,255,255, 0,255,0,255, 255,255,0,255])
  const before = rgba.slice()
  const result = extractGroundTruth(rgba, { width: 3, height: 2 })
  assert.deepEqual([...result.labels], [1,1,0,0,0,0])
  assert.equal(result.foregroundCount, 2)
  assert.deepEqual(rgba, before)
  assert.throws(() => extractGroundTruth(Uint8Array.of(255,0,0,0), { width: 1, height: 1 }), /opaca/)
  assert.throws(() => extractGroundTruth(rgba, { width: 1, height: 1 }), /dimensiones/)
})

test('cuenta errores fuera de ROI y distingue MSE global de MSE en la ROI', () => {
  const size = { width: 3, height: 2 }, roi = { x: 0, y: 0, width: 2, height: 1 }
  const prediction = Uint8Array.of(1,1,0,0,0,0), truth = Uint8Array.of(1,0,0,0,0,1)
  const metrics = compareMasks(prediction, truth, size, roi)
  assert.deepEqual(metrics, { falsePositives:1, falseNegatives:1,
    predictedCount:2, referenceCount:2, referenceOutsideRoi:1, mse:1/3, mseRoi:0.5 })
  assert.deepEqual([...truth], [1,0,0,0,0,1])
})

test('coincidencia, disjunción y máscaras vacías no producen NaN ni cifras engañosas', () => {
  const size = { width: 2, height: 2 }, roi = { x: 0, y: 0, ...size }
  const empty = new Uint8Array(4), full = new Uint8Array(4).fill(1)
  const identical = compareMasks(full, full, size, roi)
  assert.equal(identical.falsePositives, 0); assert.equal(identical.falseNegatives, 0); assert.equal(identical.mse, 0)
  const disjoint = compareMasks(empty, full, size, roi)
  assert.equal(disjoint.falsePositives, 0); assert.equal(disjoint.falseNegatives, 4); assert.equal(disjoint.mse, 1)
  const bothEmpty = compareMasks(empty, empty, size, roi)
  assert.equal(bothEmpty.falsePositives, 0); assert.equal(bothEmpty.falseNegatives, 0); assert.equal(bothEmpty.mse, 0)
  assert.throws(() => compareMasks(empty, Uint8Array.of(0), size, roi), /dimensiones/)
  assert.throws(() => compareMasks(Uint8Array.of(0,0,0,2), empty, size, roi), /etiquetas/)
  assert.throws(() => compareMasks(empty, empty, size, { ...roi, x: 1 }), /ROI/)
})

test('una ROI ajena al objeto puede tener MSE menor que uno por los aciertos de fondo', () => {
  const size = { width: 5, height: 2 }
  const roi = { x: 0, y: 0, width: 4, height: 2 }
  const reference = Uint8Array.of(0,0,0,0,1, 0,0,0,0,1)
  const prediction = Uint8Array.of(1,1,1,0,0, 1,1,1,1,0)
  const metrics = compareMasks(prediction, reference, size, roi)
  assert.equal(metrics.falsePositives, 7)
  assert.equal(metrics.falseNegatives, 2)
  assert.equal(metrics.mseRoi, 7 / 8)
  assert.equal(metrics.mse, 9 / 10)
  assert.equal(metrics.referenceOutsideRoi, 2)
})
