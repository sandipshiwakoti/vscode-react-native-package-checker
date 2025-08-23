import * as vscode from 'vscode';

import {
    COMMANDS,
    EXTENSION_CONFIG,
    INTERNAL_PACKAGES,
    STATUS_DESCRIPTIONS,
    STATUS_LABELS,
    STATUS_SYMBOLS,
} from '../constants';
import { NewArchSupportStatus, PackageInfo, PackageInfoMap, StatusInfo } from '../types';

import { PackageService } from './packageService';

export class CodeLensProviderService implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;
    private isProcessingLenses = false;
    private refreshTimeout: NodeJS.Timeout | null = null;

    constructor(
        private packageService: PackageService,
        private context: vscode.ExtensionContext
    ) {}

    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        const isEnabled = this.context.globalState.get(
            EXTENSION_CONFIG.CODE_LENS_STATE_KEY,
            EXTENSION_CONFIG.DEFAULT_CODE_LENS_ENABLED
        );

        if (!isEnabled || !document.fileName.endsWith(EXTENSION_CONFIG.PACKAGE_JSON_FILENAME)) {
            return [];
        }

        const showLatestVersion = vscode.workspace
            .getConfiguration(EXTENSION_CONFIG.CONFIGURATION_SECTION)
            .get(EXTENSION_CONFIG.SHOW_LATEST_VERSION_KEY, EXTENSION_CONFIG.DEFAULT_SHOW_LATEST_VERSION);

        const packageWithVersions = this.extractPackageNames(document.getText());
        if (packageWithVersions.length === 0) {
            return [];
        }

        if (this.isProcessingLenses) {
            return [];
        }

        this.isProcessingLenses = true;

        try {
            const hadCachedData = packageWithVersions.some((pkg) => {
                const packageName = this.extractPackageNameFromVersionString(pkg);
                return this.packageService.getCachedVersion(packageName) !== null;
            });

            const packageInfos = await this.packageService.checkPackages(
                packageWithVersions,
                undefined,
                showLatestVersion,
                document.getText()
            );

            const hasNewData = packageWithVersions.some((pkg) => {
                const packageName = this.extractPackageNameFromVersionString(pkg);
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

    private extractPackageNames(content: string): string[] {
        try {
            const packageJson = JSON.parse(content);
            const dependencies = packageJson[EXTENSION_CONFIG.DEPENDENCIES_KEY] || {};
            const devDependencies = packageJson['devDependencies'] || {};

            const allDependencies = { ...dependencies, ...devDependencies };

            return Object.entries(allDependencies).map(([name, version]) => {
                const cleanVersion = (version as string).replace(EXTENSION_CONFIG.VERSION_CLEAN_REGEX, '');
                return `${name}@${cleanVersion}`;
            });
        } catch {
            return [];
        }
    }

    private isDevDependency(content: string, packageName: string): boolean {
        try {
            const packageJson = JSON.parse(content);
            const dependencies = packageJson[EXTENSION_CONFIG.DEPENDENCIES_KEY] || {};
            const devDependencies = packageJson['devDependencies'] || {};

            return devDependencies[packageName] !== undefined && dependencies[packageName] === undefined;
        } catch {
            return false;
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

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const packageMatch = line.match(EXTENSION_CONFIG.PACKAGE_LINE_REGEX);

            if (packageMatch) {
                const packageName = packageMatch[1];
                const packageInfo = packageInfos[packageName];

                if (packageInfo) {
                    const range = new vscode.Range(i, 0, i, line.length);
                    const isDevDep = this.isDevDependency(documentContent, packageName);

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
                        const range = new vscode.Range(i, 0, i, line.length);
                        const currentVersion = this.extractVersionFromLine(line);
                        const mockPackageInfo: PackageInfo = {
                            npmUrl: '',
                            latestVersion: cachedVersion,
                            currentVersion: currentVersion,
                            hasUpdate: this.hasVersionUpdate(currentVersion, cachedVersion),
                            newArchitecture: NewArchSupportStatus.Unlisted,
                        };
                        const versionCodeLens = this.createVersionCodeLens(range, packageName, mockPackageInfo);
                        codeLenses.push(versionCodeLens);
                    }
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
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }

        this.refreshTimeout = setTimeout(() => {
            this.isProcessingLenses = false;
            this._onDidChangeCodeLenses.fire();
            this.refreshTimeout = null;
        }, 50);
    }

    private extractVersionFromLine(line: string): string {
        const versionMatch = line.match(/"([^"]+)"/);
        return versionMatch ? versionMatch[1].replace(/^[\^~]/, '') : '';
    }

    private extractPackageNameFromVersionString(packageWithVersion: string): string {
        const lastAtIndex = packageWithVersion.lastIndexOf('@');
        if (lastAtIndex === -1 || lastAtIndex === 0) {
            return packageWithVersion;
        }
        return packageWithVersion.substring(0, lastAtIndex);
    }

    private hasVersionUpdate(currentVersion: string, latestVersion: string): boolean {
        if (!currentVersion || !latestVersion) {
            return false;
        }
        const cleanCurrent = currentVersion.replace(/^[\^~]/, '');
        const cleanLatest = latestVersion.replace(/^[\^~]/, '');
        return this.compareVersions(cleanLatest, cleanCurrent) > 0;
    }

    private compareVersions(version1: string, version2: string): number {
        const v1Parts = version1.split('.').map(Number);
        const v2Parts = version2.split('.').map(Number);
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

    dispose() {
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }
    }
}
