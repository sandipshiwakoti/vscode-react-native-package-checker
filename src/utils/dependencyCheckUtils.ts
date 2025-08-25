import * as vscode from 'vscode';

import { PackageChange, ValidationResult } from '../types';

import { parsePackageJson } from './packageUtils';

function cleanVersion(version: string): string {
    return version.replace(/^[\^~]/, '');
}

export function extractCurrentRnVersion(packageJsonContent: string): string | null {
    const packageJson = parsePackageJson(packageJsonContent);
    if (!packageJson) {
        return null;
    }

    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};

    const rnVersion = dependencies['react-native'] || devDependencies['react-native'];
    return rnVersion ? cleanVersion(rnVersion) : null;
}

export function hasVersionDifference(currentVersion: string, expectedVersion: string): boolean {
    return cleanVersion(currentVersion) !== cleanVersion(expectedVersion);
}

export function parseDiff(diffContent: string): PackageChange[] {
    const packageChanges: PackageChange[] = [];
    const lines = diffContent.split('\n');
    let inPackageJson = false;
    let inDependencies = false;
    let currentDependencyType: 'dependencies' | 'devDependencies' | null = null;

    const removals: { [key: string]: { version: string; dependencyType: 'dependencies' | 'devDependencies' } } = {};
    const additions: { [key: string]: { version: string; dependencyType: 'dependencies' | 'devDependencies' } } = {};

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.includes('package.json')) {
            inPackageJson = true;
            continue;
        }

        if (inPackageJson && line.startsWith('diff --git')) {
            inPackageJson = false;
            inDependencies = false;
            currentDependencyType = null;
            continue;
        }

        if (!inPackageJson) {
            continue;
        }

        if (line.includes('"dependencies"') && !line.includes('"devDependencies"')) {
            inDependencies = true;
            currentDependencyType = 'dependencies';
            continue;
        }

        if (line.includes('"devDependencies"')) {
            inDependencies = true;
            currentDependencyType = 'devDependencies';
            continue;
        }

        if (inDependencies && line.includes('}') && !line.includes('"')) {
            inDependencies = false;
            currentDependencyType = null;
            continue;
        }

        if (!inDependencies || !currentDependencyType) {
            continue;
        }

        if (line.startsWith('-') && line.includes(':')) {
            const packageInfo = parsePackageLine(line.substring(1).trim());
            if (packageInfo) {
                removals[packageInfo.name] = {
                    version: packageInfo.version,
                    dependencyType: currentDependencyType,
                };
            }
        }

        if (line.startsWith('+') && line.includes(':')) {
            const packageInfo = parsePackageLine(line.substring(1).trim());
            if (packageInfo) {
                additions[packageInfo.name] = {
                    version: packageInfo.version,
                    dependencyType: currentDependencyType,
                };
            }
        }
    }

    const processedPackages = new Set<string>();

    for (const packageName in removals) {
        if (additions[packageName]) {
            packageChanges.push({
                packageName,
                fromVersion: removals[packageName].version,
                toVersion: additions[packageName].version,
                changeType: 'version_change',
                dependencyType: additions[packageName].dependencyType,
            });
            processedPackages.add(packageName);
        }
    }

    for (const packageName in additions) {
        if (!processedPackages.has(packageName) && !removals[packageName]) {
            if (packageName === '@react-native/new-app-screen') {
                continue;
            }
            packageChanges.push({
                packageName,
                fromVersion: '',
                toVersion: additions[packageName].version,
                changeType: 'addition',
                dependencyType: additions[packageName].dependencyType,
            });
        }
    }

    for (const packageName in removals) {
        if (!processedPackages.has(packageName) && !additions[packageName]) {
            packageChanges.push({
                packageName,
                fromVersion: removals[packageName].version,
                toVersion: '',
                changeType: 'removal',
                dependencyType: removals[packageName].dependencyType,
            });
        }
    }

    return packageChanges;
}

function parsePackageLine(line: string): { name: string; version: string } | null {
    const match = line.match(/"([^"]+)":\s*"([^"]+)"/);
    return match ? { name: match[1], version: match[2] } : null;
}

export function createHoverMessage(
    result: ValidationResult,
    targetVersion: string,
    currentRnVersion?: string
): vscode.MarkdownString {
    let message = `**Dependency Version Check: ${result.packageName}**\n\n`;

    if (result.changeType === 'addition') {
        message += `${result.packageName} should be added for React Native ${targetVersion}\n\n`;
        message += `Expected version: \`${result.expectedVersion}\`\n\n`;
        message += `[Add Package](command:reactNativePackageChecker.addPackage?${encodeURIComponent(JSON.stringify([result.packageName, result.expectedVersion, result.dependencyType]))})`;
    } else if (result.changeType === 'removal') {
        message += `${result.packageName} should be removed for React Native ${targetVersion}\n\n`;
        message += `Current version: \`${result.currentVersion}\`\n\n`;
        message += `[Remove Package](command:reactNativePackageChecker.removePackage?${encodeURIComponent(JSON.stringify([result.packageName]))})`;
    } else {
        message += `Current: \`${result.currentVersion}\`\n\n`;
        message += `Expected for React Native ${targetVersion}: \`${result.expectedVersion}\`\n\n`;
        message += `[Update to Expected Version](command:reactNativePackageChecker.updateToExpected?${encodeURIComponent(JSON.stringify([result.packageName, result.expectedVersion]))})`;
    }

    if (currentRnVersion && currentRnVersion !== targetVersion) {
        const diffUrl = `https://raw.githubusercontent.com/react-native-community/rn-diff-purge/release/${targetVersion}/RnDiffApp/package.json`;
        message += `\n\n---\n\n[View React Native ${targetVersion} package.json reference](${diffUrl})`;
    }

    return new vscode.MarkdownString(message);
}
