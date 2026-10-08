import { useMemo } from 'react'
import { Box, Text } from 'grommet'
import { compareMasks } from '../core/evaluation'
import type { GroundTruth } from '../core/evaluation'
import type { Roi } from '../core/roi'
import './ReferenceComparison.css'

const decimal = (value: number) => value.toLocaleString('es-CR', { minimumFractionDigits: 6, maximumFractionDigits: 6 })
const count = (value: number) => value.toLocaleString('es-CR')

interface ReferenceMetricsProps {
  reference: GroundTruth
  prediction: Uint8Array
  roi: Roi
  annotationUrl: string
  caseId: string
}

export function ReferenceMetrics({ reference, prediction, roi, annotationUrl, caseId }: ReferenceMetricsProps) {
  const metrics = useMemo(() => compareMasks(prediction, reference.labels, reference, roi), [prediction, reference, roi])
  return (
    <Box as="section" className="reference-section" aria-label="Evaluación con la referencia médica" border={{ side: 'top' }} pad={{ top: 'small' }} gap="small">
      <Text weight="bold">Evaluación · referencia médica</Text>
      <div className="reference-evaluation">
        <Box gap="small">
          <Text><strong>Falsos positivos:</strong> {count(metrics.falsePositives)} píxeles</Text>
          <Text><strong>Falsos negativos:</strong> {count(metrics.falseNegatives)} píxeles</Text>
          <Text><strong>MSE global:</strong> {decimal(metrics.mse)}</Text>
          <Text><strong>MSE en la ROI:</strong> {decimal(metrics.mseRoi)}</Text>
          {metrics.referenceOutsideRoi > 0 && (
            <Text size="small">{count(metrics.referenceOutsideRoi)} píxeles de referencia están fuera de la ROI y cuentan en la evaluación.</Text>
          )}
        </Box>
        <Box as="figure" className="reference-image-frame" margin="none">
          <img
            className="reference-evaluation-image"
            src={annotationUrl}
            alt={`Anotación médica de referencia del caso ${caseId}`}
            width={reference.width}
            height={reference.height}
          />
        </Box>
      </div>
    </Box>
  )
}
