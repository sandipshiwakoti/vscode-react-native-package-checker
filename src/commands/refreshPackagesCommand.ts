import * as vscode from 'vscode';

import { CodeLensProviderService } from '../services/codeLensProviderService';
import { PackageService } from '../services/packageService';

export async function refreshPackages(
    codeLensProviderService: CodeLensProviderService,
    packageService: PackageService
): Promise<void> {
    try {
        packageService.clearCache();
        codeLensProviderService.refresh();
        vscode.window.showInformationMessage('Package data refreshed successfully');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to refresh package data: ${errorMessage}`);
    }
}
