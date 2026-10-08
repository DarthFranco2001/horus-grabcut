import type { ImageSize, Roi } from './roi'
import { pixelCount } from './image.ts'

export interface GroundTruth extends ImageSize {
  labels: Uint8Array
  foregroundCount: number
}

export function extractGroundTruth(rgba: Uint8Array | Uint8ClampedArray, size: ImageSize): GroundTruth {
  const count = pixelCount(size)
  if (rgba.length !== count * 4) throw new Error('La anotación no coincide con sus dimensiones.')
  const labels = new Uint8Array(count)
  let foregroundCount = 0
  for (let i = 0; i < count; i++) {
    const offset = i * 4
    if (rgba[offset + 3] !== 255) throw new Error('La anotación debe ser opaca para extraer la referencia.')
    // Repository annotations mark the object in red over the grayscale image.
    labels[i] = Number(rgba[offset] > rgba[offset + 1] && rgba[offset] > rgba[offset + 2])
    foregroundCount += labels[i]
  }
  return { width: size.width, height: size.height, labels, foregroundCount }
}

export function validateMask(labels: Uint8Array, size: ImageSize) {
  if (labels.length !== pixelCount(size)) throw new Error('La máscara no coincide con las dimensiones de la imagen.')
  for (const label of labels) if (label !== 0 && label !== 1) throw new Error('La máscara debe contener etiquetas 0 y 1.')
}

export function compareMasks(prediction: Uint8Array, reference: Uint8Array, size: ImageSize, roi: Roi) {
  validateMask(prediction, size)
  validateMask(reference, size)
  if (![roi.x, roi.y, roi.width, roi.height].every(Number.isSafeInteger)
    || roi.x < 0 || roi.y < 0 || roi.width < 1 || roi.height < 1
    || roi.x + roi.width > size.width || roi.y + roi.height > size.height) {
    throw new Error('La ROI de evaluación debe estar dentro de la imagen.')
  }
  let falsePositives = 0, falseNegatives = 0, predictedCount = 0, referenceCount = 0
  let errorsInRoi = 0, referenceOutsideRoi = 0
  for (let i = 0; i < prediction.length; i++) {
    const predicted = prediction[i], expected = reference[i]
    predictedCount += predicted
    referenceCount += expected
    if (predicted && !expected) falsePositives++
    if (!predicted && expected) falseNegatives++
    const x = i % size.width, y = Math.floor(i / size.width)
    const inside = x >= roi.x && x < roi.x + roi.width && y >= roi.y && y < roi.y + roi.height
    if (inside && predicted !== expected) errorsInRoi++
    if (!inside && expected) referenceOutsideRoi++
  }
  // For binary 0/1 labels, squared error is exactly the number of mismatches.
  return {
    falsePositives, falseNegatives, predictedCount, referenceCount, referenceOutsideRoi,
    mse: (falsePositives + falseNegatives) / prediction.length,
    mseRoi: errorsInRoi / (roi.width * roi.height),
  }
}
