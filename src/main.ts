import * as core from '@actions/core'
import {
  fetchEndOfLifeData,
  filterSupportedVersions,
  identifyEusVersions,
  fetchReleaseInfo,
  fetchKernelVersion,
  fetchCincinnatiVersions
} from './api'
import {EndOfLifeRelease, VersionInfo} from './types'

async function run(): Promise<void> {
  try {
    const includeEusOnly = core.getInput('include_eus_only') === 'true'
    const minVersion = core.getInput('min_version') || '4.14'
    const arch = core.getInput('arch') || 'x86_64'

    let supported: EndOfLifeRelease[]
    let eusReleases: EndOfLifeRelease[]
    let usedFallback = false

    try {
      core.info('Fetching OpenShift lifecycle data from endoflife.date...')
      const allReleases = await fetchEndOfLifeData()
      supported = filterSupportedVersions(allReleases, minVersion)
      eusReleases = identifyEusVersions(supported)
    } catch (e) {
      core.warning(
        `endoflife.date unavailable (${e instanceof Error ? e.message : e}), falling back to Cincinnati graph API`
      )
      core.warning(
        'Cincinnati fallback cannot determine EOL or EUS status — all discovered versions will be included'
      )
      supported = await fetchCincinnatiVersions(minVersion, arch)
      eusReleases = []
      usedFallback = true
    }

    if (usedFallback) {
      core.info(
        'Note: lifecycle data unavailable — EUS output is empty and EOL filtering is skipped'
      )
    }

    const activeReleases = includeEusOnly ? eusReleases : supported
    const versionNames = activeReleases.map(r => r.name)
    const eusNames = eusReleases.map(r => r.name)

    core.info(
      `Found ${versionNames.length} supported versions: ${versionNames.join(', ')}`
    )
    core.info(`EUS versions: ${eusNames.join(', ') || 'none'}`)

    core.info('Fetching extended release metadata...')
    const versionsMap: Record<string, VersionInfo> = {}

    await Promise.all(
      activeReleases.map(async release => {
        const [releaseInfo, kernel] = await Promise.all([
          fetchReleaseInfo(release.name, arch),
          fetchKernelVersion(release.name, arch)
        ])

        const isEus = eusNames.includes(release.name)

        versionsMap[release.name] = {
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

        core.info(
          `  ${release.name}: latest=${versionsMap[release.name].latest_version} k8s=${versionsMap[release.name].kubernetes} kernel=${kernel ?? 'N/A'}`
        )
      })
    )

    const latest = versionNames[versionNames.length - 1] ?? ''

    core.setOutput('matrix', JSON.stringify(versionNames))
    core.setOutput('latest', latest)
    core.setOutput('eus', JSON.stringify(eusNames))
    core.setOutput('versions', JSON.stringify(versionsMap))

    core.info(
      `Outputs set — matrix: ${versionNames.length} versions, latest: ${latest}`
    )
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
