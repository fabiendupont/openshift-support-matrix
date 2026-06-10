import {
  filterSupportedVersions,
  identifyEusVersions,
  parseReleaseTxt
} from '../src/api'
import {EndOfLifeRelease} from '../src/types'
import {expect, test, describe} from '@jest/globals'

function makeRelease(
  name: string,
  overrides: Partial<EndOfLifeRelease> = {}
): EndOfLifeRelease {
  return {
    name,
    label: name,
    releaseDate: '2024-01-01',
    isEol: false,
    eolFrom: '2025-06-01',
    isEoes: null,
    eoesFrom: null,
    isMaintained: true,
    latest: {name: `${name}.10`, date: '2024-06-01', link: ''},
    ...overrides
  }
}

const sampleReleases: EndOfLifeRelease[] = [
  makeRelease('4.20'),
  makeRelease('4.19'),
  makeRelease('4.18', {eoesFrom: '2027-02-25', isEoes: false}),
  makeRelease('4.17', {isEol: true, isMaintained: false}),
  makeRelease('4.16', {
    isEol: true,
    isMaintained: true,
    eoesFrom: '2026-06-27',
    isEoes: false
  }),
  makeRelease('4.15', {isEol: true, isMaintained: false}),
  makeRelease('4.14', {
    isEol: true,
    isMaintained: false,
    eoesFrom: '2025-10-31',
    isEoes: true
  }),
  makeRelease('4.13', {isEol: true, isMaintained: false}),
  makeRelease('3.11', {isEol: true, isMaintained: false})
]

describe('filterSupportedVersions', () => {
  test('includes versions in maintenance support', () => {
    const result = filterSupportedVersions(sampleReleases, '4.14')
    const names = result.map(r => r.name)
    expect(names).toContain('4.20')
    expect(names).toContain('4.19')
    expect(names).toContain('4.18')
  })

  test('includes versions with active EUS', () => {
    const result = filterSupportedVersions(sampleReleases, '4.14')
    const names = result.map(r => r.name)
    expect(names).toContain('4.16')
  })

  test('excludes EOL versions without active EUS', () => {
    const result = filterSupportedVersions(sampleReleases, '4.14')
    const names = result.map(r => r.name)
    expect(names).not.toContain('4.17')
    expect(names).not.toContain('4.15')
  })

  test('excludes versions where EUS has ended', () => {
    const result = filterSupportedVersions(sampleReleases, '4.14')
    const names = result.map(r => r.name)
    expect(names).not.toContain('4.14')
  })

  test('respects min_version filter', () => {
    const result = filterSupportedVersions(sampleReleases, '4.18')
    const names = result.map(r => r.name)
    expect(names).toEqual(['4.18', '4.19', '4.20'])
  })

  test('excludes non-4.x versions', () => {
    const result = filterSupportedVersions(sampleReleases, '3.11')
    const names = result.map(r => r.name)
    expect(names).not.toContain('3.11')
  })

  test('returns sorted by version ascending', () => {
    const result = filterSupportedVersions(sampleReleases, '4.14')
    const names = result.map(r => r.name)
    for (let i = 1; i < names.length; i++) {
      const prev = parseInt(names[i - 1].split('.')[1])
      const curr = parseInt(names[i].split('.')[1])
      expect(curr).toBeGreaterThan(prev)
    }
  })

  test('returns empty array when no versions match', () => {
    const result = filterSupportedVersions(sampleReleases, '4.99')
    expect(result).toEqual([])
  })
})

describe('identifyEusVersions', () => {
  test('returns versions with active EUS', () => {
    const supported = filterSupportedVersions(sampleReleases, '4.14')
    const eus = identifyEusVersions(supported)
    const names = eus.map(r => r.name)
    expect(names).toContain('4.16')
    expect(names).toContain('4.18')
  })

  test('excludes versions without EUS', () => {
    const supported = filterSupportedVersions(sampleReleases, '4.14')
    const eus = identifyEusVersions(supported)
    const names = eus.map(r => r.name)
    expect(names).not.toContain('4.19')
    expect(names).not.toContain('4.20')
  })
})

describe('parseReleaseTxt', () => {
  const sampleTxt = `Client tools for OpenShift
--------------------------

Name:           4.18.42
Digest:         sha256:6d06289d04fe358bc23dcadb3bfdc46b3aaadf2d189a0fecbf3e521bd740378a
Created:        2026-05-14T08:49:02Z
OS/Arch:        linux/amd64
Manifests:      761
Metadata files: 2

Pull From: quay.io/openshift-release-dev/ocp-release@sha256:6d06289d04fe358bc23dcadb3bfdc46b3aaadf2d189a0fecbf3e521bd740378a

Release Metadata:
  Version:  4.18.42

Component Versions:
  kubectl          1.31.1
  kubernetes       1.31.14
  machine-os       418.94.202605101521-0 Red Hat Enterprise Linux CoreOS

Images:
  NAME                                           PULL SPEC
  agent-installer-api-server                     quay.io/openshift-release-dev/ocp-v4.0-art-dev@sha256:abc123
`

  test('parses version', () => {
    const result = parseReleaseTxt(sampleTxt)
    expect(result?.version).toBe('4.18.42')
  })

  test('parses digest', () => {
    const result = parseReleaseTxt(sampleTxt)
    expect(result?.digest).toBe(
      'sha256:6d06289d04fe358bc23dcadb3bfdc46b3aaadf2d189a0fecbf3e521bd740378a'
    )
  })

  test('parses payload pull spec', () => {
    const result = parseReleaseTxt(sampleTxt)
    expect(result?.payload).toBe(
      'quay.io/openshift-release-dev/ocp-release@sha256:6d06289d04fe358bc23dcadb3bfdc46b3aaadf2d189a0fecbf3e521bd740378a'
    )
  })

  test('parses kubernetes version', () => {
    const result = parseReleaseTxt(sampleTxt)
    expect(result?.kubernetes).toBe('1.31.14')
  })

  test('parses RHCOS version', () => {
    const result = parseReleaseTxt(sampleTxt)
    expect(result?.rhcos).toBe('418.94.202605101521-0')
  })

  test('returns null for empty input', () => {
    expect(parseReleaseTxt('')).toBeNull()
  })
})
