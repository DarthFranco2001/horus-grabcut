import { useEffect, useRef, useState } from 'react'
import { Box, Button, RadioButtonGroup, Select, Text } from 'grommet'
import { RoiEditor } from './RoiEditor'
import { readGrayscaleImage, createMaskPreview } from '../browser/imageData'
import { initializeLabels } from '../core/initialization'
import type { InitialLabels } from '../core/initialization'
import type { GrayscaleImage } from '../core/image'
import type { Roi } from '../core/roi'
import { validateComponentCount } from '../core/gmm'
import type { AppearanceResult } from '../core/gmm'
import type { AppearanceResponse } from '../workers/appearance.types'

interface SegmentationWorkspaceProps {
  src: string
  caseId: string
  components: number
  onComponentsChange: (k: number) => void
}

interface Initialization {
  result: InitialLabels
  previewUrl: string
}

const componentOptions = Array.from({ length: 10 }, (_, i) => i + 1)

export function SegmentationWorkspace({ src, caseId, components, onComponentsChange }: SegmentationWorkspaceProps) {
  const [roi, setRoi] = useState<Roi | null>(null)
  const [image, setImage] = useState<GrayscaleImage | null>(null)
  const [initialization, setInitialization] = useState<Initialization | null>(null)
  const [view, setView] = useState<'image' | 'mask'>('image')
  const [error, setError] = useState<string | null>(null)
  const [appearance, setAppearance] = useState<AppearanceResult | null>(null)
  const [preparing, setPreparing] = useState(false)
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => () => {
    workerRef.current?.terminate()
    workerRef.current = null
  }, [])

  function cancelAppearance() {
    workerRef.current?.terminate()
    workerRef.current = null
    setPreparing(false)
    setAppearance(null)
  }

  function changeComponents(k: number) {
    if (k === components) return
    cancelAppearance()
    onComponentsChange(k)
    setInitialization(null)
    setView('image')
    setError(null)
  }


  function changeRoi(next: Roi | null) {
    if (roi?.x === next?.x && roi?.y === next?.y
      && roi?.width === next?.width && roi?.height === next?.height) return
    cancelAppearance()
    setRoi(next)
    setInitialization(null)
    setView('image')
    setError(null)
  }

  function imageReady(element: HTMLImageElement) {
    cancelAppearance()
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
    cancelAppearance()
    setImage(null)
    setRoi(null)
    setInitialization(null)
    setView('image')
    setError(null)
  }

  function initialize() {
    if (!image || !roi) return
    cancelAppearance()
    try {
      const result = initializeLabels(image, roi)
      validateComponentCount(components, result.backgroundCount, result.foregroundCount)
      const previewUrl = createMaskPreview(result)
      setInitialization({ result, previewUrl })
      setView('mask')
      setError(null)
      setPreparing(true)

      const worker = new Worker(new URL('../workers/appearance.worker.ts', import.meta.url), { type: 'module' })
      workerRef.current = worker
      worker.onmessage = (event: MessageEvent<AppearanceResponse>) => {
        // Ignore any message queued by a calculation invalidated by a new ROI/K/case.
        if (workerRef.current !== worker) return
        worker.terminate()
        workerRef.current = null
        setPreparing(false)
        if (event.data.ok) setAppearance(event.data.result)
        else setError(event.data.error)
      }
      worker.onerror = () => {
        if (workerRef.current !== worker) return
        cancelAppearance()
        setError('No se pudieron preparar los modelos. Vuelve a inicializar.')
      }
      worker.onmessageerror = () => {
        if (workerRef.current !== worker) return
        cancelAppearance()
        setError('No se pudo recibir el resultado. Vuelve a inicializar.')
      }
      // Transfer copies so the current image and initial labels stay available in the UI.
      const pixels = image.pixels.slice()
      const labels = result.labels.slice()
      worker.postMessage({ pixels, labels, k: components }, [pixels.buffer, labels.buffer])
    } catch (cause) {
      cancelAppearance()
      setInitialization(null)
      setView('image')
      setError(cause instanceof Error ? cause.message : 'No se pudo inicializar la máscara.')
    }
  }

  const coversImage = !!(image && roi && roi.width === image.width && roi.height === image.height)

  return (
    <Box gap="small">
      <Box direction="row" align="center" gap="small" wrap>
        <label htmlFor="gmm-components">Gaussianas por clase (K)</label>
        <Box width="xsmall">
          <Select
            id="gmm-components"
            options={componentOptions}
            value={components}
            onChange={({ option }: { option: unknown }) => {
              if (typeof option === 'number' && componentOptions.includes(option)) changeComponents(option)
            }}
          />
        </Box>
      </Box>
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
              label={preparing ? 'Inicializando…' : 'Inicializar'}
              primary
              disabled={!image || !roi || coversImage || preparing || appearance !== null}
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
      {preparing && <Text role="status" size="small">Preparando modelos de apariencia…</Text>}
      {appearance && <Text role="status" size="small">Modelos de apariencia preparados · K = {appearance.k}.</Text>}
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
