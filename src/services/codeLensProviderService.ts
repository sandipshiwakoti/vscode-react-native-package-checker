import * as vscode from 'vscode';

import { EXTENSION_CONFIG, INTERNAL_PACKAGES, STATUS_SYMBOLS } from '../constants';
import { COMMANDS, FileExtensions, STATUS_DESCRIPTIONS, STATUS_LABELS } from '../types';
import { NewArchSupportStatus, PackageInfo, PackageInfoMap, StatusInfo } from '../types';
import { CodeLensSegment, RequirementResult, SummaryData } from '../types';
import { extractPackageNames, isDevDependency, isInUnwantedSection } from '../utils/packageUtils';
import {
    cleanVersion,
    extractPackageNameFromVersionString,
    extractVersionFromLine,
    hasVersionUpdate,
} from '../utils/versionUtils';

import { PackageDecorationService } from './packageDecorationService';
import { PackageService } from './packageService';
import { RequirementsService } from './requirementsService';

export class CodeLensProviderService implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;
    private isProcessingLenses = false;
    private refreshTimeout: NodeJS.Timeout | null = null;
    private requirementsResults: RequirementResult[] = [];
    private isAnalyzing = false;
    private lastSummaryData: SummaryData | null = null;
    private isEnabled = false;
    private isApiCallInProgress = false;

    constructor(
        private packageService: PackageService,
        private RequirementsService?: RequirementsService,
        private packageDecorationService?: PackageDecorationService
    ) {
        if (this.RequirementsService) {
            this.RequirementsService.onResultsChanged((results) => {
                console.log(`[CodeLens] Requirements results changed: ${results.length} mismatches`);
                results.forEach((r) =>
                    console.log(`[CodeLens] - ${r.packageName}: ${r.currentVersion} -> ${r.requiredVersion}`)
                );
                this.requirementsResults = results;

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
                return this.createCodeLenses(document, {}, showLatestVersion);
            }

            if (!hasAnyCachedData && !this.lastSummaryData) {
                this.isAnalyzing = true;
                this.isApiCallInProgress = true;

                if (this.packageDecorationService) {
                    this.packageDecorationService.clearDecorations();
                }

                this.packageService
                    .checkPackages(packageWithVersions, undefined, showLatestVersion, document.getText())
                    .then(async (packageInfos) => {
                        console.log('[CodeLens] Background API call completed');
                        this.lastSummaryData = this.calculateSummaryData(packageInfos, document.getText());
                        this.isAnalyzing = false;
                        this.isApiCallInProgress = false;

                        // Update analyzing context
                        await vscode.commands.executeCommand(
                            'setContext',
                            'reactNativePackageChecker.analyzing',
                            false
                        );

                        if (Object.keys(packageInfos).length > 0) {
                            this.refresh();
                        }
                    })
                    .catch(async (error) => {
                        console.error('Error in background package analysis:', error);
                        this.isAnalyzing = false;
                        this.isApiCallInProgress = false;

                        // Update analyzing context
                        await vscode.commands.executeCommand(
                            'setContext',
                            'reactNativePackageChecker.analyzing',
                            false
                        );
                    });

                return this.createCodeLenses(document, {}, showLatestVersion);
            }

            let packageInfos: PackageInfoMap = {};

            if (hadCachedData && !this.isApiCallInProgress) {
                console.log('[CodeLens] Making API call with cached data in background');
                this.isApiCallInProgress = true;

                this.packageService
                    .checkPackages(packageWithVersions, undefined, showLatestVersion, document.getText())
                    .then(async (fetchedPackageInfos) => {
                        console.log('[CodeLens] Background cached data API call completed');
                        this.lastSummaryData = this.calculateSummaryData(fetchedPackageInfos, document.getText());
                        this.isApiCallInProgress = false;

                        // Update analyzing context if not analyzing anymore
                        if (!this.isAnalyzing) {
                            await vscode.commands.executeCommand(
                                'setContext',
                                'reactNativePackageChecker.analyzing',
                                false
                            );
                        }
                    })
                    .catch(async (error) => {
                        console.error('Error in background cached data API call:', error);
                        this.isApiCallInProgress = false;

                        // Update analyzing context if not analyzing anymore
                        if (!this.isAnalyzing) {
                            await vscode.commands.executeCommand(
                                'setContext',
                                'reactNativePackageChecker.analyzing',
                                false
                            );
                        }
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

            // Update analyzing context when analysis is complete
            vscode.commands.executeCommand('setContext', 'reactNativePackageChecker.analyzing', false);

            const codeLenses = this.createCodeLenses(document, packageInfos, showLatestVersion);

            if (this.packageDecorationService && Object.keys(packageInfos).length > 0) {
                this.packageDecorationService.updateDecorations(packageInfos, this.isAnalyzing);
            }

            return codeLenses;
        } catch (error) {
            console.error('Error providing code lenses:', error);
            this.isAnalyzing = false;

            // Update analyzing context on error
            vscode.commands.executeCommand('setContext', 'reactNativePackageChecker.analyzing', false);

            try {
                const cachedResults = this.packageService.getCachedResultsByVersions(packageWithVersions);

                if (Object.keys(cachedResults).length > 0) {
                    vscode.window.showWarningMessage('Failed to fetch package data. Using cached data instead.');
                    this.lastSummaryData = this.calculateSummaryData(cachedResults, document.getText());
                    return this.createCodeLenses(document, cachedResults, showLatestVersion);
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
        showLatestVersion: boolean
    ): vscode.CodeLens[] {
        const codeLenses: vscode.CodeLens[] = [];
        const lines = document.getText().split(EXTENSION_CONFIG.LINE_SEPARATOR);
        const documentContent = document.getText();

        const requirementsResults = this.getRequirementsResults();

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.includes('"dependencies"') || line.includes('"devDependencies"')) {
                const range = new vscode.Range(i, 0, i, line.length);

                if (line.includes('"dependencies"') && !line.includes('"devDependencies"')) {
                    const summaryCodeLenses = this.createSummaryCodeLens(new vscode.Range(i, 0, i, 0), packageInfos);
                    codeLenses.push(...summaryCodeLenses);
                }

                const requirementsHeaderCodeLenses = this.createRequirementsHeaderCodeLenses(range);
                codeLenses.push(...requirementsHeaderCodeLenses);
            }

            const packageMatch = line.match(EXTENSION_CONFIG.PACKAGE_LINE_REGEX);

            if (packageMatch) {
                const packageName = packageMatch[1];

                // Skip packages in unwanted sections like resolutions, overrides, etc.
                if (isInUnwantedSection(lines, i)) {
                    continue;
                }

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

                const requirementResult = requirementsResults?.find((r) => r.packageName === packageName);
                console.log(`[CodeLens] Checking requirement result for ${packageName}:`, requirementResult);
                if (requirementResult) {
                    console.log(
                        `[CodeLens] Adding requirements CodeLens for ${packageName}: ${requirementResult.currentVersion} -> ${requirementResult.requiredVersion}`
                    );
                    const requirementsCodeLens = this.createRequirementsCodeLens(range, requirementResult);
                    codeLenses.push(requirementsCodeLens);
                } else {
                    console.log(`[CodeLens] No requirement result found for ${packageName}`);
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
        const cleanLatestVersion = cleanVersion(latestVersion);

        const symbol = hasUpdate ? STATUS_SYMBOLS.UPDATE : STATUS_SYMBOLS.LATEST;
        const text = hasUpdate ? `Latest ${cleanLatestVersion}` : `Latest ${cleanLatestVersion}`;

        const displayText = `${symbol}\u2009${text}`;

        return new vscode.CodeLens(range, {
            title: displayText,
            tooltip: this.getVersionTooltip(packageInfo),
            command: hasUpdate ? COMMANDS.UPDATE_PACKAGE_VERSION : '',
            arguments: hasUpdate ? [packageName, packageInfo.currentVersion, cleanLatestVersion] : [],
        });
    }

    private createRequirementsCodeLens(range: vscode.Range, result: RequirementResult): vscode.CodeLens {
        return new vscode.CodeLens(range, {
            title: `$(edit)\u2009Required ${result.requiredVersion}`,
            tooltip: `Current: ${result.currentVersion}, Required: ${result.requiredVersion}. Click to update.`,
            command: COMMANDS.UPDATE_TO_REQUIRED_VERSION,
            arguments: [result.packageName, result.requiredVersion],
        });
    }

    private createSummaryCodeLens(range: vscode.Range, packageInfos: PackageInfoMap): vscode.CodeLens[] {
        if (this.isAnalyzing) {
            return [
                new vscode.CodeLens(range, {
                    title: '$(sync~spin)\u2009Analyzing packages...',
                    tooltip: 'Package analysis in progress',
                    command: '',
                }),
            ];
        }

        if (!this.lastSummaryData && Object.keys(packageInfos).length === 0) {
            return [];
        }

        if (!this.lastSummaryData) {
            return [];
        }

        const { statusCounts } = this.lastSummaryData;
        const segments = this.createClickableSegments(statusCounts);

        if (segments.length === 0) {
            return [];
        }

        const codeLenses: vscode.CodeLens[] = [];

        segments.forEach((segment) => {
            const segmentCodeLens = this.createSegmentCodeLens(range, segment);
            codeLenses.push(segmentCodeLens);
        });

        const quickActionsCodeLens = new vscode.CodeLens(range, {
            title: `$(list-unordered)\u2009Quick actions`,
            tooltip: 'Show quick actions menu',
            command: COMMANDS.SHOW_QUICK_ACTIONS,
            arguments: [],
        });
        codeLenses.push(quickActionsCodeLens);

        return codeLenses;
    }

    private createClickableSegments(statusCounts: SummaryData['statusCounts']): CodeLensSegment[] {
        const segments: CodeLensSegment[] = [];

        const totalPackages =
            statusCounts.supported + statusCounts.unsupported + statusCounts.untested + statusCounts.unlisted;
        if (totalPackages > 0) {
            segments.push({
                symbol: '$(package)',
                count: totalPackages,
                label: `${totalPackages} packages`,
                status: 'all',
                command: 'reactNativePackageChecker.browseAllPackages',
                tooltip: 'Click to browse all packages',
            });
        }

        if (statusCounts.supported > 0) {
            segments.push({
                symbol: STATUS_SYMBOLS.SUPPORTED,
                count: statusCounts.supported,
                label: `${statusCounts.supported} New Arch Supported`,
                status: 'supported',
                command: 'reactNativePackageChecker.showSupportedPackages',
                tooltip: 'Click to view packages that support New Architecture',
            });
        }

        if (statusCounts.unsupported > 0) {
            segments.push({
                symbol: STATUS_SYMBOLS.UNSUPPORTED,
                count: statusCounts.unsupported,
                label: `${statusCounts.unsupported} New Arch Unsupported`,
                status: 'unsupported',
                command: 'reactNativePackageChecker.showUnsupportedPackages',
                tooltip: 'Click to view packages that do not support New Architecture',
            });
        }

        if (statusCounts.untested > 0) {
            segments.push({
                symbol: STATUS_SYMBOLS.UNTESTED,
                count: statusCounts.untested,
                label: `${statusCounts.untested} Untested`,
                status: 'untested',
                command: 'reactNativePackageChecker.showUntestedPackages',
                tooltip: 'Click to view packages that are untested with New Architecture',
            });
        }

        if (statusCounts.unlisted > 0) {
            segments.push({
                symbol: STATUS_SYMBOLS.UNLISTED,
                count: statusCounts.unlisted,
                label: `${statusCounts.unlisted} Unlisted`,
                status: 'unlisted',
                command: 'reactNativePackageChecker.showUnlistedPackages',
                tooltip: 'Click to view packages not listed in the directory',
            });
        }

        if (statusCounts.unmaintained > 0) {
            segments.push({
                symbol: STATUS_SYMBOLS.UNMAINTAINED,
                count: statusCounts.unmaintained,
                label: `${statusCounts.unmaintained} Unmaintained`,
                status: 'unmaintained',
                command: 'reactNativePackageChecker.showUnmaintainedPackages',
                tooltip: 'Click to view packages that appear unmaintained',
            });
        }

        return segments;
    }

    private createSegmentCodeLens(range: vscode.Range, segment: CodeLensSegment): vscode.CodeLens {
        const title = `${segment.symbol}\u2009${segment.label}`;

        return new vscode.CodeLens(range, {
            title,
            tooltip: segment.tooltip,
            command: segment.command,
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

    private createRequirementsHeaderCodeLenses(range: vscode.Range): vscode.CodeLens[] {
        const codeLenses: vscode.CodeLens[] = [];

        if (!this.RequirementsService) {
            return codeLenses;
        }

        if (this.RequirementsService.isEnabled()) {
            codeLenses.push(
                new vscode.CodeLens(range, {
                    title: `$(eye-closed)\u2009Hide requirements`,
                    tooltip: 'Hide requirements or check for a different React Native version',
                    command: 'reactNativePackageChecker.hideRequirements',
                    arguments: [],
                })
            );
        }

        return codeLenses;
    }

    private getRequirementsResults(): RequirementResult[] | null {
        if (!this.RequirementsService || !this.RequirementsService.isEnabled()) {
            console.log(`[CodeLens] Requirements not enabled or service not available`);
            return null;
        }

        console.log(`[CodeLens] Getting requirements results: ${this.requirementsResults.length} items`);
        this.requirementsResults.forEach((r) => {
            console.log(
                `[CodeLens] - Result: ${r.packageName} (${r.currentVersion} -> ${r.requiredVersion}, mismatch: ${r.hasRequirementMismatch})`
            );
        });
        return this.requirementsResults;
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
        const cleanCurrentVersion = packageInfo.currentVersion ? cleanVersion(packageInfo.currentVersion) : '';
        const cleanLatestVersion = packageInfo.latestVersion ? cleanVersion(packageInfo.latestVersion) : '';

        if (packageInfo.hasUpdate) {
            parts.push(`Update available: ${cleanCurrentVersion} → ${cleanLatestVersion}`);
            parts.push('Click to update package version');
        } else {
            parts.push(`Already latest version (${cleanLatestVersion})`);
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
            this.isAnalyzing = true;
            this.lastSummaryData = null;
            this.isApiCallInProgress = false;

            // Set analyzing context
            await vscode.commands.executeCommand('setContext', 'reactNativePackageChecker.analyzing', true);

            if (this.packageDecorationService) {
                this.packageDecorationService.clearDecorations();
            }

            this.refresh();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to refresh package data: ${errorMessage}`);

            // Reset analyzing state on error
            this.isAnalyzing = false;
            await vscode.commands.executeCommand('setContext', 'reactNativePackageChecker.analyzing', false);
        }
    }

    async enable(): Promise<void> {
        console.log('[CodeLens] Enable called');
        this.isEnabled = true;

        // Set context immediately for instant UI feedback
        await vscode.commands.executeCommand('setContext', EXTENSION_CONFIG.CODE_LENS_CONTEXT_KEY, true);

        // Only show analyzing state if we don't have cached data
        const cacheStats = this.packageService.getCacheStats();
        const hasCachedData = this.lastSummaryData !== null || cacheStats.packageCount > 0;

        if (!hasCachedData) {
            this.isAnalyzing = true;
            await vscode.commands.executeCommand('setContext', 'reactNativePackageChecker.analyzing', true);
        } else {
            this.isAnalyzing = false;
            await vscode.commands.executeCommand('setContext', 'reactNativePackageChecker.analyzing', false);
        }

        // Fire change event to trigger analysis
        this._onDidChangeCodeLenses.fire();
    }

    async disable(): Promise<void> {
        this.isEnabled = false;
        this.isAnalyzing = false;

        // Set context immediately for instant UI feedback
        await vscode.commands.executeCommand('setContext', EXTENSION_CONFIG.CODE_LENS_CONTEXT_KEY, false);
        await vscode.commands.executeCommand('setContext', 'reactNativePackageChecker.analyzing', false);

        if (this.packageDecorationService) {
            this.packageDecorationService.clearDecorations();
        }

        this.refresh();
    }

    async initialize(): Promise<void> {
        this.isEnabled = false;
        this.lastSummaryData = null;
        this.isAnalyzing = false;
        this.isApiCallInProgress = false;

        await vscode.commands.executeCommand('setContext', EXTENSION_CONFIG.CODE_LENS_CONTEXT_KEY, false);
        await vscode.commands.executeCommand('setContext', 'reactNativePackageChecker.analyzing', false);
    }

    dispose() {
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }
    }
}
