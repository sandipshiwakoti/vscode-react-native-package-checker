import * as vscode from 'vscode';
import { createCheckerPanel } from '../ui/checkerPanel';

export class CheckerService {
    showChecker(context: vscode.ExtensionContext): void {
        createCheckerPanel(context);
    }
}