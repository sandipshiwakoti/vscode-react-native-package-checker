import * as vscode from 'vscode';

import { EXTENSION_CONFIG, INTERNAL_PACKAGES, STATUS_SYMBOLS } from '../constants';
import { COMMANDS, FileExtensions, STATUS_DESCRIPTIONS, STATUS_LABELS } from '../types';
import { NewArchSupportStatus, PackageInfo, PackageInfoMap, StatusInfo } from '../types';
import { ValidationResult } from '../types';
import { extractPackageNames, isDevDependency } from '../utils/packageUtils';
import { extractPackageNameFromVersionString, extractVersionFromLine, hasVersionUpdate } from '../utils/versionUtils';

import { DependencyCheckService } from './dependencyCheckService';
import { PackageService } from './packageService';

export class CodeLensProviderService implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;
    private isProcessingLenses = false;
    private refreshTimeout: NodeJS.Timeout | null = null;
    private dependencyCheckResults: ValidationResult[] = [];

    constructor(
        private packageService: PackageService,
        private context: vscode.ExtensionContext,
        private dependencyCheckService?: DependencyCheckService
    ) {
        // Subscribe to dependency check results if service is provided
        if (this.dependencyCheckService) {
            this.dependencyCheckService.onResultsChanged((results) => {
                console.log(`[CodeLens] Dependency check results changed: ${results.length} mismatches`);
                results.forEach((r) =>
                    console.log(`[CodeLens] - ${r.packageName}: ${r.currentVersion} -> ${r.expectedVersion}`)
                );
                this.dependencyCheckResults = results;

                // Force a refresh with a slight delay to ensure the UI updates properly
                setTimeout(() => {
                    console.log(`[CodeLens] Triggering refresh after results change`);
                    this.refresh();
                }, 100);
            });
        }
    }

    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        const isEnabled = this.context.globalState.get(
            EXTENSION_CONFIG.CODE_LENS_STATE_KEY,
            EXTENSION_CONFIG.DEFAULT_CODE_LENS_ENABLED
        );

        if (!isEnabled || !document.fileName.endsWith(FileExtensions.PACKAGE_JSON)) {
            return [];
        }

        const showLatestVersion = vscode.workspace
            .getConfiguration(EXTENSION_CONFIG.CONFIGURATION_SECTION)
            .get(EXTENSION_CONFIG.SHOW_LATEST_VERSION_KEY, EXTENSION_CONFIG.DEFAULT_SHOW_LATEST_VERSION);

        const packageWithVersions = extractPackageNames(document.getText());
        if (packageWithVersions.length === 0) {
            return [];
        }

        if (this.isProcessingLenses) {
            return [];
        }

        this.isProcessingLenses = true;

        try {
            const hadCachedData = packageWithVersions.some((pkg) => {
                const packageName = extractPackageNameFromVersionString(pkg);
                return this.packageService.getCachedVersion(packageName) !== null;
            });

            const packageInfos = await this.packageService.checkPackages(
                packageWithVersions,
                undefined,
                showLatestVersion,
                document.getText()
            );

            const hasNewData = packageWithVersions.some((pkg) => {
                const packageName = extractPackageNameFromVersionString(pkg);
                return (
                    packageInfos[packageName]?.latestVersion &&
                    this.packageService.getCachedVersion(packageName) !== null
                );
            });

            const codeLenses = this.createCodeLenses(document, packageInfos, showLatestVersion);

            if (!hadCachedData && hasNewData && codeLenses.length > 0) {
                console.log('Scheduling refresh after initial data fetch');
                setTimeout(() => {
                    this.refresh();
                }, 100);
            }

            return codeLenses;
        } catch (error) {
            console.error('Error providing code lenses:', error);

            try {
                const cachedResults = this.packageService.getCachedResultsByVersions(packageWithVersions);

                if (Object.keys(cachedResults).length > 0) {
                    vscode.window.showWarningMessage('Failed to fetch package data. Using cached data instead.');
                    return this.createCodeLenses(document, cachedResults, showLatestVersion);
                } else {
                    vscode.window.showErrorMessage(
                        'Failed to fetch package data and no cache available. CodeLens has been disabled.'
                    );
                    await this.context.globalState.update(EXTENSION_CONFIG.CODE_LENS_STATE_KEY, false);
                    await vscode.commands.executeCommand('setContext', EXTENSION_CONFIG.CODE_LENS_CONTEXT_KEY, false);
                    return [];
                }
            } catch (cacheError) {
                console.error('Error getting cached results:', cacheError);
                vscode.window.showErrorMessage(
                    'Failed to fetch package data and retrieve cache. CodeLens has been disabled.'
                );
                await this.context.globalState.update(EXTENSION_CONFIG.CODE_LENS_STATE_KEY, false);
                await vscode.commands.executeCommand('setContext', EXTENSION_CONFIG.CODE_LENS_CONTEXT_KEY, false);
                return [];
            }
        } finally {
            this.isProcessingLenses = false;
        }
    }

    private createCodeLenses(
        document: vscode.TextDocument,
        packageInfos: PackageInfoMap,
        showLatestVersion: boolean
    ): vscode.CodeLens[] {
        const codeLenses: vscode.CodeLens[] = [];
        const lines = document.getText().split(EXTENSION_CONFIG.LINE_SEPARATOR);
        const documentContent = document.getText();

        // Get dependency check results if available
        const dependencyCheckResults = this.getDependencyCheckResults();

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Check for dependencies section headers
            if (line.includes('"dependencies"') || line.includes('"devDependencies"')) {
                const range = new vscode.Range(i, 0, i, line.length);
                const dependencyHeaderCodeLenses = this.createDependencyHeaderCodeLenses(range, dependencyCheckResults);
                codeLenses.push(...dependencyHeaderCodeLenses);
            }

            const packageMatch = line.match(EXTENSION_CONFIG.PACKAGE_LINE_REGEX);

            if (packageMatch) {
                const packageName = packageMatch[1];
                const packageInfo = packageInfos[packageName];
                const range = new vscode.Range(i, 0, i, line.length);

                if (packageInfo) {
                    const isDevDep = isDevDependency(documentContent, packageName);

                    if (!isDevDep) {
                        const newArchCodeLens = this.createNewArchCodeLens(range, packageName, packageInfo);
                        codeLenses.push(newArchCodeLens);

                        if (packageInfo.unmaintained) {
                            const unmaintainedCodeLens = this.createUnmaintainedCodeLens(range);
                            codeLenses.push(unmaintainedCodeLens);
                        }

                        if (
                            packageName === 'react-native' &&
                            packageInfo.currentVersion &&
                            packageInfo.currentVersion !== packageInfo.latestVersion
                        ) {
                            const fromRnVersion = packageInfo.currentVersion;
                            const toRnVersion = packageInfo.latestVersion;
                            const upgradeHelperCodeLens = this.createUpgradeHelperCodeLens(
                                range,
                                fromRnVersion,
                                toRnVersion
                            );
                            codeLenses.push(upgradeHelperCodeLens);
                        }
                    }

                    if (showLatestVersion && packageInfo.latestVersion && !packageInfo.versionFetchError) {
                        const versionCodeLens = this.createVersionCodeLens(range, packageName, packageInfo);
                        codeLenses.push(versionCodeLens);
                    }
                } else if (showLatestVersion) {
                    const cachedVersion = this.packageService.getCachedVersion(packageName);
                    if (cachedVersion) {
                        const currentVersion = extractVersionFromLine(line);
                        const mockPackageInfo: PackageInfo = {
                            npmUrl: '',
                            latestVersion: cachedVersion,
                            currentVersion: currentVersion,
                            hasUpdate: hasVersionUpdate(currentVersion, cachedVersion),
                            newArchitecture: NewArchSupportStatus.Unlisted,
                        };
                        const versionCodeLens = this.createVersionCodeLens(range, packageName, mockPackageInfo);
                        codeLenses.push(versionCodeLens);
                    }
                }

                // Add dependency check CodeLens at the end (after other CodeLenses)
                const dependencyResult = dependencyCheckResults?.find((r) => r.packageName === packageName);
                console.log(`[CodeLens] Checking dependency result for ${packageName}:`, dependencyResult);
                if (dependencyResult && dependencyResult.hasVersionMismatch) {
                    console.log(
                        `[CodeLens] Adding dependency CodeLens for ${packageName}: ${dependencyResult.currentVersion} -> ${dependencyResult.expectedVersion}`
                    );
                    const dependencyCodeLens = this.createDependencyCheckCodeLens(range, dependencyResult);
                    codeLenses.push(dependencyCodeLens);
                } else if (dependencyResult) {
                    console.log(
                        `[CodeLens] Dependency result found for ${packageName} but no mismatch (${dependencyResult.hasVersionMismatch})`
                    );
                } else {
                    console.log(`[CodeLens] No dependency result found for ${packageName}`);
                }
            }
        }

        return codeLenses;
    }

    private createNewArchCodeLens(range: vscode.Range, packageName: string, packageInfo: PackageInfo): vscode.CodeLens {
        const symbol = this.getStatusSymbol(packageInfo.newArchitecture);
        const status = this.getArchitectureStatus(packageInfo.newArchitecture);

        const displayText = `${symbol}\u2009${status.text}`;

        return new vscode.CodeLens(range, {
            title: displayText,
            tooltip: this.getNewArchTooltip(packageInfo, packageName),
            command: COMMANDS.SHOW_PACKAGE_DETAILS,
            arguments: [packageName, packageInfo],
        });
    }

    private createUnmaintainedCodeLens(range: vscode.Range): vscode.CodeLens {
        return new vscode.CodeLens(range, {
            title: `${STATUS_SYMBOLS.UNMAINTAINED}\u2009Unmaintained`,
            tooltip: 'This package appears to be unmaintained',
            command: '',
        });
    }

    private createVersionCodeLens(range: vscode.Range, packageName: string, packageInfo: PackageInfo): vscode.CodeLens {
        const hasUpdate = packageInfo.hasUpdate;
        const latestVersion = packageInfo.latestVersion!;

        const symbol = hasUpdate ? STATUS_SYMBOLS.UPDATE : STATUS_SYMBOLS.LATEST;
        const text = hasUpdate ? `Latest ${latestVersion}` : `Latest ${latestVersion}`;

        const displayText = `${symbol}\u2009${text}`;

        return new vscode.CodeLens(range, {
            title: displayText,
            tooltip: this.getVersionTooltip(packageInfo),
            command: hasUpdate ? COMMANDS.UPDATE_PACKAGE_VERSION : '',
            arguments: hasUpdate ? [packageName, packageInfo.currentVersion, latestVersion] : [],
        });
    }

    private createUpgradeHelperCodeLens(
        range: vscode.Range,
        fromRnVersion: string,
        toRnVersion?: string
    ): vscode.CodeLens {
        return new vscode.CodeLens(range, {
            title: `${STATUS_SYMBOLS.UPGRADE_HELPER}\u2009Upgrade Helper`,
            tooltip: `Visit Upgrade Helper for migration from React Native ${fromRnVersion} to ${toRnVersion || 'latest'}`,
            command: COMMANDS.OPEN_UPGRADE_HELPER,
            arguments: [fromRnVersion, toRnVersion],
        });
    }

    private createDependencyCheckCodeLens(range: vscode.Range, result: ValidationResult): vscode.CodeLens {
        return new vscode.CodeLens(range, {
            title: `$(edit-sparkle)\u2009Expected ${result.expectedVersion}`,
            tooltip: `Current: ${result.currentVersion}, Expected: ${result.expectedVersion}. Click to update.`,
            command: 'reactNativePackageChecker.updateToExpected',
            arguments: [result.packageName, result.expectedVersion],
        });
    }

    private createDependencyHeaderCodeLenses(
        range: vscode.Range,
        dependencyCheckResults: ValidationResult[] | null
    ): vscode.CodeLens[] {
        const codeLenses: vscode.CodeLens[] = [];

        if (!this.dependencyCheckService) {
            return codeLenses;
        }

        if (!this.dependencyCheckService.isEnabled()) {
            // Show "Check deps versions" CodeLens
            codeLenses.push(
                new vscode.CodeLens(range, {
                    title: `$(checklist)\u2009Check deps versions`,
                    tooltip: 'Check if dependencies match expected versions for a React Native version',
                    command: 'reactNativePackageChecker.enableDependencyCheck',
                    arguments: [],
                })
            );
        } else {
            const targetVersion = this.dependencyCheckService.getTargetVersion();
            const hasAnyMismatches = dependencyCheckResults && dependencyCheckResults.some((r) => r.hasVersionMismatch);

            if (!hasAnyMismatches && dependencyCheckResults && dependencyCheckResults.length > 0) {
                // All dependencies meet the target version
                codeLenses.push(
                    new vscode.CodeLens(range, {
                        title: `✅\u2009Meets RN ${targetVersion} version`,
                        tooltip: `All dependencies match expected versions for React Native ${targetVersion}`,
                        command: '',
                        arguments: [],
                    })
                );
            }

            // Always show reset option when enabled
            codeLenses.push(
                new vscode.CodeLens(range, {
                    title: `🔄\u2009Reset deps version`,
                    tooltip: 'Disable dependency checking or check for a different React Native version',
                    command: 'reactNativePackageChecker.disableDependencyCheck',
                    arguments: [],
                })
            );
        }

        return codeLenses;
    }

    private getDependencyCheckResults(): ValidationResult[] | null {
        if (!this.dependencyCheckService || !this.dependencyCheckService.isEnabled()) {
            console.log(`[CodeLens] Dependency check not enabled or service not available`);
            return null;
        }

        console.log(`[CodeLens] Getting dependency check results: ${this.dependencyCheckResults.length} items`);
        this.dependencyCheckResults.forEach((r) => {
            console.log(
                `[CodeLens] - Result: ${r.packageName} (${r.currentVersion} -> ${r.expectedVersion}, mismatch: ${r.hasVersionMismatch})`
            );
        });
        return this.dependencyCheckResults;
    }

    private getStatusSymbol(status?: NewArchSupportStatus): string {
        switch (status) {
            case NewArchSupportStatus.Supported:
                return STATUS_SYMBOLS.SUPPORTED;
            case NewArchSupportStatus.Unsupported:
                return STATUS_SYMBOLS.UNSUPPORTED;
            case NewArchSupportStatus.Untested:
                return STATUS_SYMBOLS.UNTESTED;
            case NewArchSupportStatus.Unlisted:
            default:
                return STATUS_SYMBOLS.UNLISTED;
        }
    }

    private getNewArchTooltip(packageInfo: PackageInfo, packageName: string): string {
        const status = this.getArchitectureStatus(packageInfo.newArchitecture);

        if (packageInfo.newArchitecture === NewArchSupportStatus.Unlisted && INTERNAL_PACKAGES.includes(packageName)) {
            return 'Core dependency required by React Native. Not listed in the directory but fully compatible with the New Architecture.';
        }

        return this.getTooltip(packageInfo, status);
    }

    private getArchitectureStatus(status?: NewArchSupportStatus): StatusInfo {
        switch (status) {
            case NewArchSupportStatus.Supported:
                return { text: STATUS_LABELS.SUPPORTED, description: STATUS_DESCRIPTIONS.SUPPORTED };
            case NewArchSupportStatus.Unsupported:
                return { text: STATUS_LABELS.UNSUPPORTED, description: STATUS_DESCRIPTIONS.UNSUPPORTED };
            case NewArchSupportStatus.Untested:
                return { text: STATUS_LABELS.UNTESTED, description: STATUS_DESCRIPTIONS.UNTESTED };
            case NewArchSupportStatus.Unlisted:
            default:
                return { text: STATUS_LABELS.UNLISTED, description: STATUS_DESCRIPTIONS.UNLISTED };
        }
    }

    private getTooltip(packageInfo: PackageInfo, status: StatusInfo): string {
        const parts = [status.description];

        if (packageInfo.newArchitectureNote) {
            parts.push(packageInfo.newArchitectureNote);
        }

        parts.push('Click for more details');
        return parts.join(EXTENSION_CONFIG.TOOLTIP_SEPARATOR);
    }

    private getVersionTooltip(packageInfo: PackageInfo): string {
        const parts = [];

        if (packageInfo.hasUpdate) {
            parts.push(`Update available: ${packageInfo.currentVersion} → ${packageInfo.latestVersion}`);
            parts.push('Click to update package version');
        } else {
            parts.push(`Already latest version (${packageInfo.latestVersion})`);
        }

        return parts.join(EXTENSION_CONFIG.TOOLTIP_SEPARATOR);
    }

    refresh(): void {
        console.log(`[CodeLens] Refresh called`);
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }

        this.refreshTimeout = setTimeout(() => {
            console.log(`[CodeLens] Executing refresh - firing onDidChangeCodeLenses`);
            this.isProcessingLenses = false;
            this._onDidChangeCodeLenses.fire();
            this.refreshTimeout = null;
        }, 50);
    }

    async refreshPackages(): Promise<void> {
        try {
            this.packageService.clearCache();
            this.refresh();
            vscode.window.showInformationMessage('Package data refreshed successfully');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to refresh package data: ${errorMessage}`);
        }
    }

    async enable(): Promise<void> {
        await this.updateState(true);
        vscode.window.showInformationMessage('React Native Package Checker enabled');
    }

    async disable(): Promise<void> {
        await this.updateState(false);
        vscode.window.showInformationMessage('React Native Package Checker disabled');
    }

    initialize(): void {
        const isEnabled = this.context.globalState.get(
            EXTENSION_CONFIG.CODE_LENS_STATE_KEY,
            EXTENSION_CONFIG.DEFAULT_CODE_LENS_ENABLED
        );
        vscode.commands.executeCommand('setContext', EXTENSION_CONFIG.CODE_LENS_CONTEXT_KEY, isEnabled);
    }

    private async updateState(enabled: boolean): Promise<void> {
        await this.context.globalState.update(EXTENSION_CONFIG.CODE_LENS_STATE_KEY, enabled);
        await vscode.commands.executeCommand('setContext', EXTENSION_CONFIG.CODE_LENS_CONTEXT_KEY, enabled);
        this.refresh();
    }

    dispose() {
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }
    }
}
