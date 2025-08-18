import * as vscode from 'vscode';

import { COMMANDS } from '../constants';

import { CodeLensProviderService } from './codeLensProviderService';
import { PackageService } from './packageService';
import { VersionUpdateService } from './versionUpdateService';

export class VersionUpdateCommandHandler {
    constructor(
        private versionUpdateService: VersionUpdateService,
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

            if (!activeEditor.document.fileName.endsWith('package.json')) {
                vscode.window.showErrorMessage('Active file is not a package.json');
                return;
            }

            if (!this.versionUpdateService.canUpdateVersion(packageName, currentVersion, latestVersion)) {
                vscode.window.showWarningMessage(
                    `Cannot update ${packageName}: version ${currentVersion} is already up to date or newer than ${latestVersion}`
                );
                return;
            }

            await this.versionUpdateService.updatePackageVersion(activeEditor.document, packageName, latestVersion);

            await activeEditor.document.save();

            this.packageService.updatePackageVersionInCache(packageName, latestVersion);

            vscode.window.showInformationMessage(
                `Updated ${packageName} to ${latestVersion} and saved. Run your package manager to install.`
            );

            this.codeLensProviderService.refresh();
        } catch (error) {
            console.error('Error updating package version:', error);
            vscode.window.showErrorMessage(
                `Failed to update ${packageName}: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}
