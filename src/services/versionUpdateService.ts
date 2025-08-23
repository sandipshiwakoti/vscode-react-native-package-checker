import * as vscode from 'vscode';

import { COMMANDS } from '../types';
import { FileExtensions } from '../types';
import { escapeRegExp, extractVersionPrefix, hasVersionUpdate } from '../utils/versionUtils';

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

        context.subscriptions.push(updateCommand);
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
                    `Cannot update ${packageName}: version ${currentVersion} is already up to date or newer than ${latestVersion}`
                );
                return;
            }

            await this.updatePackageVersion(activeEditor.document, packageName, latestVersion);

            this.packageService.updatePackageVersionInCache(packageName, latestVersion);

            vscode.window.showInformationMessage(
                `Updated ${packageName} to ${latestVersion}. Save file and run your package manager to install.`
            );

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

        if (wasUpdated) {
            const updatedContent = lines.join('\n');
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(content.length));

            edit.replace(document.uri, fullRange, updatedContent);
            await vscode.workspace.applyEdit(edit);
        }
    }

    canUpdateVersion(packageName: string, currentVersion: string, latestVersion: string): boolean {
        if (!packageName || !currentVersion || !latestVersion) {
            return false;
        }

        return hasVersionUpdate(currentVersion, latestVersion);
    }
}
