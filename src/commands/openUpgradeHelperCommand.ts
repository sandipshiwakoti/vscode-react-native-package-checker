import * as vscode from 'vscode';

import { BrowserService } from '../services/browserService';
import { FileExtensions } from '../types';
import { cleanVersion } from '../utils/versionUtils';

export async function openUpgradeHelper(
    browserService: BrowserService,
    fromRNVersion?: string,
    toRnVersion?: string,
    readFromPackageJson: boolean = false
): Promise<void> {
    if (readFromPackageJson) {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document.fileName.endsWith(FileExtensions.PACKAGE_JSON)) {
            vscode.window.showErrorMessage('Please open a package.json file first');
            return;
        }

        try {
            const packageJsonContent = editor.document.getText();
            const packageJson = JSON.parse(packageJsonContent);

            const dependencies = packageJson.dependencies || {};
            const devDependencies = packageJson.devDependencies || {};

            let reactNativeVersion = dependencies['react-native'] || devDependencies['react-native'];

            if (!reactNativeVersion) {
                vscode.window.showErrorMessage('React Native not found in package.json dependencies');
                return;
            }

            const cleanVersionNumber = cleanVersion(reactNativeVersion);

            if (!cleanVersionNumber) {
                vscode.window.showErrorMessage('Could not parse React Native version from package.json');
                return;
            }

            browserService.openUpgradeHelper(cleanVersionNumber, toRnVersion);
        } catch {
            vscode.window.showErrorMessage('Failed to parse package.json file');
        }
    } else {
        if (!fromRNVersion) {
            vscode.window.showErrorMessage('React Native version is required');
            return;
        }
        browserService.openUpgradeHelper(fromRNVersion, toRnVersion);
    }
}
