import * as vscode from 'vscode';

import { EXTERNAL_URLS } from '../constants';
import { FileExtensions } from '../types';
import { getCheckUrl } from '../utils/checkerUtils';
import { extractPackagesFromPackageJson } from '../utils/packageUtils';

export class BrowserService {
    openPackageChecker(): void {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document.fileName.endsWith(FileExtensions.PACKAGE_JSON)) {
            vscode.window.showErrorMessage('Please open a package.json file first');
            return;
        }

        const packages = extractPackagesFromPackageJson(editor.document.getText());
        if (packages.length === 0) {
            vscode.window.showErrorMessage('No dependencies found in package.json');
            return;
        }

        const browserUrl = getCheckUrl(packages, true);
        vscode.env.openExternal(vscode.Uri.parse(browserUrl));
    }

    openUpgradeHelper(fromRNVersion: string, toRnVersion?: string): void {
        vscode.env.openExternal(
            vscode.Uri.parse(
                `${EXTERNAL_URLS.UPGRADE_HELPER_BASE}/?from=${fromRNVersion}${toRnVersion ? `&to=${toRnVersion}` : ''}`
            )
        );
    }
}
