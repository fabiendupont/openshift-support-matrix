import * as core from '@actions/core'
import {getSupportMatrix} from './core'

async function run(): Promise<void> {
  try {
    const result = await getSupportMatrix(
      {
        includeEusOnly: core.getInput('include_eus_only') === 'true',
        minVersion: core.getInput('min_version') || '4.14',
        arch: core.getInput('arch') || 'x86_64'
      },
      core.info
    )

    core.setOutput('matrix', JSON.stringify(result.matrix))
    core.setOutput('latest', result.latest)
    core.setOutput('eus', JSON.stringify(result.eus))
    core.setOutput('versions', JSON.stringify(result.versions))

    core.info(
      `Outputs set — matrix: ${result.matrix.length} versions, latest: ${result.latest}`
    )
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
