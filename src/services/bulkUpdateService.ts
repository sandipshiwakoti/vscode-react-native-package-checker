import * as vscode from 'vscode';

import { DEPENDENCY_CHECK_CONFIG, ERROR_MESSAGES } from '../constants';
import { DiffData, ValidationResult } from '../types';
import { extractCurrentRnVersion, parseDiff } from '../utils/dependencyCheckUtils';
import { parsePackageJson, removePackageFromJson, updatePackageJsonSection } from '../utils/packageUtils';
import { promptForTargetVersion } from '../utils/versionUtils';

import { CacheManagerService } from './cacheManagerService';

export class BulkUpdateService {
    private cache = new Map<string, DiffData>();

    constructor(private cacheManager: CacheManagerService) {}

    async performBulkUpdate(): Promise<void> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document.fileName.endsWith('package.json')) {
            vscode.window.showErrorMessage(ERROR_MESSAGES.PACKAGE_JSON_NOT_FOUND);
            return;
        }

        const content = activeEditor.document.getText();
        const currentRnVersion = extractCurrentRnVersion(content);

        if (!currentRnVersion) {
            vscode.window.showWarningMessage('Could not find React Native version in package.json');
            return;
        }

        // Get cached React Native latest version
        const cachedLatestRnVersion = this.cacheManager.getLatestVersion('react-native');

        const targetVersion = await promptForTargetVersion(currentRnVersion, cachedLatestRnVersion || undefined);
        if (!targetVersion) {
            return;
        }

        try {
            const diffData = await this.fetchDiff(currentRnVersion, targetVersion);
            const currentPackages = this.parsePackageJson(content);
            const results = this.generateResults(currentPackages, diffData);

            if (results.length === 0) {
                vscode.window.showInformationMessage(
                    `All dependencies already meet React Native ${targetVersion} requirements!`
                );
                return;
            }

            await this.showBulkUpdatePreview(results, targetVersion);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to analyze dependencies: ${errorMessage}`);
        }
    }

    private async showBulkUpdatePreview(results: ValidationResult[], targetVersion: string): Promise<void> {
        const previewItems = results.map((result) => {
            let description = '';
            let detail = '';

            if (result.changeType === 'addition') {
                description = `Add ${result.expectedVersion}`;
                detail = `Add new package required for React Native ${targetVersion}`;
            } else if (result.changeType === 'removal') {
                description = `Remove ${result.currentVersion}`;
                detail = `Remove package no longer needed for React Native ${targetVersion}`;
            } else {
                description = `${result.currentVersion} → ${result.expectedVersion}`;
                detail = `Update to React Native ${targetVersion} expected version`;
            }

            return {
                label: result.packageName,
                description,
                detail,
                picked: true,
            };
        });

        const selectedItems = await vscode.window.showQuickPick(previewItems, {
            title: `Bulk Update Dependencies for React Native ${targetVersion}`,
            placeHolder: 'Select packages to update (uncheck to skip)',
            canPickMany: true,
            ignoreFocusOut: true,
        });

        if (!selectedItems || selectedItems.length === 0) {
            return;
        }

        await this.applyBulkUpdates(selectedItems, results, targetVersion);
    }

    private async applyBulkUpdates(
        selectedItems: vscode.QuickPickItem[],
        results: ValidationResult[],
        targetVersion: string
    ): Promise<void> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return;
        }

        const document = activeEditor.document;
        const content = document.getText();
        const packageJson = parsePackageJson(content);

        if (!packageJson) {
            vscode.window.showErrorMessage('Failed to parse package.json');
            return;
        }

        try {
            let updatedCount = 0;
            const failedUpdates: string[] = [];

            for (const item of selectedItems) {
                const result = results.find((r) => r.packageName === item.label);
                if (!result) {
                    continue;
                }

                try {
                    if (result.changeType === 'addition') {
                        const targetSection = result.dependencyType || 'dependencies';
                        updatePackageJsonSection(
                            packageJson,
                            targetSection,
                            result.packageName,
                            result.expectedVersion
                        );
                        updatedCount++;
                    } else if (result.changeType === 'removal') {
                        const removed = removePackageFromJson(packageJson, result.packageName);
                        if (removed) {
                            updatedCount++;
                        } else {
                            failedUpdates.push(result.packageName);
                        }
                    } else {
                        let updated = false;
                        if (packageJson.dependencies && packageJson.dependencies[result.packageName]) {
                            packageJson.dependencies[result.packageName] = result.expectedVersion;
                            updated = true;
                        }
                        if (packageJson.devDependencies && packageJson.devDependencies[result.packageName]) {
                            packageJson.devDependencies[result.packageName] = result.expectedVersion;
                            updated = true;
                        }
                        if (updated) {
                            updatedCount++;
                        } else {
                            failedUpdates.push(result.packageName);
                        }
                    }
                } catch {
                    failedUpdates.push(result.packageName);
                }
            }

            if (packageJson.dependencies) {
                const sortedDeps = Object.keys(packageJson.dependencies)
                    .sort()
                    .reduce((result: Record<string, string>, key: string) => {
                        result[key] = packageJson.dependencies[key];
                        return result;
                    }, {});
                packageJson.dependencies = sortedDeps;
            }

            if (packageJson.devDependencies) {
                const sortedDevDeps = Object.keys(packageJson.devDependencies)
                    .sort()
                    .reduce((result: Record<string, string>, key: string) => {
                        result[key] = packageJson.devDependencies[key];
                        return result;
                    }, {});
                packageJson.devDependencies = sortedDevDeps;
            }

            if (updatedCount > 0) {
                const updatedContent = JSON.stringify(packageJson, null, 2);
                const edit = new vscode.WorkspaceEdit();
                const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(content.length));
                edit.replace(document.uri, fullRange, updatedContent);

                const success = await vscode.workspace.applyEdit(edit);
                if (success) {
                    await document.save();

                    const message = `Successfully updated ${updatedCount} package${updatedCount > 1 ? 's' : ''} for React Native ${targetVersion}. All requirements fulfilled!`;
                    vscode.window.showInformationMessage(message);

                    if (failedUpdates.length > 0) {
                        vscode.window.showWarningMessage(
                            `Some packages could not be updated: ${failedUpdates.join(', ')}`
                        );
                    }
                } else {
                    vscode.window.showErrorMessage('Failed to apply bulk updates');
                }
            } else {
                vscode.window.showWarningMessage('No packages were updated');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to parse package.json: ${error}`);
        }
    }

    private async fetchDiff(fromVersion: string, toVersion: string): Promise<DiffData> {
        const cacheKey = `${fromVersion}..${toVersion}`;

        const cached = this.cache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const url = `${DEPENDENCY_CHECK_CONFIG.RN_DIFF_BASE_URL}/${cacheKey}.diff`;

        try {
            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Version ${toVersion} not found in rn-diff-purge`);
                }
                throw new Error(`Failed to fetch diff: HTTP ${response.status}`);
            }

            const rawDiff = await response.text();
            const packageChanges = parseDiff(rawDiff);

            const diffData: DiffData = {
                fromVersion,
                toVersion,
                packageChanges,
                rawDiff,
            };

            this.cache.set(cacheKey, diffData);
            return diffData;
        } catch (error) {
            throw error;
        }
    }

    private parsePackageJson(content: string): Record<string, string> {
        const packageJson = parsePackageJson(content);
        if (!packageJson) {
            return {};
        }

        const dependencies = packageJson.dependencies || {};
        const devDependencies = packageJson.devDependencies || {};
        return { ...dependencies, ...devDependencies };
    }

    private generateResults(currentPackages: Record<string, string>, diffData: DiffData): ValidationResult[] {
        const results: ValidationResult[] = [];

        for (const change of diffData.packageChanges) {
            if (change.changeType === 'version_change') {
                const currentVersion = currentPackages[change.packageName];
                if (currentVersion && this.hasVersionDifference(currentVersion, change.toVersion)) {
                    const cleanCurrentVersion = currentVersion.replace(/^[\^~]/, '');
                    results.push({
                        packageName: change.packageName,
                        currentVersion: cleanCurrentVersion,
                        expectedVersion: change.toVersion,
                        hasVersionMismatch: true,
                        changeType: 'version_change',
                        dependencyType: change.dependencyType,
                    });
                }
            } else if (change.changeType === 'addition') {
                if (!currentPackages[change.packageName]) {
                    results.push({
                        packageName: change.packageName,
                        currentVersion: '',
                        expectedVersion: change.toVersion,
                        hasVersionMismatch: true,
                        changeType: 'addition',
                        dependencyType: change.dependencyType,
                    });
                }
            } else if (change.changeType === 'removal') {
                if (currentPackages[change.packageName]) {
                    const cleanCurrentVersion = currentPackages[change.packageName].replace(/^[\^~]/, '');
                    results.push({
                        packageName: change.packageName,
                        currentVersion: cleanCurrentVersion,
                        expectedVersion: '',
                        hasVersionMismatch: true,
                        changeType: 'removal',
                        dependencyType: change.dependencyType,
                    });
                }
            }
        }

        return results;
    }

    private hasVersionDifference(currentVersion: string, expectedVersion: string): boolean {
        const cleanCurrent = currentVersion.replace(/^[\^~]/, '');
        const cleanExpected = expectedVersion.replace(/^[\^~]/, '');
        return cleanCurrent !== cleanExpected;
    }
}
