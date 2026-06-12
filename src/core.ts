import {
  fetchEndOfLifeData,
  filterSupportedVersions,
  identifyEusVersions,
  fetchReleaseInfo,
  fetchKernelVersion,
  fetchCincinnatiVersions
} from './api'
import {EndOfLifeRelease, VersionInfo} from './types'

export interface SupportMatrixOptions {
  includeEusOnly: boolean
  minVersion: string
  arch: string
}

export interface SupportMatrixResult {
  matrix: string[]
  latest: string
  eus: string[]
  versions: Record<string, VersionInfo>
  usedFallback: boolean
}

export async function getSupportMatrix(
  options: SupportMatrixOptions,
  log: (msg: string) => void = () => {}
): Promise<SupportMatrixResult> {
  const {includeEusOnly, minVersion, arch} = options

  let supported: EndOfLifeRelease[]
  let eusReleases: EndOfLifeRelease[]
  let usedFallback = false

  try {
    log('Fetching OpenShift lifecycle data from endoflife.date...')
    const allReleases = await fetchEndOfLifeData()
    supported = filterSupportedVersions(allReleases, minVersion)
    eusReleases = identifyEusVersions(supported)
  } catch (e) {
    log(
      `endoflife.date unavailable (${e instanceof Error ? e.message : e}), falling back to Cincinnati graph API`
    )
    log(
      'Cincinnati fallback cannot determine EOL or EUS status — all discovered versions will be included'
    )
    supported = await fetchCincinnatiVersions(minVersion, arch)
    eusReleases = []
    usedFallback = true
  }

  const activeReleases = includeEusOnly ? eusReleases : supported
  const matrix = activeReleases.map(r => r.name)
  const eus = eusReleases.map(r => r.name)

  log(`Found ${matrix.length} supported versions: ${matrix.join(', ')}`)
  log(`EUS versions: ${eus.join(', ') || 'none'}`)

  log('Fetching extended release metadata...')
  const versions: Record<string, VersionInfo> = {}

  await Promise.all(
    activeReleases.map(async release => {
      const [releaseInfo, kernel] = await Promise.all([
        fetchReleaseInfo(release.name, arch),
        fetchKernelVersion(release.name, arch)
      ])

      const isEus = eus.includes(release.name)

      versions[release.name] = {
        version: release.name,
        latest_version: releaseInfo?.version ?? release.latest.name,
        payload: releaseInfo?.payload ?? '',
        kubernetes: releaseInfo?.kubernetes ?? '',
        rhcos: releaseInfo?.rhcos ?? '',
        kernel,
        release_date: release.releaseDate,
        eol_date: release.eolFrom,
        eus: isEus,
        eus_end_date: isEus ? release.eoesFrom : null
      }

      log(
        `  ${release.name}: latest=${versions[release.name].latest_version} k8s=${versions[release.name].kubernetes} kernel=${kernel ?? 'N/A'}`
      )
    })
  )

  const latest = matrix[matrix.length - 1] ?? ''

  return {matrix, latest, eus, versions, usedFallback}
}
