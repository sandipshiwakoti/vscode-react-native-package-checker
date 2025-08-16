import * as vscode from 'vscode';
import { CheckerService } from '../services/checkerService';
import { BrowserService } from '../services/browserService';

export async function showStatusBarMenu(
    checkerService: CheckerService,
    browserService: BrowserService,
    context: vscode.ExtensionContext
): Promise<void> {
    const options = [
        {
            label: '$(window) Open in Editor Panel',
            description: 'Open Package Checker in VS Code panel',
            action: 'editor'
        },
        {
            label: '$(globe) Open in Browser',
            description: 'Open Package Checker in external browser',
            action: 'browser'
        }
    ];

    const selected = await vscode.window.showQuickPick(options, {
        placeHolder: 'Choose how to open Package Checker',
        matchOnDescription: true
    });

    if (selected) {
        if (selected.action === 'editor') {
            checkerService.showChecker(context);
        } else if (selected.action === 'browser') {
            browserService.openPackageChecker();
        }
    }
}