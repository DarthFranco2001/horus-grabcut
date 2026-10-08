import { rgbaToGrayscale } from '../core/image'
import { cutoutToRgba } from '../core/cutout'
import type { GrayscaleImage } from '../core/image'
import { labelsToRgba } from '../core/initialization'
import type { ImageSize } from '../core/roi'

export function readGrayscaleImage(image: HTMLImageElement): GrayscaleImage {
  if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) {
    throw new Error('Espera a que la imagen termine de cargar.')
  }
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('No se pudieron leer los píxeles de la imagen.')
  // Use native dimensions, regardless of the image's displayed size.
  context.drawImage(image, 0, 0)
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
  return rgbaToGrayscale(data, { width: canvas.width, height: canvas.height })
}

function createPreview(size: ImageSize, rgba: Uint8ClampedArray): string {
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No se pudo dibujar la vista previa.')
  const imageData = context.createImageData(canvas.width, canvas.height)
  imageData.data.set(rgba)
  context.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

export function createMaskPreview(initialization: ImageSize & { labels: Uint8Array }): string {
  return createPreview(initialization, labelsToRgba(initialization.labels, initialization))
}

export function createCutoutPreview(image: GrayscaleImage, labels: Uint8Array): string {
  return createPreview(image, cutoutToRgba(image, labels))
}
