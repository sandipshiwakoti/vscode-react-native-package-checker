import * as vscode from 'vscode';

import { NPM_REGISTRY_CONFIG } from '../constants';
import { BrowserService } from '../services/browserService';
import { CacheManagerService } from '../services/cacheManagerService';
import { FileExtensions } from '../types';
import { parsePackageJson } from '../utils/packageUtils';
import { cleanVersion, compareVersions } from '../utils/versionUtils';

export async function openUpgradeHelper(
    browserService: BrowserService,
    cacheManager?: CacheManagerService,
    fromRNVersion?: string,
    toRnVersion?: string,
    readFromPackageJson: boolean = false,
    showVersionInput: boolean = false
): Promise<void> {
    if (readFromPackageJson) {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document.fileName.endsWith(FileExtensions.PACKAGE_JSON)) {
            vscode.window.showErrorMessage('Please open a package.json file first');
            return;
        }

        const packageJsonContent = editor.document.getText();
        const packageJson = parsePackageJson(packageJsonContent);

        if (!packageJson) {
            vscode.window.showErrorMessage('Failed to parse package.json');
            return;
        }

        try {
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

            if (showVersionInput) {
                let latestVersion = '';
                if (cacheManager) {
                    latestVersion = cacheManager.getLatestVersion('react-native') || '';
                }

                if (!latestVersion) {
                    try {
                        const response = await fetch(`${NPM_REGISTRY_CONFIG.BASE_URL}/react-native/latest`);
                        if (response.ok) {
                            const data = (await response.json()) as { version?: string };
                            latestVersion = data.version || '';
                        }
                    } catch {}
                }

                const latestInfo = latestVersion ? ` (latest: ${latestVersion})` : '';

                const fromVersion = await vscode.window.showInputBox({
                    prompt: `Enter the React Native version to upgrade from${latestInfo}`,
                    placeHolder: 'e.g., 0.72.0',
                    value: cleanVersionNumber,
                    validateInput: (value: string) => {
                        if (!value.trim()) {
                            return 'Version is required';
                        }
                        if (!/^\d+\.\d+(\.\d+)?$/.test(value.trim())) {
                            return 'Please enter a valid version format (e.g., 0.72.0)';
                        }
                        if (latestVersion) {
                            const comparison = compareVersions(value.trim(), latestVersion);
                            if (comparison === 0) {
                                return `Cannot upgrade from latest version (${latestVersion}). Please select an older version.`;
                            }
                            if (comparison > 0) {
                                return `Version ${value.trim()} is greater than latest version (${latestVersion}). Please enter a valid version.`;
                            }
                        }
                        return null;
                    },
                });

                if (!fromVersion) {
                    return;
                }

                browserService.openUpgradeHelper(fromVersion.trim());
            } else {
                browserService.openUpgradeHelper(cleanVersionNumber, toRnVersion);
            }
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
