import {EndOfLifeResponse, EndOfLifeRelease, ReleaseInfo} from './types'

const ENDOFLIFE_URL =
  'https://endoflife.date/api/v1/products/red-hat-openshift/'
const MIRROR_BASE = 'https://mirror.openshift.com/pub/openshift-v4'

export async function fetchEndOfLifeData(): Promise<EndOfLifeRelease[]> {
  const response = await fetch(ENDOFLIFE_URL, {
    headers: {Accept: 'application/json'}
  })
  if (!response.ok) {
    throw new Error(
      `endoflife.date API returned ${response.status}: ${response.statusText}`
    )
  }
  const data = (await response.json()) as EndOfLifeResponse
  return data.result.releases
}

export function filterSupportedVersions(
  releases: EndOfLifeRelease[],
  minVersion: string
): EndOfLifeRelease[] {
  const minParts = parseVersion(minVersion)

  return releases
    .filter(r => {
      if (!r.name.startsWith('4.')) return false
      const parts = parseVersion(r.name)
      if (compareParts(parts, minParts) < 0) return false

      const inMaintenanceSupport = !r.isEol
      const inEus = r.eoesFrom !== null && r.isEoes !== true
      return inMaintenanceSupport || inEus
    })
    .sort((a, b) => compareParts(parseVersion(a.name), parseVersion(b.name)))
}

export function identifyEusVersions(
  releases: EndOfLifeRelease[]
): EndOfLifeRelease[] {
  return releases.filter(r => r.eoesFrom !== null && r.isEoes !== true)
}

export async function fetchReleaseInfo(
  version: string,
  arch: string
): Promise<ReleaseInfo | null> {
  const url = `${MIRROR_BASE}/${arch}/clients/ocp/stable-${version}/release.txt`
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const text = await response.text()
    return parseReleaseTxt(text)
  } catch {
    return null
  }
}

export async function fetchKernelVersion(
  version: string,
  arch: string
): Promise<string | null> {
  const archManifest = arch === 'x86_64' ? 'x86_64' : arch
  const url = `${MIRROR_BASE}/${arch}/dependencies/rhcos/${version}/latest/rhcos-ostree.${archManifest}-manifest.json`
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const data = (await response.json()) as {
      annotations?: Record<string, string>
    }
    return data.annotations?.['ostree.linux'] ?? null
  } catch {
    return null
  }
}

export function parseReleaseTxt(text: string): ReleaseInfo | null {
  const lines = text.split('\n')
  let version = ''
  let digest = ''
  let kubernetes = ''
  let rhcos = ''
  let payload = ''

  for (const line of lines) {
    const nameLine = line.match(/^Name:\s+(.+)/)
    if (nameLine) {
      version = nameLine[1].trim()
      continue
    }

    const digestLine = line.match(/^Digest:\s+(.+)/)
    if (digestLine) {
      digest = digestLine[1].trim()
      continue
    }

    const pullLine = line.match(/^Pull From:\s+(.+)/)
    if (pullLine) {
      payload = pullLine[1].trim()
      continue
    }

    const k8sLine = line.match(/^\s+kubernetes\s+(\S+)/)
    if (k8sLine) {
      kubernetes = k8sLine[1].trim()
      continue
    }

    const rhcosLine = line.match(/^\s+machine-os\s+(\S+)/)
    if (rhcosLine) {
      rhcos = rhcosLine[1].trim()
      continue
    }
  }

  if (!version) return null
  return {version, digest, kubernetes, rhcos, payload}
}

const CINCINNATI_URL = 'https://api.openshift.com/api/upgrades_info/v1/graph'

interface CincinnatiNode {
  version: string
  payload: string
  metadata: Record<string, string>
}

interface CincinnatiResponse {
  nodes: CincinnatiNode[]
}

export async function fetchCincinnatiVersions(
  minVersion: string,
  arch: string
): Promise<EndOfLifeRelease[]> {
  const cincinnatiArch = arch === 'x86_64' ? 'amd64' : arch
  const minMinor = parseInt(minVersion.split('.')[1] ?? '14')
  const releases: EndOfLifeRelease[] = []
  let misses = 0

  for (let minor = minMinor; misses < 2; minor++) {
    const channel = `stable-4.${minor}`
    try {
      const response = await fetch(
        `${CINCINNATI_URL}?channel=${channel}&arch=${cincinnatiArch}`,
        {headers: {Accept: 'application/json'}}
      )
      if (!response.ok) {
        misses++
        continue
      }
      const data = (await response.json()) as CincinnatiResponse
      const versionNodes = data.nodes.filter(n =>
        n.version.startsWith(`4.${minor}.`)
      )
      if (versionNodes.length === 0) {
        misses++
        continue
      }
      misses = 0

      const latest = versionNodes.sort((a, b) => {
        const az = parseInt(a.version.split('.')[2] ?? '0')
        const bz = parseInt(b.version.split('.')[2] ?? '0')
        return bz - az
      })[0]

      releases.push({
        name: `4.${minor}`,
        label: `4.${minor}`,
        releaseDate: '',
        isEol: false,
        eolFrom: null,
        isEoes: null,
        eoesFrom: null,
        isMaintained: true,
        latest: {
          name: latest.version,
          date: '',
          link: ''
        }
      })
    } catch {
      misses++
    }
  }

  return releases
}

function parseVersion(v: string): number[] {
  return v.split('.').map(Number)
}

function compareParts(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0
    const bv = b[i] ?? 0
    if (av !== bv) return av - bv
  }
  return 0
}
