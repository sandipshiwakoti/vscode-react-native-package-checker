import * as vscode from 'vscode';
import * as path from 'path';

import { NewArchSupportStatus, PackageInfoMap } from '../types';
import { isDevDependency } from '../utils/packageUtils';

export class PackageDecorationService {
    private supportedDecoration!: vscode.TextEditorDecorationType;
    private unsupportedDecoration!: vscode.TextEditorDecorationType;
    private untestedDecoration!: vscode.TextEditorDecorationType;
    private unlistedDecoration!: vscode.TextEditorDecorationType;
    private context: vscode.ExtensionContext;
    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.initializeDecorations();
    }

    private initializeDecorations(): void {
        const extensionPath = this.context.extensionPath;

        this.supportedDecoration = vscode.window.createTextEditorDecorationType({
            light: {
                gutterIconPath: vscode.Uri.file(path.join(extensionPath, 'assets', 'light', 'circle-check-big.svg')),
                gutterIconSize: 'contain',
            },
            dark: {
                gutterIconPath: vscode.Uri.file(path.join(extensionPath, 'assets', 'dark', 'circle-check-big.svg')),
                gutterIconSize: 'contain',
            },
        });

        this.unsupportedDecoration = vscode.window.createTextEditorDecorationType({
            light: {
                gutterIconPath: vscode.Uri.file(path.join(extensionPath, 'assets', 'light', 'circle-x.svg')),
                gutterIconSize: 'contain',
            },
            dark: {
                gutterIconPath: vscode.Uri.file(path.join(extensionPath, 'assets', 'dark', 'circle-x.svg')),
                gutterIconSize: 'contain',
            },
        });

        this.untestedDecoration = vscode.window.createTextEditorDecorationType({
            light: {
                gutterIconPath: vscode.Uri.file(path.join(extensionPath, 'assets', 'light', 'circle-alert.svg')),
                gutterIconSize: 'contain',
            },
            dark: {
                gutterIconPath: vscode.Uri.file(path.join(extensionPath, 'assets', 'dark', 'circle-alert.svg')),
                gutterIconSize: 'contain',
            },
        });

        this.unlistedDecoration = vscode.window.createTextEditorDecorationType({
            light: {
                gutterIconPath: vscode.Uri.file(
                    path.join(extensionPath, 'assets', 'light', 'circle-question-mark.svg')
                ),
                gutterIconSize: 'contain',
            },
            dark: {
                gutterIconPath: vscode.Uri.file(path.join(extensionPath, 'assets', 'dark', 'circle-question-mark.svg')),
                gutterIconSize: 'contain',
            },
        });
    }

    public updateDecorations(packageInfos: PackageInfoMap): void {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document.fileName.endsWith('package.json')) {
            return;
        }

        // Check if decorations are enabled in settings
        const showDecorations = vscode.workspace
            .getConfiguration('reactNativePackageChecker')
            .get('showStatusDecorations', true);

        if (!showDecorations) {
            this.clearDecorations();
            return;
        }

        const supportedRanges: vscode.DecorationOptions[] = [];
        const unsupportedRanges: vscode.DecorationOptions[] = [];
        const untestedRanges: vscode.DecorationOptions[] = [];
        const unlistedRanges: vscode.DecorationOptions[] = [];

        const content = activeEditor.document.getText();
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const packageMatch = line.match(/"([^"]+)"\s*:\s*"[^"]+"/);

            if (packageMatch) {
                const packageName = packageMatch[1];
                const packageInfo = packageInfos[packageName];

                if (packageInfo && !isDevDependency(content, packageName)) {
                    const range = new vscode.Range(i, 0, i, line.length);
                    const decorationOption: vscode.DecorationOptions = {
                        range,
                    };

                    switch (packageInfo.newArchitecture) {
                        case NewArchSupportStatus.Supported:
                            supportedRanges.push(decorationOption);
                            break;
                        case NewArchSupportStatus.Unsupported:
                            unsupportedRanges.push(decorationOption);
                            break;
                        case NewArchSupportStatus.Untested:
                            untestedRanges.push(decorationOption);
                            break;
                        case NewArchSupportStatus.Unlisted:
                        default:
                            unlistedRanges.push(decorationOption);
                            break;
                    }
                }
            }
        }

        activeEditor.setDecorations(this.supportedDecoration, supportedRanges);
        activeEditor.setDecorations(this.unsupportedDecoration, unsupportedRanges);
        activeEditor.setDecorations(this.untestedDecoration, untestedRanges);
        activeEditor.setDecorations(this.unlistedDecoration, unlistedRanges);
    }

    public clearDecorations(): void {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            activeEditor.setDecorations(this.supportedDecoration, []);
            activeEditor.setDecorations(this.unsupportedDecoration, []);
            activeEditor.setDecorations(this.untestedDecoration, []);
            activeEditor.setDecorations(this.unlistedDecoration, []);
        }
    }

    public async toggleDecorations(): Promise<void> {
        const config = vscode.workspace.getConfiguration('reactNativePackageChecker');
        const currentValue = config.get('showStatusDecorations', true);
        await config.update('showStatusDecorations', !currentValue, vscode.ConfigurationTarget.Global);

        if (!currentValue) {
            // Decorations were just enabled, refresh them
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && activeEditor.document.fileName.endsWith('package.json')) {
                // Trigger a refresh to show decorations
                vscode.commands.executeCommand('reactNativePackageChecker.refreshPackages');
            }
        } else {
            // Decorations were just disabled, clear them
            this.clearDecorations();
        }
    }

    public dispose(): void {
        this.supportedDecoration.dispose();
        this.unsupportedDecoration.dispose();
        this.untestedDecoration.dispose();
        this.unlistedDecoration.dispose();
    }
}
