#!/usr/bin/env node
require('./sourcemap-register.js');/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 200:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.fetchEndOfLifeData = fetchEndOfLifeData;
exports.filterSupportedVersions = filterSupportedVersions;
exports.identifyEusVersions = identifyEusVersions;
exports.fetchReleaseInfo = fetchReleaseInfo;
exports.fetchKernelVersion = fetchKernelVersion;
exports.parseReleaseTxt = parseReleaseTxt;
exports.fetchCincinnatiVersions = fetchCincinnatiVersions;
const ENDOFLIFE_URL = 'https://endoflife.date/api/v1/products/red-hat-openshift/';
const MIRROR_BASE = 'https://mirror.openshift.com/pub/openshift-v4';
async function fetchEndOfLifeData() {
    const response = await fetch(ENDOFLIFE_URL, {
        headers: { Accept: 'application/json' }
    });
    if (!response.ok) {
        throw new Error(`endoflife.date API returned ${response.status}: ${response.statusText}`);
    }
    const data = (await response.json());
    return data.result.releases;
}
function filterSupportedVersions(releases, minVersion) {
    const minParts = parseVersion(minVersion);
    return releases
        .filter(r => {
        if (!r.name.startsWith('4.'))
            return false;
        const parts = parseVersion(r.name);
        if (compareParts(parts, minParts) < 0)
            return false;
        const inMaintenanceSupport = !r.isEol;
        const inEus = r.eoesFrom !== null && r.isEoes !== true;
        return inMaintenanceSupport || inEus;
    })
        .sort((a, b) => compareParts(parseVersion(a.name), parseVersion(b.name)));
}
function identifyEusVersions(releases) {
    return releases.filter(r => r.eoesFrom !== null && r.isEoes !== true);
}
async function fetchReleaseInfo(version, arch) {
    const url = `${MIRROR_BASE}/${arch}/clients/ocp/stable-${version}/release.txt`;
    try {
        const response = await fetch(url);
        if (!response.ok)
            return null;
        const text = await response.text();
        return parseReleaseTxt(text);
    }
    catch {
        return null;
    }
}
async function fetchKernelVersion(version, arch) {
    const archManifest = arch === 'x86_64' ? 'x86_64' : arch;
    const url = `${MIRROR_BASE}/${arch}/dependencies/rhcos/${version}/latest/rhcos-ostree.${archManifest}-manifest.json`;
    try {
        const response = await fetch(url);
        if (!response.ok)
            return null;
        const data = (await response.json());
        return data.annotations?.['ostree.linux'] ?? null;
    }
    catch {
        return null;
    }
}
function parseReleaseTxt(text) {
    const lines = text.split('\n');
    let version = '';
    let digest = '';
    let kubernetes = '';
    let rhcos = '';
    let payload = '';
    for (const line of lines) {
        const nameLine = line.match(/^Name:\s+(.+)/);
        if (nameLine) {
            version = nameLine[1].trim();
            continue;
        }
        const digestLine = line.match(/^Digest:\s+(.+)/);
        if (digestLine) {
            digest = digestLine[1].trim();
            continue;
        }
        const pullLine = line.match(/^Pull From:\s+(.+)/);
        if (pullLine) {
            payload = pullLine[1].trim();
            continue;
        }
        const k8sLine = line.match(/^\s+kubernetes\s+(\S+)/);
        if (k8sLine) {
            kubernetes = k8sLine[1].trim();
            continue;
        }
        const rhcosLine = line.match(/^\s+machine-os\s+(\S+)/);
        if (rhcosLine) {
            rhcos = rhcosLine[1].trim();
            continue;
        }
    }
    if (!version)
        return null;
    return { version, digest, kubernetes, rhcos, payload };
}
const CINCINNATI_URL = 'https://api.openshift.com/api/upgrades_info/v1/graph';
async function fetchCincinnatiVersions(minVersion, arch) {
    const cincinnatiArch = arch === 'x86_64' ? 'amd64' : arch;
    const minMinor = parseInt(minVersion.split('.')[1] ?? '14');
    const releases = [];
    let misses = 0;
    for (let minor = minMinor; misses < 2; minor++) {
        const channel = `stable-4.${minor}`;
        try {
            const response = await fetch(`${CINCINNATI_URL}?channel=${channel}&arch=${cincinnatiArch}`, { headers: { Accept: 'application/json' } });
            if (!response.ok) {
                misses++;
                continue;
            }
            const data = (await response.json());
            const versionNodes = data.nodes.filter(n => n.version.startsWith(`4.${minor}.`));
            if (versionNodes.length === 0) {
                misses++;
                continue;
            }
            misses = 0;
            const latest = versionNodes.sort((a, b) => {
                const az = parseInt(a.version.split('.')[2] ?? '0');
                const bz = parseInt(b.version.split('.')[2] ?? '0');
                return bz - az;
            })[0];
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
            });
        }
        catch {
            misses++;
        }
    }
    return releases;
}
function parseVersion(v) {
    return v.split('.').map(Number);
}
function compareParts(a, b) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const av = a[i] ?? 0;
        const bv = b[i] ?? 0;
        if (av !== bv)
            return av - bv;
    }
    return 0;
}


/***/ }),

/***/ 469:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getSupportMatrix = getSupportMatrix;
const api_1 = __nccwpck_require__(200);
async function getSupportMatrix(options, log = () => { }) {
    const { includeEusOnly, minVersion, arch } = options;
    let supported;
    let eusReleases;
    let usedFallback = false;
    try {
        log('Fetching OpenShift lifecycle data from endoflife.date...');
        const allReleases = await (0, api_1.fetchEndOfLifeData)();
        supported = (0, api_1.filterSupportedVersions)(allReleases, minVersion);
        eusReleases = (0, api_1.identifyEusVersions)(supported);
    }
    catch (e) {
        log(`endoflife.date unavailable (${e instanceof Error ? e.message : e}), falling back to Cincinnati graph API`);
        log('Cincinnati fallback cannot determine EOL or EUS status — all discovered versions will be included');
        supported = await (0, api_1.fetchCincinnatiVersions)(minVersion, arch);
        eusReleases = [];
        usedFallback = true;
    }
    const activeReleases = includeEusOnly ? eusReleases : supported;
    const matrix = activeReleases.map(r => r.name);
    const eus = eusReleases.map(r => r.name);
    log(`Found ${matrix.length} supported versions: ${matrix.join(', ')}`);
    log(`EUS versions: ${eus.join(', ') || 'none'}`);
    log('Fetching extended release metadata...');
    const versions = {};
    await Promise.all(activeReleases.map(async (release) => {
        const [releaseInfo, kernel] = await Promise.all([
            (0, api_1.fetchReleaseInfo)(release.name, arch),
            (0, api_1.fetchKernelVersion)(release.name, arch)
        ]);
        const isEus = eus.includes(release.name);
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
        };
        log(`  ${release.name}: latest=${versions[release.name].latest_version} k8s=${versions[release.name].kubernetes} kernel=${kernel ?? 'N/A'}`);
    }));
    const latest = matrix[matrix.length - 1] ?? '';
    return { matrix, latest, eus, versions, usedFallback };
}


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it uses a non-standard name for the exports (exports).
(() => {
var exports = __webpack_exports__;

Object.defineProperty(exports, "__esModule", ({ value: true }));
const core_1 = __nccwpck_require__(469);
function parseArgs(argv) {
    const args = {
        minVersion: '4.14',
        arch: 'x86_64',
        eusOnly: false,
        output: 'json'
    };
    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--min-version' && argv[i + 1]) {
            args.minVersion = argv[++i];
        }
        else if (arg === '--arch' && argv[i + 1]) {
            args.arch = argv[++i];
        }
        else if (arg === '--eus-only') {
            args.eusOnly = true;
        }
        else if (arg === '--output' && argv[i + 1]) {
            args.output = argv[++i];
        }
        else if (arg === '--help' || arg === '-h') {
            printUsage();
            process.exit(0);
        }
    }
    return args;
}
function printUsage() {
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
  versions   JSON object with extended metadata per version`);
}
function formatOutput(result, format) {
    switch (format) {
        case 'matrix':
            return JSON.stringify(result.matrix);
        case 'latest':
            return result.latest;
        case 'eus':
            return JSON.stringify(result.eus);
        case 'versions':
            return JSON.stringify(result.versions, null, 2);
        default:
            return JSON.stringify(result, null, 2);
    }
}
async function main() {
    const args = parseArgs(process.argv);
    const result = await (0, core_1.getSupportMatrix)({
        includeEusOnly: args.eusOnly,
        minVersion: args.minVersion,
        arch: args.arch
    }, msg => console.error(msg));
    console.log(formatOutput(result, args.output));
}
main().catch(e => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
});

})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=index.js.map