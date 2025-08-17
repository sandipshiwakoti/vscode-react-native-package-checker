import * as vscode from 'vscode';

import {
    COMMANDS,
    EXTENSION_CONFIG,
    STATUS_COLORS,
    STATUS_DESCRIPTIONS,
    STATUS_LABELS,
    STATUS_SYMBOLS,
} from '../constants';
import { NewArchSupportStatus, PackageInfo, PackageInfoMap, StatusInfo } from '../types';

import { PackageService } from './packageService';

export class CodeLensProviderService implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

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

        try {
            const packageWithVersions = this.extractPackageNames(document.getText());
            if (packageWithVersions.length === 0) {
                return [];
            }

            const packageInfos = await this.packageService.checkPackages(packageWithVersions);
            return this.createCodeLenses(document, packageInfos);
        } catch (error) {
            console.error('Error providing code lenses:', error);

            try {
                const packageWithVersions = this.extractPackageNames(document.getText());
                if (packageWithVersions.length === 0) {
                    return [];
                }

                const cachedResults = this.packageService.getCachedResultsByVersions(packageWithVersions);

                if (Object.keys(cachedResults).length > 0) {
                    vscode.window.showWarningMessage('Failed to fetch package data. Using cached data instead.');
                    return this.createCodeLenses(document, cachedResults);
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
        }
    }

    private extractPackageNames(content: string): string[] {
        try {
            const packageJson = JSON.parse(content);
            const dependencies = packageJson[EXTENSION_CONFIG.DEPENDENCIES_KEY] || {};

            return Object.entries(dependencies).map(([name, version]) => {
                const cleanVersion = (version as string).replace(EXTENSION_CONFIG.VERSION_CLEAN_REGEX, '');
                return `${name}@${cleanVersion}`;
            });
        } catch {
            return [];
        }
    }

    private createCodeLenses(document: vscode.TextDocument, packageInfos: PackageInfoMap): vscode.CodeLens[] {
        const codeLenses: vscode.CodeLens[] = [];
        const lines = document.getText().split(EXTENSION_CONFIG.LINE_SEPARATOR);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const packageMatch = line.match(EXTENSION_CONFIG.PACKAGE_LINE_REGEX);

            if (packageMatch) {
                const packageName = packageMatch[1];
                const packageInfo = packageInfos[packageName];

                if (packageInfo) {
                    const range = new vscode.Range(i, 0, i, line.length);
                    const newArchCodeLens = this.createNewArchCodeLens(range, packageName, packageInfo);
                    codeLenses.push(newArchCodeLens);

                    if (packageInfo.unmaintained) {
                        const unmaintainedCodeLens = this.createUnmaintainedCodeLens(range);
                        codeLenses.push(unmaintainedCodeLens);
                    }
                }
            }
        }

        return codeLenses;
    }

    private createNewArchCodeLens(range: vscode.Range, packageName: string, packageInfo: PackageInfo): vscode.CodeLens {
        const color = this.getStatusColor(packageInfo.newArchitecture);
        const symbol = this.getStatusSymbol(packageInfo.newArchitecture);
        const status = this.getArchitectureStatus(packageInfo.newArchitecture);

        const displayText = `${color} ${symbol} ${status.text}`;

        return new vscode.CodeLens(range, {
            title: displayText,
            tooltip: this.getNewArchTooltip(packageInfo),
            command: COMMANDS.SHOW_PACKAGE_DETAILS,
            arguments: [packageName, packageInfo],
        });
    }

    private createUnmaintainedCodeLens(range: vscode.Range): vscode.CodeLens {
        return new vscode.CodeLens(range, {
            title: `${STATUS_COLORS.UNMAINTAINED} Unmaintained`,
            tooltip: 'This package appears to be unmaintained',
            command: '',
        });
    }

    private getStatusColor(status?: NewArchSupportStatus): string {
        switch (status) {
            case NewArchSupportStatus.Supported:
                return STATUS_COLORS.SUPPORTED;
            case NewArchSupportStatus.Unsupported:
                return STATUS_COLORS.UNSUPPORTED;
            case NewArchSupportStatus.Untested:
                return STATUS_COLORS.UNTESTED;
            case NewArchSupportStatus.Unlisted:
            default:
                return STATUS_COLORS.UNKNOWN;
        }
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
                return STATUS_SYMBOLS.UNKNOWN;
        }
    }

    private getNewArchTooltip(packageInfo: PackageInfo): string {
        const status = this.getArchitectureStatus(packageInfo.newArchitecture);
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
                return { text: STATUS_LABELS.UNKNOWN, description: STATUS_DESCRIPTIONS.UNKNOWN };
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

    refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }

    dispose() {}
}
