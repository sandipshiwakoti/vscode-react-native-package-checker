import * as vscode from 'vscode';

import { ERROR_MESSAGES, STATUS_SYMBOLS } from '../constants';
import { COMMANDS, PackageInfoMap } from '../types';
import { FileExtensions } from '../types';
import { isInDependencySection, parsePackageJson } from '../utils/packageUtils';
import { cleanVersion, escapeRegExp, extractVersionPrefix, hasVersionUpdate } from '../utils/versionUtils';

import { CodeLensProviderService } from './codeLensProviderService';
import { PackageService } from './packageService';

export class VersionUpdateService {
    constructor(
        private codeLensProviderService: CodeLensProviderService,
        private packageService: PackageService
    ) {}

    register(context: vscode.ExtensionContext): void {
        const updateCommand = vscode.commands.registerCommand(
            COMMANDS.UPDATE_PACKAGE_VERSION,
            this.handleUpdatePackageVersion.bind(this)
        );

        const bumpLatestVersionsCommand = vscode.commands.registerCommand(
            COMMANDS.BUMP_LATEST_VERSIONS,
            this.handleBumpLatestVersions.bind(this)
        );

        context.subscriptions.push(updateCommand, bumpLatestVersionsCommand);
    }

    private async handleUpdatePackageVersion(
        packageName: string,
        currentVersion: string,
        latestVersion: string
    ): Promise<void> {
        try {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            if (!activeEditor.document.fileName.endsWith(FileExtensions.PACKAGE_JSON)) {
                vscode.window.showErrorMessage('Active file is not a package.json');
                return;
            }

            if (!this.canUpdateVersion(packageName, currentVersion, latestVersion)) {
                vscode.window.showWarningMessage(
                    `Cannot update ${packageName}: version ${cleanVersion(currentVersion)} is already up to date or newer than ${cleanVersion(latestVersion)}`
                );
                return;
            }

            await this.updatePackageVersion(activeEditor.document, packageName, latestVersion);

            this.packageService.updatePackageVersionInCache(packageName, latestVersion);

            this.codeLensProviderService.refresh();
        } catch (error) {
            console.error('Error updating package version:', error);
            vscode.window.showErrorMessage(
                `Failed to update ${packageName}: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    async updatePackageVersion(document: vscode.TextDocument, packageName: string, newVersion: string): Promise<void> {
        const content = document.getText();
        const packagePattern = `"${packageName}"`;
        const lines = content.split('\n');
        let wasUpdated = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.includes(packagePattern) && line.includes(':')) {
                // Only update if we're in a dependency section (not scripts, etc.)
                if (isInDependencySection(lines, i)) {
                    const versionMatch = line.match(new RegExp(`"${escapeRegExp(packageName)}"\\s*:\\s*"([^"]+)"`));

                    if (versionMatch) {
                        const currentVersionString = versionMatch[1];
                        const versionPrefix = extractVersionPrefix(currentVersionString);
                        const newVersionString = `${versionPrefix}${newVersion}`;

                        const updatedLine = line.replace(
                            new RegExp(`("${escapeRegExp(packageName)}"\\s*:\\s*)"[^"]+"`),
                            `$1"${newVersionString}"`
                        );

                        lines[i] = updatedLine;
                        wasUpdated = true;
                        break;
                    }
                }
            }
        }

        if (wasUpdated) {
            const updatedContent = lines.join('\n');
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(content.length));

            edit.replace(document.uri, fullRange, updatedContent);
            const success = await vscode.workspace.applyEdit(edit);
            if (success) {
                await document.save();
            }
        }
    }

    canUpdateVersion(packageName: string, currentVersion: string, latestVersion: string): boolean {
        if (!packageName || !currentVersion || !latestVersion) {
            return false;
        }

        return hasVersionUpdate(currentVersion, latestVersion);
    }

    async handleBumpLatestVersions(): Promise<void> {
        try {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor || !activeEditor.document.fileName.endsWith('package.json')) {
                vscode.window.showErrorMessage(ERROR_MESSAGES.PACKAGE_JSON_NOT_FOUND);
                return;
            }

            const content = activeEditor.document.getText();
            const packageJson = parsePackageJson(content);

            if (!packageJson) {
                vscode.window.showErrorMessage(ERROR_MESSAGES.PACKAGE_JSON_PARSE_FAILED);
                return;
            }

            const allDependencies = {
                ...packageJson.dependencies,
                ...packageJson.devDependencies,
            };

            if (Object.keys(allDependencies).length === 0) {
                vscode.window.showInformationMessage('No packages found to update.');
                return;
            }

            const packageWithVersions = Object.entries(allDependencies).map(([name, version]) => `${name}@${version}`);

            const packageInfos = await this.packageService.checkPackages(
                packageWithVersions,
                undefined,
                true, // showLatestVersion
                content
            );

            // Filter packages that have updates available
            const updatablePackages = this.getUpdatablePackages(packageInfos);

            if (updatablePackages.length === 0) {
                vscode.window.showInformationMessage('All packages are already up to date!');
                return;
            }

            await this.showPackageSelectionDialog(updatablePackages, activeEditor.document);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Bump latest versions error:', error);
            vscode.window.showErrorMessage(`Failed to bump versions: ${errorMessage}`);
        }
    }

    private getUpdatablePackages(packageInfos: PackageInfoMap): Array<{
        packageName: string;
        currentVersion: string;
        latestVersion: string;
        dependencyType: 'dependencies' | 'devDependencies';
    }> {
        const updatablePackages: Array<{
            packageName: string;
            currentVersion: string;
            latestVersion: string;
            dependencyType: 'dependencies' | 'devDependencies';
        }> = [];

        Object.entries(packageInfos).forEach(([packageName, packageInfo]) => {
            if (packageInfo.currentVersion && packageInfo.latestVersion && packageInfo.hasUpdate) {
                const activeEditor = vscode.window.activeTextEditor;
                if (activeEditor) {
                    const content = activeEditor.document.getText();
                    const packageJson = parsePackageJson(content);

                    let dependencyType: 'dependencies' | 'devDependencies' = 'dependencies';
                    if (packageJson?.devDependencies && packageJson.devDependencies[packageName]) {
                        dependencyType = 'devDependencies';
                    }

                    updatablePackages.push({
                        packageName,
                        currentVersion: packageInfo.currentVersion,
                        latestVersion: packageInfo.latestVersion,
                        dependencyType,
                    });
                }
            }
        });

        // Sort by dependency type first (dependencies before devDependencies), then by package name
        return updatablePackages.sort((a, b) => {
            if (a.dependencyType !== b.dependencyType) {
                return a.dependencyType === 'dependencies' ? -1 : 1;
            }
            return a.packageName.localeCompare(b.packageName);
        });
    }

    private async showPackageSelectionDialog(
        updatablePackages: Array<{
            packageName: string;
            currentVersion: string;
            latestVersion: string;
            dependencyType: 'dependencies' | 'devDependencies';
        }>,
        document: vscode.TextDocument
    ): Promise<void> {
        const quickPick = vscode.window.createQuickPick();
        quickPick.title = `Bump Packages to Latest Versions (${updatablePackages.length} updates available)`;
        quickPick.placeholder = 'Select packages to update to latest versions (check to include)';
        quickPick.canSelectMany = true;
        quickPick.ignoreFocusOut = true;

        const packageItems = updatablePackages.map((pkg) => {
            const cleanCurrentVersion = pkg.currentVersion.replace(/^[\^~]/, '');
            const description = `${cleanCurrentVersion} → ${pkg.latestVersion}`;
            const detail = `${STATUS_SYMBOLS.UPDATE} Update to latest version in ${pkg.dependencyType}`;

            return {
                label: pkg.packageName,
                description,
                detail,
                picked: false,
                packageData: pkg,
            };
        });

        quickPick.items = packageItems;
        quickPick.selectedItems = [];

        return new Promise((resolve) => {
            quickPick.onDidAccept(async () => {
                const selectedItems = quickPick.selectedItems as any[];
                quickPick.hide();

                if (selectedItems.length > 0) {
                    await this.applySelectedUpdates(selectedItems, document);
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

    private async applySelectedUpdates(
        selectedItems: Array<{
            label: string;
            packageData: {
                packageName: string;
                currentVersion: string;
                latestVersion: string;
                dependencyType: 'dependencies' | 'devDependencies';
            };
        }>,
        document: vscode.TextDocument
    ): Promise<void> {
        try {
            const content = document.getText();
            const packageJson = parsePackageJson(content);

            if (!packageJson) {
                vscode.window.showErrorMessage('Failed to parse package.json');
                return;
            }

            let updatedCount = 0;
            const failedUpdates: string[] = [];
            const cacheUpdates: Record<string, string> = {};

            for (const item of selectedItems) {
                const { packageName, currentVersion, latestVersion, dependencyType } = item.packageData;

                try {
                    const versionPrefix = extractVersionPrefix(currentVersion);
                    const newVersionString = `${versionPrefix}${latestVersion}`;

                    if (dependencyType === 'dependencies' && packageJson.dependencies) {
                        packageJson.dependencies[packageName] = newVersionString;
                        cacheUpdates[packageName] = latestVersion;
                        updatedCount++;
                    } else if (dependencyType === 'devDependencies' && packageJson.devDependencies) {
                        packageJson.devDependencies[packageName] = newVersionString;
                        cacheUpdates[packageName] = latestVersion;
                        updatedCount++;
                    } else {
                        failedUpdates.push(packageName);
                    }
                } catch {
                    failedUpdates.push(packageName);
                }
            }

            // Sort dependencies alphabetically
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
                    this.packageService.updateMultiplePackageVersionsInCache(cacheUpdates);

                    this.codeLensProviderService.refresh();

                    if (failedUpdates.length > 0) {
                        vscode.window.showWarningMessage(
                            `Updated ${updatedCount} package${updatedCount > 1 ? 's' : ''} to latest versions. Failed to update: ${failedUpdates.join(', ')}`
                        );
                    } else {
                        vscode.window.showInformationMessage(
                            `Successfully updated ${updatedCount} package${updatedCount > 1 ? 's' : ''} to latest versions!`
                        );
                    }
                } else {
                    vscode.window.showErrorMessage('Failed to apply version updates');
                }
            } else {
                vscode.window.showWarningMessage('No packages were updated');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to update packages: ${error}`);
        }
    }
}
