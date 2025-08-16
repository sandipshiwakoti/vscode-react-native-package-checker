import * as vscode from 'vscode';

import { EXTENSION_CONFIG } from '../constants';
import { extractPackagesFromPackageJson, getCheckUrl } from '../utils/checkerUtils';

export class BrowserService {
    openPackageChecker(): void {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document.fileName.endsWith(EXTENSION_CONFIG.PACKAGE_JSON_FILENAME)) {
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
}
