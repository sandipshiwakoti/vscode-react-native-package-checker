import * as vscode from 'vscode';

import { NPM_REGISTRY_CONFIG, REGEX_PATTERNS, REQUIREMENTS_CONFIG } from '../constants';
import { CacheManagerService } from '../services/cacheManagerService';
import { VersionOperationQuickPickItem } from '../types';

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

async function getLatestReactNativeVersion(cacheManager?: CacheManagerService): Promise<string> {
    if (cacheManager) {
        const cachedLatestRnVersion = cacheManager.getLatestVersion('react-native');
        if (cachedLatestRnVersion) {
            return cachedLatestRnVersion;
        }
    }

    // If no cache, fetch from npm registry directly
    try {
        const response = await fetch(`${NPM_REGISTRY_CONFIG.BASE_URL}/react-native/latest`);
        if (response.ok) {
            const data = (await response.json()) as { version: string };
            return data?.version;
        }
    } catch {}

    throw new Error('Unable to get React Native version from cache or npm registry');
}

export async function promptForTargetVersion(
    currentRnVersion?: string,
    cacheManager?: CacheManagerService
): Promise<string | undefined> {
    let latestRnVersion: string;
    try {
        latestRnVersion = await getLatestReactNativeVersion(cacheManager);
    } catch {
        // If we can't get latest version, just use current version or empty
        latestRnVersion = currentRnVersion || '';
    }

    const defaultValue = currentRnVersion || latestRnVersion;
    const exampleVersion = latestRnVersion || '0.76.1';

    const version = await vscode.window.showInputBox({
        prompt: `Enter target React Native version (e.g. ${exampleVersion})`,
        placeHolder: latestRnVersion || 'Enter React Native version',
        value: defaultValue,
        validateInput: (value: string) => {
            if (!value) {
                return 'Version is required';
            }
            if (!REQUIREMENTS_CONFIG.VERSION_FORMAT_REGEX.test(value)) {
                return 'Version must be in format x.y.z (e.g., 0.81.1)';
            }

            if (currentRnVersion && isVersionDowngrade(currentRnVersion, value)) {
                return `Target version ${value} is older than current version ${currentRnVersion}. Only upgrades are allowed.`;
            }

            // Let diff API handle version validation
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

export async function getOperationSelectionQuickPick(
    currentRnVersion?: string,
    cacheManager?: CacheManagerService
): Promise<VersionOperationQuickPickItem | undefined> {
    // Get latest version from cache or npm registry
    let latestRnVersion: string | null = null;
    try {
        latestRnVersion = await getLatestReactNativeVersion(cacheManager);
    } catch {
        // If we can't get latest version, we'll only show custom option
    }

    // Use static baseline version from constants
    const baselineVersion = REQUIREMENTS_CONFIG.BASELINE_VERSION;

    const items: VersionOperationQuickPickItem[] = [];

    // Add upgrade option if current version is different from latest and we have latest
    if (currentRnVersion && latestRnVersion && currentRnVersion !== latestRnVersion) {
        items.push({
            label: `Upgrade: ${currentRnVersion} (Current) → ${latestRnVersion} (Latest)`,
            description: 'Check packages needed for upgrading to latest React Native version',
            sourceVersion: currentRnVersion,
            targetVersion: latestRnVersion,
            operationType: 'upgrade',
        });
    }

    // Add full audit option if we have latest version
    if (latestRnVersion) {
        items.push({
            label: `Full Audit: ${baselineVersion} (Baseline) → ${latestRnVersion} (Latest)`,
            description: 'Check all packages against latest React Native requirements',
            sourceVersion: baselineVersion,
            targetVersion: latestRnVersion,
            operationType: 'audit',
        });
    }

    // Add custom version range option
    items.push({
        label: 'Custom version range...',
        description: 'Specify custom source and target versions',
        sourceVersion: '',
        targetVersion: '',
        operationType: 'custom',
    });

    const quickPick = vscode.window.createQuickPick<VersionOperationQuickPickItem>();
    quickPick.title = 'Select Requirements Check Operation';
    quickPick.placeholder = 'Choose how to check React Native requirements';
    quickPick.items = items;
    quickPick.ignoreFocusOut = true;

    return new Promise((resolve) => {
        quickPick.onDidAccept(() => {
            const selectedItem = quickPick.selectedItems[0];
            quickPick.hide();
            resolve(selectedItem);
        });

        quickPick.onDidHide(() => {
            quickPick.dispose();
            resolve(undefined);
        });

        quickPick.show();
    });
}

export async function handleCustomVersionRange(
    currentRnVersion?: string
): Promise<{ sourceVersion: string; targetVersion: string } | undefined> {
    // Use static baseline version from constants
    const baselineVersion = REQUIREMENTS_CONFIG.BASELINE_VERSION;

    // First, get source version
    const sourceVersion = await vscode.window.showInputBox({
        prompt: 'Enter source React Native version (e.g., 0.65.0)',
        placeHolder: currentRnVersion || baselineVersion,
        value: currentRnVersion || baselineVersion,
        validateInput: (value: string) => {
            if (!value) {
                return 'Source version is required';
            }
            if (!REQUIREMENTS_CONFIG.VERSION_FORMAT_REGEX.test(value)) {
                return 'Version must be in format x.y.z (e.g., 0.76.1)';
            }

            // Let diff API handle version validation
            return null;
        },
    });

    if (!sourceVersion) {
        return undefined;
    }

    // Then, get target version
    const targetVersion = await vscode.window.showInputBox({
        prompt: 'Enter target React Native version (e.g., 0.76.1)',
        placeHolder: 'Target version must be newer than source version',
        validateInput: (value: string) => {
            if (!value) {
                return 'Target version is required';
            }
            if (!REQUIREMENTS_CONFIG.VERSION_FORMAT_REGEX.test(value)) {
                return 'Version must be in format x.y.z (e.g., 0.76.1)';
            }
            if (compareVersions(value, sourceVersion) <= 0) {
                return `Target version ${value} must be newer than source version ${sourceVersion}`;
            }

            // Let diff API handle version validation
            return null;
        },
    });

    if (!targetVersion) {
        return undefined;
    }

    return { sourceVersion, targetVersion };
}

export async function promptForVersionOperation(
    currentRnVersion?: string,
    cacheManager?: CacheManagerService
): Promise<{ sourceVersion: string; targetVersion: string } | undefined> {
    const selectedOperation = await getOperationSelectionQuickPick(currentRnVersion, cacheManager);

    if (!selectedOperation) {
        return undefined;
    }

    if (selectedOperation.operationType === 'custom') {
        return await handleCustomVersionRange(currentRnVersion);
    }

    return {
        sourceVersion: selectedOperation.sourceVersion,
        targetVersion: selectedOperation.targetVersion,
    };
}
