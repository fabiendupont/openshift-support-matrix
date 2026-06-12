#!/usr/bin/env node

import {getSupportMatrix, SupportMatrixResult} from './core'

function parseArgs(argv: string[]): {
  minVersion: string
  arch: string
  eusOnly: boolean
  output: string
} {
  const args = {
    minVersion: '4.14',
    arch: 'x86_64',
    eusOnly: false,
    output: 'json'
  }

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--min-version' && argv[i + 1]) {
      args.minVersion = argv[++i]
    } else if (arg === '--arch' && argv[i + 1]) {
      args.arch = argv[++i]
    } else if (arg === '--eus-only') {
      args.eusOnly = true
    } else if (arg === '--output' && argv[i + 1]) {
      args.output = argv[++i]
    } else if (arg === '--help' || arg === '-h') {
      printUsage()
      process.exit(0)
    }
  }

  return args
}

function printUsage(): void {
  console.log(`Usage: openshift-support-matrix [options]

Options:
  --min-version <version>  Minimum OCP version (default: 4.14)
  --arch <arch>            Architecture: x86_64, aarch64, s390x, ppc64le (default: x86_64)
  --eus-only               Only return EUS versions
  --output <format>        Output format: json, matrix, latest, eus, versions (default: json)
  -h, --help               Show this help message

Output formats:
  json       Full result object with all fields
  matrix     JSON array of version strings
  latest     Latest version string
  eus        JSON array of EUS version strings
  versions   JSON object with extended metadata per version`)
}

function formatOutput(result: SupportMatrixResult, format: string): string {
  switch (format) {
    case 'matrix':
      return JSON.stringify(result.matrix)
    case 'latest':
      return result.latest
    case 'eus':
      return JSON.stringify(result.eus)
    case 'versions':
      return JSON.stringify(result.versions, null, 2)
    default:
      return JSON.stringify(result, null, 2)
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv)

  const result = await getSupportMatrix(
    {
      includeEusOnly: args.eusOnly,
      minVersion: args.minVersion,
      arch: args.arch
    },
    msg => console.error(msg)
  )

  console.log(formatOutput(result, args.output))
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
