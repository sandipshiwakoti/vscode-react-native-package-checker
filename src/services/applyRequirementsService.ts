import * as vscode from 'vscode';

import { ERROR_MESSAGES, EXTERNAL_URLS, REQUIREMENTS_CONFIG, STATUS_SYMBOLS } from '../constants';
import { DiffData, RequirementResult } from '../types';
import { parsePackageJson, removePackageFromJson, updatePackageJsonSection } from '../utils/packageUtils';
import { extractCurrentRnVersion, parseDiff } from '../utils/requirementsUtils';
import { compareVersions, promptForVersionOperation } from '../utils/versionUtils';

import { CacheManagerService } from './cacheManagerService';
import { SuccessModalService } from './successModalService';

export class ApplyRequirementsService {
    private cache = new Map<string, DiffData>();

    constructor(
        private cacheManager: CacheManagerService,
        private context?: vscode.ExtensionContext
    ) {}

    setRequirementsService(requirementsService: any): void {
        this.requirementsService = requirementsService;
    }

    private requirementsService?: any;

    async applyRequirements(): Promise<void> {
        try {
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

            // Check if requirements are already enabled and use the same versions
            let targetVersion: string | undefined;
            let sourceVersion: string | undefined;

            if (this.requirementsService && this.requirementsService.isEnabled()) {
                targetVersion = this.requirementsService.getTargetVersion();
                sourceVersion = this.requirementsService.getOriginalRnVersion();
            }

            if (!targetVersion) {
                const versionOperation = await promptForVersionOperation(currentRnVersion, this.cacheManager);
                if (!versionOperation) {
                    return;
                }
                targetVersion = versionOperation.targetVersion;
                sourceVersion = versionOperation.sourceVersion;
            }

            // Use the source version from the operation or fall back to current version
            let fromVersion = sourceVersion || currentRnVersion;
            let isUsingOriginalVersion = sourceVersion && sourceVersion !== currentRnVersion;

            const versionComparison = compareVersions(targetVersion, fromVersion);

            if (versionComparison < 0) {
                // Only prevent downgrades, allow same version processing
                const errorMessage = `Cannot apply requirements: Target version ${targetVersion} is older than current version ${fromVersion}. Only upgrades are supported. Please choose a newer version.`;
                vscode.window.showErrorMessage(errorMessage);
                return;
            }

            if (currentRnVersion === targetVersion && isUsingOriginalVersion) {
                vscode.window.showInformationMessage(
                    `React Native is already at version ${targetVersion}. Checking for remaining package requirements from ${fromVersion}...`
                );
            }

            // Use baseline version for same-version scenarios to ensure proper diff generation
            let diffData: DiffData;
            if (versionComparison === 0) {
                const baselineVersion = REQUIREMENTS_CONFIG.BASELINE_VERSION;
                diffData = await this.fetchDiff(baselineVersion, targetVersion);
            } else {
                diffData = await this.fetchDiff(fromVersion, targetVersion);
            }
            const currentPackages = this.parsePackageJson(content);
            const requirementResults = this.generateRequirementResults(currentPackages, diffData);

            if (requirementResults.length === 0) {
                await SuccessModalService.showRequirementsFulfilledModal(targetVersion);
                return;
            }

            // Always pass the source version for proper display and link generation
            await this.showRequirementsPreview(requirementResults, targetVersion, fromVersion);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Apply requirements error:', error);
            vscode.window.showErrorMessage(`Failed to apply requirements: ${errorMessage}`);
        }
    }

    private async showRequirementsPreview(
        requirementResults: RequirementResult[],
        targetVersion: string,
        sourceVersion: string
    ): Promise<void> {
        const quickPick = vscode.window.createQuickPick();
        quickPick.title = `Apply Requirements for React Native ${targetVersion} (from ${sourceVersion})`;
        quickPick.placeholder = 'Select packages to update (uncheck to skip)';
        quickPick.canSelectMany = true;
        quickPick.ignoreFocusOut = true;

        // Always include the source version in the upgrade helper link
        const diffUrl = `${EXTERNAL_URLS.UPGRADE_HELPER_BASE}/?from=${sourceVersion}&to=${targetVersion}#RnDiffApp-package.json`;

        quickPick.buttons = [
            {
                iconPath: new vscode.ThemeIcon('link-external'),
                tooltip: `View React Native ${sourceVersion} → ${targetVersion} upgrade guide and package.json reference`,
            },
        ];

        const sortedResults = this.sortResultsForPackageJson(requirementResults);

        const packageItems = sortedResults.map((result) => {
            let description = '';
            let detail = '';

            if (result.changeType === 'addition') {
                description = `Add ${result.requiredVersion}`;
                detail = `${STATUS_SYMBOLS.ADD} Add new package required for React Native ${targetVersion}`;
            } else if (result.changeType === 'removal') {
                description = `Remove ${result.currentVersion}`;
                detail = `${STATUS_SYMBOLS.REMOVE} Remove package no longer needed for React Native ${targetVersion}`;
            } else {
                description = `${result.currentVersion} → ${result.requiredVersion}`;
                detail = `${STATUS_SYMBOLS.UPDATE} Update to React Native ${targetVersion} required version`;
            }

            return {
                label: result.packageName,
                description,
                detail,
                picked: true,
            };
        });

        quickPick.items = packageItems;
        quickPick.selectedItems = packageItems;

        return new Promise((resolve) => {
            quickPick.onDidTriggerButton(async () => {
                await vscode.env.openExternal(vscode.Uri.parse(diffUrl));
            });

            quickPick.onDidAccept(async () => {
                const selectedItems = quickPick.selectedItems;
                quickPick.hide();

                if (selectedItems.length > 0) {
                    await this.applySelectedRequirements([...selectedItems], requirementResults, targetVersion);
                }
                resolve();
            });

            quickPick.onDidHide(() => {
                quickPick.dispose();
                resolve();
            });

            quickPick.show();
        });
    }

    private async applySelectedRequirements(
        selectedItems: vscode.QuickPickItem[],
        requirementResults: RequirementResult[],
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
            let appliedCount = 0;
            const failedApplications: string[] = [];

            for (const item of selectedItems) {
                const packageName = item.label.replace(/^\$\([^)]+\)\s+/, '');
                const requirementResult = requirementResults.find((r) => r.packageName === packageName);
                if (!requirementResult) {
                    continue;
                }

                try {
                    if (requirementResult.changeType === 'addition') {
                        const targetSection = requirementResult.dependencyType || 'dependencies';
                        updatePackageJsonSection(
                            packageJson,
                            targetSection,
                            requirementResult.packageName,
                            requirementResult.requiredVersion
                        );
                        appliedCount++;
                    } else if (requirementResult.changeType === 'removal') {
                        const removed = removePackageFromJson(packageJson, requirementResult.packageName);
                        if (removed) {
                            appliedCount++;
                        } else {
                            failedApplications.push(requirementResult.packageName);
                        }
                    } else {
                        let applied = false;
                        if (packageJson.dependencies && packageJson.dependencies[requirementResult.packageName]) {
                            packageJson.dependencies[requirementResult.packageName] = requirementResult.requiredVersion;
                            applied = true;
                        }
                        if (packageJson.devDependencies && packageJson.devDependencies[requirementResult.packageName]) {
                            packageJson.devDependencies[requirementResult.packageName] =
                                requirementResult.requiredVersion;
                            applied = true;
                        }
                        if (applied) {
                            appliedCount++;
                        } else {
                            failedApplications.push(requirementResult.packageName);
                        }
                    }
                } catch {
                    failedApplications.push(requirementResult.packageName);
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

            if (appliedCount > 0) {
                const updatedContent = JSON.stringify(packageJson, null, 2);
                const edit = new vscode.WorkspaceEdit();
                const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(content.length));
                edit.replace(document.uri, fullRange, updatedContent);

                const success = await vscode.workspace.applyEdit(edit);
                if (success) {
                    // Suppress success modal from requirements service since we'll show our own
                    if (this.requirementsService) {
                        this.requirementsService.setSuppressSuccessModal(true);
                    }

                    await document.save();

                    if (failedApplications.length > 0) {
                        vscode.window.showWarningMessage(
                            `Some requirements could not be applied: ${failedApplications.join(', ')}`
                        );
                    }

                    // Show success modal for applied requirements
                    await SuccessModalService.showRequirementsAppliedModal(appliedCount, targetVersion);
                } else {
                    vscode.window.showErrorMessage('Failed to apply requirements');
                }
            } else {
                vscode.window.showWarningMessage('No requirements were applied');
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

        const url = `${REQUIREMENTS_CONFIG.RN_DIFF_BASE_URL}/${cacheKey}.diff`;

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

    private generateRequirementResults(
        currentPackages: Record<string, string>,
        diffData: DiffData
    ): RequirementResult[] {
        const requirementResults: RequirementResult[] = [];

        for (const change of diffData.packageChanges) {
            if (change.changeType === 'version_change') {
                const currentVersion = currentPackages[change.packageName];
                if (currentVersion && this.hasRequirementMismatch(currentVersion, change.toVersion)) {
                    const cleanCurrentVersion = currentVersion.replace(/^[\^~]/, '');
                    requirementResults.push({
                        packageName: change.packageName,
                        currentVersion: cleanCurrentVersion,
                        requiredVersion: change.toVersion,
                        hasRequirementMismatch: true,
                        changeType: 'version_change',
                        dependencyType: change.dependencyType,
                    });
                }
            } else if (change.changeType === 'addition') {
                const currentVersion = currentPackages[change.packageName];
                if (!currentVersion) {
                    requirementResults.push({
                        packageName: change.packageName,
                        currentVersion: '',
                        requiredVersion: change.toVersion,
                        hasRequirementMismatch: true,
                        changeType: 'addition',
                        dependencyType: change.dependencyType,
                    });
                } else if (this.hasRequirementMismatch(currentVersion, change.toVersion)) {
                    const cleanCurrentVersion = currentVersion.replace(/^[\^~]/, '');
                    requirementResults.push({
                        packageName: change.packageName,
                        currentVersion: cleanCurrentVersion,
                        requiredVersion: change.toVersion,
                        hasRequirementMismatch: true,
                        changeType: 'version_change',
                        dependencyType: change.dependencyType,
                    });
                }
            } else if (change.changeType === 'removal') {
                if (currentPackages[change.packageName]) {
                    const cleanCurrentVersion = currentPackages[change.packageName].replace(/^[\^~]/, '');
                    requirementResults.push({
                        packageName: change.packageName,
                        currentVersion: cleanCurrentVersion,
                        requiredVersion: '',
                        hasRequirementMismatch: true,
                        changeType: 'removal',
                        dependencyType: change.dependencyType,
                    });
                }
            }
        }

        return requirementResults;
    }

    private hasRequirementMismatch(currentVersion: string, requiredVersion: string): boolean {
        const cleanCurrent = currentVersion.replace(/^[\^~]/, '');
        const cleanRequired = requiredVersion.replace(/^[\^~]/, '');
        return cleanCurrent !== cleanRequired;
    }

    private getCurrentRnVersion(): string | null {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document.fileName.endsWith('package.json')) {
            return null;
        }
        const content = activeEditor.document.getText();
        return extractCurrentRnVersion(content);
    }

    private sortResultsForPackageJson(requirementResults: RequirementResult[]): RequirementResult[] {
        const dependencies = requirementResults
            .filter((r) => r.dependencyType === 'dependencies' || !r.dependencyType)
            .sort((a, b) => a.packageName.localeCompare(b.packageName));

        const devDependencies = requirementResults
            .filter((r) => r.dependencyType === 'devDependencies')
            .sort((a, b) => a.packageName.localeCompare(b.packageName));

        return [...dependencies, ...devDependencies];
    }
}
