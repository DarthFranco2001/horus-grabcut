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
import type { IterationResult } from '../core/grabcut'
import type { SegmentationRequest, SegmentationResponse } from '../workers/segmentation.types'

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
  const [segmentation, setSegmentation] = useState<(IterationResult & { previewUrl: string }) | null>(null)
  const [busy, setBusy] = useState<'initialize' | 'iterate' | null>(null)
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => () => {
    workerRef.current?.terminate()
    workerRef.current = null
  }, [])

  function stopWorker() {
    workerRef.current?.terminate()
    workerRef.current = null
    setBusy(null)
  }

  function resetCalculation() {
    stopWorker()
    setAppearance(null)
    setSegmentation(null)
  }

  function changeComponents(k: number) {
    if (k === components) return
    resetCalculation()
    onComponentsChange(k)
    setInitialization(null)
    setView('image')
    setError(null)
  }


  function changeRoi(next: Roi | null) {
    if (roi?.x === next?.x && roi?.y === next?.y
      && roi?.width === next?.width && roi?.height === next?.height) return
    resetCalculation()
    setRoi(next)
    setInitialization(null)
    setView('image')
    setError(null)
  }

  function imageReady(element: HTMLImageElement) {
    resetCalculation()
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
    resetCalculation()
    setImage(null)
    setRoi(null)
    setInitialization(null)
    setView('image')
    setError(null)
  }

  function runWorker(request: SegmentationRequest) {
    stopWorker()
    setError(null)
    setBusy(request.action)
    try {
      const worker = new Worker(new URL('../workers/segmentation.worker.ts', import.meta.url), { type: 'module' })
      workerRef.current = worker
      worker.onmessage = (event: MessageEvent<SegmentationResponse>) => {
        // Ignore any message queued by a calculation invalidated by a new ROI/K/case.
        if (workerRef.current !== worker) return
        stopWorker()
        const response = event.data
        if (!response.ok) { setError(response.error); return }
        try {
          if (response.action === 'initialize') setAppearance(response.result)
          else if (request.action === 'iterate') {
            const result = response.result
            const previewUrl = createMaskPreview({ ...request.image, labels: result.labels })
            setSegmentation({ ...result, previewUrl })
            setAppearance(result.appearance)
            setView('mask')
          }
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'No se pudo mostrar el resultado.')
        }
      }
      worker.onerror = () => {
        if (workerRef.current !== worker) return
        stopWorker()
        setError('No se pudo completar el cálculo. Puedes volver a intentarlo.')
      }
      worker.onmessageerror = () => {
        if (workerRef.current !== worker) return
        stopWorker()
        setError('No se pudo recibir el resultado. Puedes volver a intentarlo.')
      }
      // Structured cloning preserves the current image, labels and models for retry/cancellation.
      worker.postMessage(request)
    } catch (cause) {
      stopWorker()
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar el cálculo.')
    }
  }

  function initialize() {
    if (!image || !roi || busy) return
    resetCalculation()
    try {
      const result = initializeLabels(image, roi)
      validateComponentCount(components, result.backgroundCount, result.foregroundCount)
      const previewUrl = createMaskPreview(result)
      setInitialization({ result, previewUrl })
      setView('mask')
      runWorker({ action: 'initialize', pixels: image.pixels, labels: result.labels, k: components })
    } catch (cause) {
      setInitialization(null)
      setView('image')
      setError(cause instanceof Error ? cause.message : 'No se pudo inicializar la máscara.')
    }
  }

  function iterate() {
    if (!image || !roi || !initialization || !appearance || busy) return
    runWorker({
      action: 'iterate', image, roi, appearance,
      labels: segmentation?.labels ?? initialization.result.labels,
      completed: segmentation?.iteration ?? 0,
    })
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
        maskUrl={view === 'mask' ? (segmentation?.previewUrl ?? initialization?.previewUrl) : undefined}
        actions={(
          <>
            <Button
              label={busy === 'initialize' ? 'Inicializando…' : 'Inicializar'}
              primary
              disabled={!image || !roi || coversImage || busy !== null || appearance !== null}
              onClick={initialize}
            />
            <Button
              label={busy === 'iterate' ? 'Calculando…' : 'Ejecutar una iteración'}
              primary={appearance !== null}
              disabled={!appearance || busy !== null}
              onClick={iterate}
            />
            {initialization && (
              <RadioButtonGroup
                name="image-view"
                aria-label="Vista de la imagen"
                direction="row"
                gap="small"
                options={[
                  { label: 'Imagen', value: 'image' },
                  { label: segmentation ? 'Segmentación' : 'Máscara inicial', value: 'mask' },
                ]}
                value={view}
                onChange={(event) => setView(event.target.value === 'mask' ? 'mask' : 'image')}
              />
            )}
          </>
        )}
      />
      {busy && <Text role="status" size="small">{busy === 'initialize' ? 'Preparando modelos de apariencia…' : 'Calculando el corte mínimo…'}</Text>}
      {appearance && !segmentation && !busy && <Text role="status" size="small">Modelos de apariencia preparados · K = {appearance.k}.</Text>}
      {error && <Text role="alert" color="status-critical">{error}</Text>}
      {segmentation && (
        <Box gap="xsmall">
          <Text role="status">
            Iteración {segmentation.iteration} · {segmentation.changed.toLocaleString('es-CR')} píxeles cambiaron
            {' · '}Objeto: {segmentation.foregroundCount.toLocaleString('es-CR')} píxeles.
          </Text>
          <Text size="small">Blanco = objeto; negro = fondo. El exterior de la ROI permanece como fondo.</Text>
          {segmentation.foregroundCount === 0 && <Text size="small">No quedó objeto en esta iteración. Prueba otra ROI o cambia K para reiniciar.</Text>}
          {segmentation.changed === 0 && <Text size="small">La máscara no cambió en esta iteración.</Text>}
        </Box>
      )}
      {initialization && !segmentation && (
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
