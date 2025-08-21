import * as vscode from 'vscode';

import { BrowserService } from '../services/browserService';
import { CheckerService } from '../services/checkerService';

export async function showCheckerOptions(
    checkerService: CheckerService,
    browserService: BrowserService,
    context: vscode.ExtensionContext
): Promise<void> {
    const options = [
        {
            label: '$(window) Open in Editor Panel',
            description: 'Open Package Checker Website in VS Code panel',
            action: 'editor',
        },
        {
            label: '$(globe) Open in Browser',
            description: 'Open Package Checker Website in your browser',
            action: 'browser',
        },
    ];

    const selected = await vscode.window.showQuickPick(options, {
        placeHolder: 'Choose how to open Package Checker Website',
        matchOnDescription: true,
    });

    if (selected) {
        if (selected.action === 'editor') {
            checkerService.showChecker(context);
        } else if (selected.action === 'browser') {
            browserService.openPackageChecker();
        }
    }
}
