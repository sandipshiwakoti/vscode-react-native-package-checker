import * as vscode from 'vscode';

import { REGEX_PATTERNS, REQUIREMENTS_CONFIG } from '../constants';

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

export async function promptForTargetVersion(
    currentRnVersion?: string,
    cachedLatestRnVersion?: string
): Promise<string | undefined> {
    const latestRnVersion = cachedLatestRnVersion || '';

    const defaultValue =
        currentRnVersion && compareVersions(latestRnVersion, currentRnVersion) > 0
            ? latestRnVersion
            : currentRnVersion || latestRnVersion;

    const version = await vscode.window.showInputBox({
        prompt: `Enter target React Native version (e.g. ${latestRnVersion})`,
        placeHolder: latestRnVersion,
        value: defaultValue,
        validateInput: (value: string) => {
            if (!value) {
                return 'Version is required';
            }
            if (!REQUIREMENTS_CONFIG.VERSION_FORMAT_REGEX.test(value)) {
                return 'Version must be in format x.y.z (e.g., 0.76.1)';
            }

            if (currentRnVersion && isVersionDowngrade(currentRnVersion, value)) {
                return `Target version ${value} is older than current version ${currentRnVersion}. Only upgrades are allowed.`;
            }

            return null;
        },
    });

    return version?.trim();
}

export function isVersionDowngrade(currentVersion: string, targetVersion: string): boolean {
    const cleanCurrent = cleanVersion(currentVersion);
    const cleanTarget = cleanVersion(targetVersion);
    return compareVersions(cleanTarget, cleanCurrent) < 0;
}
