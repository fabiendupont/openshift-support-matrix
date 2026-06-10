export interface EndOfLifeRelease {
  name: string
  label: string
  releaseDate: string
  isEol: boolean
  eolFrom: string | null
  isEoes: boolean | null
  eoesFrom: string | null
  isMaintained: boolean
  latest: {
    name: string
    date: string
    link: string
  }
}

export interface EndOfLifeResponse {
  result: {
    releases: EndOfLifeRelease[]
  }
}

export interface ReleaseInfo {
  version: string
  digest: string
  kubernetes: string
  rhcos: string
  payload: string
}

export interface VersionInfo {
  version: string
  latest_version: string
  payload: string
  kubernetes: string
  rhcos: string
  kernel: string | null
  release_date: string
  eol_date: string | null
  eus: boolean
  eus_end_date: string | null
}

export interface ActionInputs {
  includeEusOnly: boolean
  minVersion: string
  arch: string
}
