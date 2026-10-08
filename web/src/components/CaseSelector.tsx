import { Box, Select } from 'grommet'

interface CaseSelectorProps {
  options: string[]
  value: string
  onChange: (caseId: string) => void
}

export function CaseSelector({
  options,
  value,
  onChange,
}: CaseSelectorProps) {
  return (
    <Box gap="small">
      <label htmlFor="case-select">Imagen de trabajo</label>

      <Select
        id="case-select"
        options={options}
        value={value}
        onChange={({ option }: { option: unknown }) => {
          if (typeof option === 'string') {
            onChange(option)
          }
        }}
      />
    </Box>
  )
}
