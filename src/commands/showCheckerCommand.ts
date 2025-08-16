import * as vscode from 'vscode';

import { CheckerService } from '../services/checkerService';

export function showChecker(checkerService: CheckerService, context: vscode.ExtensionContext): void {
    checkerService.showChecker(context);
}
