# Red Hat OpenShift Support Matrix — GitHub Action

A GitHub Action that dynamically retrieves the list of currently supported
Red Hat OpenShift Container Platform (OCP) versions and outputs them as a
JSON matrix for CI workflows.

## Why

CI pipelines that test across supported OCP versions hardcode version lists
that go stale every few months. When a new OCP release GAs or an old one
goes EOL, every workflow that references a static matrix must be updated
manually. This action eliminates that maintenance.

## Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `include_eus_only` | `false` | Only return versions currently in Extended Update Support |
| `min_version` | `4.14` | Exclude versions older than this |
| `arch` | `x86_64` | Architecture filter (`x86_64`, `aarch64`, `s390x`, `ppc64le`) |

## Outputs

| Output | Description |
|--------|-------------|
| `matrix` | JSON array of supported OCP minor versions, e.g. `["4.18","4.19","4.20"]` |
| `latest` | The most recent GA version string |
| `eus` | JSON array of versions currently in Extended Update Support |
| `versions` | JSON object with extended metadata per version (see below) |

### Extended metadata (`versions` output)

Each entry in the `versions` object contains:

```json
{
  "4.18": {
    "version": "4.18",
    "latest_version": "4.18.42",
    "payload": "quay.io/openshift-release-dev/ocp-release@sha256:...",
    "kubernetes": "1.31.14",
    "rhcos": "418.94.202605101521-0",
    "kernel": "5.14.0-427.93.1.el9_4.x86_64",
    "release_date": "2025-02-25",
    "eol_date": "2026-08-25",
    "eus": true,
    "eus_end_date": "2027-02-25"
  }
}
```

| Field | Description |
|-------|-------------|
| `latest_version` | Latest z-stream release |
| `payload` | Release payload image with digest |
| `kubernetes` | Kubernetes version shipped in this release |
| `rhcos` | RHCOS build version |
| `kernel` | RHCOS kernel version (null for versions before 4.18) |
| `release_date` | Initial GA date |
| `eol_date` | End of maintenance support date |
| `eus` | Whether this version has active Extended Update Support |
| `eus_end_date` | EUS end date (null if not an EUS version) |

## Supported version logic

A version is included in the `matrix` output if it meets either condition:

- **Maintenance support** is active (`isEol` is `false` in the lifecycle API), OR
- **Extended Update Support** is active (`eoesFrom` is set and `isEoes` is not `true`)

This means EUS versions remain in the matrix even after regular maintenance
support ends, which matches what most operators and ISVs need for testing.

## Usage

### Basic — dynamic matrix

```yaml
jobs:
  get-matrix:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.ocp.outputs.matrix }}
    steps:
      - uses: fabiendupont/openshift-support-matrix@v1
        id: ocp

  test:
    needs: get-matrix
    runs-on: ubuntu-latest
    strategy:
      matrix:
        ocp-version: ${{ fromJSON(needs.get-matrix.outputs.matrix) }}
    steps:
      - name: Test against OCP ${{ matrix.ocp-version }}
        run: echo "Testing on OCP ${{ matrix.ocp-version }}"
```

### EUS versions only

```yaml
- uses: fabiendupont/openshift-support-matrix@v1
  id: ocp
  with:
    include_eus_only: 'true'
```

### Extended metadata

```yaml
- uses: fabiendupont/openshift-support-matrix@v1
  id: ocp

- name: Show Kubernetes version for each OCP release
  run: |
    echo '${{ steps.ocp.outputs.versions }}' | jq -r 'to_entries[] | "\(.key): k8s \(.value.kubernetes)"'
```

### Multi-architecture

```yaml
- uses: fabiendupont/openshift-support-matrix@v1
  id: ocp
  with:
    arch: aarch64
```

## Data sources

| Source | What it provides |
|--------|-----------------|
| [endoflife.date API](https://endoflife.date/api/v1/products/red-hat-openshift/) | Lifecycle status — which versions are supported, EOL dates, EUS dates |
| [OpenShift mirror](https://mirror.openshift.com/pub/openshift-v4/) `release.txt` | Latest z-stream, payload digest, Kubernetes version, RHCOS build |
| [RHCOS ostree manifest](https://mirror.openshift.com/pub/openshift-v4/) | Kernel version (available for 4.18+) |

If the primary data source (endoflife.date) is unavailable, the action falls
back to the Cincinnati graph API to discover active versions.

## License

Apache-2.0
