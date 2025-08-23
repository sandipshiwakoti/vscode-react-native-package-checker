import * as vscode from 'vscode';

import { PackageChange, ValidationResult } from '../types';

/**
 * Removes version prefix characters (^ or ~)
 */
function cleanVersion(version: string): string {
    return version.replace(/^[\^~]/, '');
}

/**
 * Extracts React Native version from package.json content
 */
export function extractCurrentRnVersion(packageJsonContent: string): string | null {
    try {
        const packageJson = JSON.parse(packageJsonContent);
        const dependencies = packageJson.dependencies || {};
        const devDependencies = packageJson.devDependencies || {};

        const rnVersion = dependencies['react-native'] || devDependencies['react-native'];
        return rnVersion ? cleanVersion(rnVersion) : null;
    } catch {
        return null;
    }
}

/**
 * Checks if there's a version difference between current and expected
 */
export function hasVersionDifference(currentVersion: string, expectedVersion: string): boolean {
    return cleanVersion(currentVersion) !== cleanVersion(expectedVersion);
}

/**
 * Parses diff content to extract package changes
 */
export function parseDiff(diffContent: string): PackageChange[] {
    const packageChanges: PackageChange[] = [];
    const lines = diffContent.split('\n');
    let inPackageJson = false;
    let inDependencies = false;

    // Collect all removals and additions separately
    const removals: { [key: string]: string } = {};
    const additions: { [key: string]: string } = {};

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.includes('package.json')) {
            inPackageJson = true;
            continue;
        }

        if (inPackageJson && line.startsWith('diff --git')) {
            inPackageJson = false;
            inDependencies = false;
            continue;
        }

        if (!inPackageJson) {
            continue;
        }

        if (line.includes('"dependencies"') || line.includes('"devDependencies"')) {
            inDependencies = true;
            continue;
        }

        if (inDependencies && line.includes('}') && !line.includes('"')) {
            inDependencies = false;
            continue;
        }

        if (!inDependencies) {
            continue;
        }

        // Collect removals
        if (line.startsWith('-') && line.includes(':')) {
            const packageInfo = parsePackageLine(line.substring(1).trim());
            if (packageInfo) {
                removals[packageInfo.name] = packageInfo.version;
            }
        }

        // Collect additions
        if (line.startsWith('+') && line.includes(':')) {
            const packageInfo = parsePackageLine(line.substring(1).trim());
            if (packageInfo) {
                additions[packageInfo.name] = packageInfo.version;
            }
        }
    }

    // Match removals with additions to create version changes
    for (const packageName in removals) {
        if (additions[packageName]) {
            packageChanges.push({
                packageName,
                fromVersion: removals[packageName],
                toVersion: additions[packageName],
                changeType: 'version_change',
            });
        }
    }

    return packageChanges;
}

/**
 * Parses a package line to extract name and version
 */
function parsePackageLine(line: string): { name: string; version: string } | null {
    const match = line.match(/"([^"]+)":\s*"([^"]+)"/);
    return match ? { name: match[1], version: match[2] } : null;
}

/**
 * Creates hover message for dependency mismatch
 */
export function createHoverMessage(result: ValidationResult, targetVersion: string): vscode.MarkdownString {
    return new vscode.MarkdownString(
        `**Dependency Version Check**\n\n` +
            `Current: \`${result.currentVersion}\`\n\n` +
            `Expected for React Native ${targetVersion}: \`${result.expectedVersion}\`\n\n` +
            `[Update to Expected Version](command:reactNativePackageChecker.updateToExpected?${encodeURIComponent(JSON.stringify([result.packageName, result.expectedVersion]))})`
    );
}
