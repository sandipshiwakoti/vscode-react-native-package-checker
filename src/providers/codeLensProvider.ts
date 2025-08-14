import * as vscode from 'vscode';
import { PackageService } from '../services/packageService';
import { NewArchSupportStatus, StatusInfo, PackageInfoMap } from '../types';
import { COMMANDS, STATUS_LABELS, STATUS_DESCRIPTIONS } from '../constants';

export class PackageCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor(private packageService: PackageService) {
    }

    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        const config = vscode.workspace.getConfiguration('reactNativePackageChecker');
        const isEnabled = config.get('enableCodeLens', true);

        if (!isEnabled || !document.fileName.endsWith('package.json')) {
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
            return [];
        }
    }

    private extractPackageNames(content: string): string[] {
        try {
            const packageJson = JSON.parse(content);
            const dependencies = packageJson.dependencies || {};

            return Object.entries(dependencies).map(([name, version]) => {
                const cleanVersion = (version as string).replace(/[\^~]/, '');
                return `${name}@${cleanVersion}`;
            });
        } catch (error) {
            return [];
        }
    }

    private createCodeLenses(document: vscode.TextDocument, packageInfos: PackageInfoMap): vscode.CodeLens[] {
        const codeLenses: vscode.CodeLens[] = [];
        const lines = document.getText().split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const packageMatch = line.match(/"([^"]+)"\s*:\s*"[^"]+"/);

            if (packageMatch) {
                const packageName = packageMatch[1];
                const packageInfo = packageInfos[packageName];

                if (packageInfo) {
                    const range = new vscode.Range(i, 0, i, line.length);
                    const status = this.getArchitectureStatus(packageInfo.newArchitecture);
                    const icon = this.getStatusIcon(packageInfo.newArchitecture);

                    codeLenses.push(new vscode.CodeLens(range, {
                        title: `$(${icon}) ${status.text}`,
                        tooltip: this.getTooltip(packageInfo, status),
                        command: COMMANDS.SHOW_PACKAGE_DETAILS,
                        arguments: [packageName, packageInfo]
                    }));
                }
            }
        }

        return codeLenses;
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

    private getStatusIcon(status?: NewArchSupportStatus): string {
        switch (status) {
            case NewArchSupportStatus.Supported:
                return 'check';
            case NewArchSupportStatus.Unsupported:
                return 'x';
            case NewArchSupportStatus.Untested:
                return 'warning';
            case NewArchSupportStatus.Unlisted:
            default:
                return 'question';
        }
    }

    private getTooltip(packageInfo: any, status: StatusInfo): string {
        const parts = [status.text, status.description];

        if (packageInfo.unmaintained) {
            parts.push('This package appears to be unmaintained');
        }

        if (packageInfo.newArchitectureNote) {
            parts.push(packageInfo.newArchitectureNote);
        }

        parts.push('Click for more details');
        return parts.join('\n\n');
    }

    refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }

    dispose() {
    }
}