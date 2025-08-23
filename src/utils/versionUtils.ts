import { REGEX_PATTERNS } from '../constants';

export function compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split(REGEX_PATTERNS.DOT_SEPARATOR).map(Number);
    const v2Parts = version2.split(REGEX_PATTERNS.DOT_SEPARATOR).map(Number);
    const maxLength = Math.max(v1Parts.length, v2Parts.length);

    for (let i = 0; i < maxLength; i++) {
        const v1Part = v1Parts[i] || 0;
        const v2Part = v2Parts[i] || 0;
        if (v1Part > v2Part) {
            return 1;
        }
        if (v1Part < v2Part) {
            return -1;
        }
    }
    return 0;
}

export function cleanVersion(version: string): string {
    return version.replace(REGEX_PATTERNS.VERSION_PREFIX_CLEAN, '');
}

export function extractVersionPrefix(versionString: string): string {
    const match = versionString.match(/^[\^~]/);
    return match ? match[0] : '';
}

export function hasVersionUpdate(currentVersion: string, latestVersion: string): boolean {
    if (!currentVersion || !latestVersion) {
        return false;
    }
    const cleanCurrent = cleanVersion(currentVersion);
    const cleanLatest = cleanVersion(latestVersion);
    return compareVersions(cleanLatest, cleanCurrent) > 0;
}

export function extractVersionFromLine(line: string): string {
    const versionMatch = line.match(/"([^"]+)"/);
    return versionMatch ? versionMatch[1].replace(/^[\^~]/, '') : '';
}

export function extractPackageNameFromVersionString(packageWithVersion: string): string {
    const lastAtIndex = packageWithVersion.lastIndexOf('@');
    if (lastAtIndex === -1 || lastAtIndex === 0) {
        return packageWithVersion;
    }
    return packageWithVersion.substring(0, lastAtIndex);
}

export function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
