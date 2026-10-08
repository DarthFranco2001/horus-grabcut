import { useState } from 'react'
import { Box, Button, RadioButtonGroup, Text } from 'grommet'
import { RoiEditor } from './RoiEditor'
import { readGrayscaleImage, createMaskPreview } from '../browser/imageData'
import { initializeLabels } from '../core/initialization'
import type { InitialLabels } from '../core/initialization'
import type { GrayscaleImage } from '../core/image'
import type { Roi } from '../core/roi'

interface SegmentationWorkspaceProps {
  src: string
  caseId: string
}

interface Initialization {
  result: InitialLabels
  previewUrl: string
}

export function SegmentationWorkspace({ src, caseId }: SegmentationWorkspaceProps) {
  const [roi, setRoi] = useState<Roi | null>(null)
  const [image, setImage] = useState<GrayscaleImage | null>(null)
  const [initialization, setInitialization] = useState<Initialization | null>(null)
  const [view, setView] = useState<'image' | 'mask'>('image')
  const [error, setError] = useState<string | null>(null)

  function changeRoi(next: Roi | null) {
    if (roi?.x === next?.x && roi?.y === next?.y
      && roi?.width === next?.width && roi?.height === next?.height) return
    setRoi(next)
    setInitialization(null)
    setView('image')
    setError(null)
  }

  function imageReady(element: HTMLImageElement) {
    setInitialization(null)
    setView('image')
    setError(null)
    try {
      setImage(readGrayscaleImage(element))
    } catch (cause) {
      setImage(null)
      setError(cause instanceof Error ? cause.message : 'No se pudieron leer los píxeles.')
    }
  }

  function imageFailed() {
    setImage(null)
    setRoi(null)
    setInitialization(null)
    setView('image')
    setError(null)
  }

  function initialize() {
    if (!image || !roi) return
    try {
      const result = initializeLabels(image, roi)
      const previewUrl = createMaskPreview(result)
      setInitialization({ result, previewUrl })
      setView('mask')
      setError(null)
    } catch (cause) {
      setInitialization(null)
      setView('image')
      setError(cause instanceof Error ? cause.message : 'No se pudo inicializar la máscara.')
    }
  }

  const coversImage = !!(image && roi && roi.width === image.width && roi.height === image.height)

  return (
    <Box gap="small">
      <RoiEditor
        src={src}
        caseId={caseId}
        roi={roi}
        onChange={changeRoi}
        onImageReady={imageReady}
        onImageError={imageFailed}
        maskUrl={view === 'mask' ? initialization?.previewUrl : undefined}
        actions={(
          <>
            <Button
              label="Inicializar"
              primary
              disabled={!image || !roi || coversImage || initialization !== null}
              onClick={initialize}
            />
            {initialization && (
              <RadioButtonGroup
                name="image-view"
                aria-label="Vista de la imagen"
                direction="row"
                gap="small"
                options={[
                  { label: 'Imagen', value: 'image' },
                  { label: 'Máscara inicial', value: 'mask' },
                ]}
                value={view}
                onChange={(event) => setView(event.target.value === 'mask' ? 'mask' : 'image')}
              />
            )}
          </>
        )}
      />
      {error && <Text role="alert" color="status-critical">{error}</Text>}
      {initialization && (
        <Box gap="xsmall">
          <Text role="status">
            Región candidata: {initialization.result.foregroundCount.toLocaleString('es-CR')} píxeles
            {' · '}Fondo seguro: {initialization.result.backgroundCount.toLocaleString('es-CR')} píxeles
          </Text>
          <Text size="small">
            Máscara inicial: blanco = región candidata; negro = fondo seguro.
            La segmentación aún no se ha calculado.
          </Text>
        </Box>
      )}
    </Box>
  )
}
