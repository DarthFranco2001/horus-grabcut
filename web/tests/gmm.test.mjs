import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  initializeGmm, componentCosts, assignComponents, updateGmm, gmmCosts,
  splitSamples, prepareAppearance, validateComponentCount,
} from '../src/core/gmm.ts'

const oracle = JSON.parse(readFileSync(new URL('./fixtures/gmm-python.json', import.meta.url), 'utf8'))

function close(actual, expected, context) {
  assert.equal(actual.length, expected.length, context)
  for (let i = 0; i < actual.length; i++) {
    const tolerance = 1e-8 + 1e-10 * Math.abs(expected[i])
    assert.ok(Number.isFinite(actual[i]) && Math.abs(actual[i] - expected[i]) <= tolerance,
      `${context}[${i}]: ${actual[i]} != ${expected[i]} (tolerance ${tolerance})`)
  }
}

function closeModel(actual, expected, context) {
  for (const key of ['weights', 'means', 'variances']) close(actual[key], expected[key], `${context}.${key}`)
}

function fromHistogram(histogram) {
  const samples = new Uint8Array(histogram.reduce((sum, count) => sum + count, 0))
  let offset = 0
  histogram.forEach((count, value) => { samples.fill(value, offset, offset + count); offset += count })
  return samples
}

for (const fixture of oracle.fixtures) {
  for (const run of fixture.runs) {
    test(`paridad Python: ${fixture.caseId}, K=${run.k}, dos clases y 256 intensidades`, () => {
      const query = Uint8Array.from({ length: 256 }, (_, i) => i)
      for (const name of ['background', 'foreground']) {
        const samples = fromHistogram(fixture.histograms[name])
        const expected = run.classes[name]
        const initial = initializeGmm(samples, run.k)
        closeModel(initial, expected.initial, `${name}.initial`)
        assert.deepEqual([...assignComponents(query, initial)], expected.assignments)
        const updated = updateGmm(samples, assignComponents(samples, initial), initial)
        closeModel(updated, expected.updated, `${name}.updated`)
        close(gmmCosts(query, updated), expected.costs, `${name}.costs`)
      }
    })
  }
}

test('pipeline integrado coincide con Python y conserva el orden de los píxeles', () => {
  const fixture = oracle.fixtures.find((entry) => entry.caseId === 'VS-SEG-017')
  const reference = fixture.runs.find((run) => run.k === 5)
  const bg = fromHistogram(fixture.histograms.background)
  const fg = fromHistogram(fixture.histograms.foreground)
  const pixels = new Uint8Array(bg.length + fg.length)
  pixels.set(bg); pixels.set(fg, bg.length)
  const labels = new Uint8Array(pixels.length)
  labels.fill(1, bg.length)
  const beforePixels = pixels.slice()
  const beforeLabels = labels.slice()
  const result = prepareAppearance(pixels, labels)
  assert.equal(result.k, 5)
  for (const name of ['background', 'foreground']) {
    closeModel(result.initialModels[name], reference.classes[name].initial, `${name}.initial`)
    closeModel(result.models[name], reference.classes[name].updated, `${name}.updated`)
    const expected = Float64Array.from(pixels, (pixel) => reference.classes[name].costs[pixel])
    close(result[`${name}Costs`], expected, `${name}.pixelCosts`)
  }
  assert.deepEqual(pixels, beforePixels)
  assert.deepEqual(labels, beforeLabels)
})

test('array_split reparte el resto al principio y no ordena el arreglo original', () => {
  const samples = Uint8Array.of(9, 1, 7, 3, 5)
  const model = initializeGmm(samples, 2)
  close(model.weights, [3 / 5, 2 / 5], 'weights')
  close(model.means, [3, 8], 'means')
  close(model.variances, [8 / 3 + 1e-6, 1 + 1e-6], 'variances')
  assert.deepEqual([...samples], [9, 1, 7, 3, 5])
})

test('intensidad uniforme, empates y componentes vacíos mantienen un GMM válido', () => {
  const samples = new Uint8Array(10).fill(42)
  const initial = initializeGmm(samples, 5)
  const assignments = assignComponents(samples, initial)
  assert.deepEqual([...assignments], Array(10).fill(0))
  const updated = updateGmm(samples, assignments, initial)
  assert.deepEqual([...updated.weights], [1, 0, 0, 0, 0])
  close(updated.means, Array(5).fill(42), 'means')
  close(updated.variances, Array(5).fill(1e-6), 'variances')
  assert.equal(componentCosts(42, updated)[1], Infinity)
  const costs = gmmCosts(Uint8Array.of(0, 42, 255), updated)
  assert.ok([...costs].every(Number.isFinite))
  assert.ok(costs[1] < 0, 'Una densidad puede ser mayor que uno: el costo negativo es válido')
  assert.ok(costs[2] > 1e9, 'El cálculo logarítmico evita el underflow de la densidad')
})

test('una clase vacía al reajustar conserva copias del modelo anterior', () => {
  const previous = initializeGmm(Uint8Array.of(1, 10, 100, 200), 2)
  const next = updateGmm(new Uint8Array(), new Uint32Array(), previous)
  closeModel(next, previous, 'empty')
  assert.notEqual(next.weights, previous.weights)
  assert.notEqual(next.means, previous.means)
  assert.notEqual(next.variances, previous.variances)
})

test('K pequeño y K igual al número de muestras son válidos', () => {
  const samples = Uint8Array.of(10, 20, 30)
  assert.equal(initializeGmm(samples, 1).means[0], 20)
  close(initializeGmm(samples, 3).means, samples, 'means')
})

test('rechaza K inválido, clases insuficientes, etiquetas y parámetros corruptos', () => {
  for (const k of [0, -1, 1.5, NaN, Infinity, 4]) assert.throws(() => initializeGmm(Uint8Array.of(1,2,3), k))
  assert.throws(() => initializeGmm(new Uint8Array(), 1))
  assert.throws(() => initializeGmm(Float64Array.of(NaN), 1))
  assert.throws(() => validateComponentCount(5, 100, 4), /K = 5/)
  assert.throws(() => validateComponentCount(5, 4, 100), /K = 5/)
  assert.throws(() => prepareAppearance(Uint8Array.of(1,2), Uint8Array.of(0,0), 1))
  assert.throws(() => splitSamples(Uint8Array.of(1,2), Uint8Array.of(0,2)))
  assert.throws(() => splitSamples(Uint8Array.of(1,2), Uint8Array.of(0)))
  const valid = initializeGmm(Uint8Array.of(1,2), 1)
  assert.throws(() => updateGmm(Uint8Array.of(1), Uint32Array.of(1), valid))
  assert.throws(() => gmmCosts(Uint8Array.of(1), { ...valid, weights: Float64Array.of(0) }))
  assert.throws(() => gmmCosts(Uint8Array.of(1), { ...valid, variances: Float64Array.of(0) }))
})
