import * as vscode from 'vscode';

import { EXTENSION_CONFIG, INTERNAL_PACKAGES, STATUS_SYMBOLS } from '../constants';
import { COMMANDS, FileExtensions, STATUS_DESCRIPTIONS, STATUS_LABELS } from '../types';
import { NewArchSupportStatus, PackageInfo, PackageInfoMap, StatusInfo } from '../types';
import { SummaryData, ValidationResult } from '../types';
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
    private isAnalyzing = false;
    private lastSummaryData: SummaryData | null = null;
    private isEnabled = false;
    private isApiCallInProgress = false;

    constructor(
        private packageService: PackageService,
        private dependencyCheckService?: DependencyCheckService
    ) {
        if (this.dependencyCheckService) {
            this.dependencyCheckService.onResultsChanged((results) => {
                console.log(`[CodeLens] Dependency check results changed: ${results.length} mismatches`);
                results.forEach((r) =>
                    console.log(`[CodeLens] - ${r.packageName}: ${r.currentVersion} -> ${r.expectedVersion}`)
                );
                this.dependencyCheckResults = results;

                setTimeout(() => {
                    console.log(`[CodeLens] Triggering refresh after results change`);
                    this.refresh();
                }, 100);
            });
        }
    }

    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        console.log(
            `[CodeLens] provideCodeLenses called - enabled: ${this.isEnabled}, processing: ${this.isProcessingLenses}`
        );

        if (!this.isEnabled || !document.fileName.endsWith(FileExtensions.PACKAGE_JSON)) {
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

            const hasCachedPackageInfo = this.packageService.getCachedResultsByVersions(packageWithVersions);
            const hasAnyCachedData = hadCachedData || Object.keys(hasCachedPackageInfo).length > 0;

            if (this.isApiCallInProgress) {
                return this.createCodeLenses(document, {}, showLatestVersion, packageWithVersions);
            }

            if (!hasAnyCachedData && !this.lastSummaryData) {
                this.isAnalyzing = true;
                this.isApiCallInProgress = true;

                this.packageService
                    .checkPackages(packageWithVersions, undefined, showLatestVersion, document.getText())
                    .then((packageInfos) => {
                        console.log('[CodeLens] Background API call completed');
                        this.lastSummaryData = this.calculateSummaryData(packageInfos, document.getText());
                        this.isAnalyzing = false;
                        this.isApiCallInProgress = false;
                        if (Object.keys(packageInfos).length > 0) {
                            this.refresh();
                        }
                    })
                    .catch((error) => {
                        console.error('Error in background package analysis:', error);
                        this.isAnalyzing = false;
                        this.isApiCallInProgress = false;
                    });

                return this.createCodeLenses(document, {}, showLatestVersion, packageWithVersions);
            }

            let packageInfos: PackageInfoMap = {};

            if (hadCachedData && !this.isApiCallInProgress) {
                console.log('[CodeLens] Making API call with cached data in background');
                this.isApiCallInProgress = true;

                this.packageService
                    .checkPackages(packageWithVersions, undefined, showLatestVersion, document.getText())
                    .then((fetchedPackageInfos) => {
                        console.log('[CodeLens] Background cached data API call completed');
                        this.lastSummaryData = this.calculateSummaryData(fetchedPackageInfos, document.getText());
                        this.isApiCallInProgress = false;
                    })
                    .catch((error) => {
                        console.error('Error in background cached data API call:', error);
                        this.isApiCallInProgress = false;
                    });

                packageInfos = this.packageService.getCachedResultsByVersions(packageWithVersions);

                if (!this.lastSummaryData && Object.keys(packageInfos).length > 0) {
                    this.lastSummaryData = this.calculateSummaryData(packageInfos, document.getText());
                }
            } else if (this.lastSummaryData) {
                console.log('[CodeLens] Using existing summary data and cached results');
                packageInfos = this.packageService.getCachedResultsByVersions(packageWithVersions);
            } else if (hasAnyCachedData) {
                console.log('[CodeLens] Using cached package info without background API call');
                packageInfos = this.packageService.getCachedResultsByVersions(packageWithVersions);

                if (Object.keys(packageInfos).length > 0) {
                    this.lastSummaryData = this.calculateSummaryData(packageInfos, document.getText());
                }
            }

            this.isAnalyzing = false;

            const codeLenses = this.createCodeLenses(document, packageInfos, showLatestVersion, packageWithVersions);

            return codeLenses;
        } catch (error) {
            console.error('Error providing code lenses:', error);
            this.isAnalyzing = false;

            try {
                const cachedResults = this.packageService.getCachedResultsByVersions(packageWithVersions);

                if (Object.keys(cachedResults).length > 0) {
                    vscode.window.showWarningMessage('Failed to fetch package data. Using cached data instead.');
                    this.lastSummaryData = this.calculateSummaryData(cachedResults, document.getText());
                    return this.createCodeLenses(document, cachedResults, showLatestVersion, packageWithVersions);
                } else {
                    vscode.window.showErrorMessage(
                        'Failed to fetch package data and no cache available. CodeLens has been disabled.'
                    );
                    this.isEnabled = false;
                    vscode.commands.executeCommand('setContext', EXTENSION_CONFIG.CODE_LENS_CONTEXT_KEY, false);
                    return [];
                }
            } catch (cacheError) {
                console.error('Error getting cached results:', cacheError);
                vscode.window.showErrorMessage(
                    'Failed to fetch package data and retrieve cache. CodeLens has been disabled.'
                );
                vscode.commands.executeCommand('setContext', EXTENSION_CONFIG.CODE_LENS_CONTEXT_KEY, false);
                return [];
            }
        } finally {
            this.isProcessingLenses = false;
        }
    }

    private createCodeLenses(
        document: vscode.TextDocument,
        packageInfos: PackageInfoMap,
        showLatestVersion: boolean,
        packageWithVersions: string[]
    ): vscode.CodeLens[] {
        const codeLenses: vscode.CodeLens[] = [];
        const lines = document.getText().split(EXTENSION_CONFIG.LINE_SEPARATOR);
        const documentContent = document.getText();

        const dependencyCheckResults = this.getDependencyCheckResults();

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.includes('"dependencies"') || line.includes('"devDependencies"')) {
                const range = new vscode.Range(i, 0, i, line.length);

                if (line.includes('"dependencies"') && !line.includes('"devDependencies"')) {
                    const totalPackagesCodeLens = this.createTotalPackagesCodeLens(
                        new vscode.Range(i, 0, i, 0),
                        packageWithVersions,
                        documentContent
                    );
                    codeLenses.push(totalPackagesCodeLens);

                    const summaryCodeLens = this.createSummaryCodeLens(new vscode.Range(i, 0, i, 0), packageInfos);
                    if (summaryCodeLens) {
                        codeLenses.push(summaryCodeLens);
                    }
                }

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

    private createTotalPackagesCodeLens(
        range: vscode.Range,
        packageWithVersions: string[],
        documentContent?: string
    ): vscode.CodeLens {
        const productionPackages = documentContent
            ? packageWithVersions.filter((pkg) => {
                  const packageName = extractPackageNameFromVersionString(pkg);
                  return !isDevDependency(documentContent, packageName);
              })
            : packageWithVersions;

        const totalPackages = productionPackages.length;

        if (this.isAnalyzing || (!this.lastSummaryData && totalPackages > 0)) {
            return new vscode.CodeLens(range, {
                title: `$(sync)\u2009Analysing packages...`,
                tooltip: 'Package analysis in progress',
                command: '',
            });
        }

        return new vscode.CodeLens(range, {
            title: `$(refresh)\u2009${totalPackages} packages`,
            tooltip: 'Click to refresh package data',
            command: COMMANDS.REFRESH_PACKAGES,
        });
    }

    private createSummaryCodeLens(range: vscode.Range, packageInfos: PackageInfoMap): vscode.CodeLens | null {
        if (this.isAnalyzing || (!this.lastSummaryData && Object.keys(packageInfos).length === 0)) {
            return null;
        }

        if (!this.lastSummaryData) {
            return null;
        }

        const { statusCounts } = this.lastSummaryData;
        const segments: string[] = [];

        if (statusCounts.supported > 0) {
            segments.push(`${STATUS_SYMBOLS.SUPPORTED}\u2009${statusCounts.supported} New Arch Supported`);
        }
        if (statusCounts.unsupported > 0) {
            segments.push(`\u2009${STATUS_SYMBOLS.UNSUPPORTED}\u2009${statusCounts.unsupported} New Arch Unsupported`);
        }
        if (statusCounts.untested > 0) {
            segments.push(`\u2009${STATUS_SYMBOLS.UNTESTED}\u2009${statusCounts.untested} New Arch Untested`);
        }
        if (statusCounts.unlisted > 0) {
            segments.push(`\u2009${STATUS_SYMBOLS.UNLISTED}\u2009${statusCounts.unlisted} Unlisted`);
        }
        if (statusCounts.unmaintained > 0) {
            segments.push(`\u2009${STATUS_SYMBOLS.UNMAINTAINED}\u2009${statusCounts.unmaintained} Unmaintained`);
        }

        if (segments.length === 0) {
            return null;
        }

        const title = segments.join(' | ');
        const totalPackages = Object.keys(packageInfos).length;
        const tooltip = this.createSummaryTooltip(statusCounts, totalPackages);

        return new vscode.CodeLens(range, {
            title,
            tooltip,
            command: COMMANDS.OPEN_PACKAGE_CHECKER_WEBSITE,
        });
    }

    private calculateSummaryData(packageInfos: PackageInfoMap, documentContent?: string): SummaryData {
        const statusCounts = {
            supported: 0,
            unsupported: 0,
            untested: 0,
            unlisted: 0,
            unmaintained: 0,
        };

        for (const [packageName, packageInfo] of Object.entries(packageInfos)) {
            if (!packageInfo) {
                continue;
            }

            const isDevDep = documentContent ? isDevDependency(documentContent, packageName) : false;

            switch (packageInfo.newArchitecture) {
                case NewArchSupportStatus.Supported:
                    statusCounts.supported++;
                    break;
                case NewArchSupportStatus.Unsupported:
                    statusCounts.unsupported++;
                    break;
                case NewArchSupportStatus.Untested:
                    statusCounts.untested++;
                    break;
                case NewArchSupportStatus.Unlisted:
                default:
                    if (!isDevDep) {
                        statusCounts.unlisted++;
                    }
                    break;
            }

            if (packageInfo.unmaintained) {
                statusCounts.unmaintained++;
            }
        }

        return {
            isLoading: this.isAnalyzing,
            statusCounts,
        };
    }

    private createSummaryTooltip(statusCounts: SummaryData['statusCounts'], totalPackages?: number): string {
        const parts = ['Package Analysis Summary:', ''];

        if (totalPackages !== undefined) {
            parts.push(`📦 Total: ${totalPackages} packages analyzed`, '');
        }

        if (statusCounts.supported > 0) {
            parts.push(`✅ ${statusCounts.supported} packages support New Architecture`);
        }
        if (statusCounts.unsupported > 0) {
            parts.push(`❌ ${statusCounts.unsupported} packages do not support New Architecture`);
        }
        if (statusCounts.untested > 0) {
            parts.push(`⚠️ ${statusCounts.untested} packages are untested with New Architecture`);
        }
        if (statusCounts.unlisted > 0) {
            parts.push(`❓ ${statusCounts.unlisted} packages are not listed in the directory`);
        }
        if (statusCounts.unmaintained > 0) {
            parts.push(`📦 ${statusCounts.unmaintained} packages appear unmaintained`);
        }

        parts.push('', 'Click to open React Native Package Checker website');

        return parts.join('\n');
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
                codeLenses.push(
                    new vscode.CodeLens(range, {
                        title: `✅\u2009Meets RN ${targetVersion} version`,
                        tooltip: `All dependencies match expected versions for React Native ${targetVersion}`,
                        command: '',
                        arguments: [],
                    })
                );
            }

            codeLenses.push(
                new vscode.CodeLens(range, {
                    title: `$(refresh)\u2009Reset deps version`,
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
        console.log(
            `[CodeLens] Refresh called - processing: ${this.isProcessingLenses}, timeout exists: ${!!this.refreshTimeout}`
        );
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }

        this.refreshTimeout = setTimeout(() => {
            console.log(`[CodeLens] Executing refresh - firing onDidChangeCodeLenses`);
            this.isProcessingLenses = false;
            this._onDidChangeCodeLenses.fire();
            this.refreshTimeout = null;
        }, 10);
    }

    async refreshPackages(): Promise<void> {
        try {
            this.packageService.clearCache();
            this.isAnalyzing = false;
            this.lastSummaryData = null;
            this.isApiCallInProgress = false;
            this.refresh();
            vscode.window.showInformationMessage('Package data refreshed successfully');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to refresh package data: ${errorMessage}`);
        }
    }

    async enable(): Promise<void> {
        console.log('[CodeLens] Enable called');
        this.isEnabled = true;
        await vscode.commands.executeCommand('setContext', EXTENSION_CONFIG.CODE_LENS_CONTEXT_KEY, true);

        vscode.window.showInformationMessage('React Native Package Checker enabled');

        this._onDidChangeCodeLenses.fire();
    }

    async disable(): Promise<void> {
        this.isEnabled = false;
        await vscode.commands.executeCommand('setContext', EXTENSION_CONFIG.CODE_LENS_CONTEXT_KEY, false);
        this.refresh();
        vscode.window.showInformationMessage('React Native Package Checker disabled');
    }

    initialize(): void {
        this.isEnabled = false;

        this.lastSummaryData = null;
        this.isAnalyzing = false;
        this.isApiCallInProgress = false;

        vscode.commands.executeCommand('setContext', EXTENSION_CONFIG.CODE_LENS_CONTEXT_KEY, false);
    }

    dispose() {
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }
    }
}
