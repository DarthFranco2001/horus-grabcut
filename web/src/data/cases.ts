import catalog from '../generated/cases.json'

export interface ImageCase {
  id: string
  imagePath: string
  annotationPath: string | null
}

export const cases: ImageCase[] = catalog
