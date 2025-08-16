import * as vscode from 'vscode';
import { EXTENSION_CONFIG } from '../constants';

export class StatusBarService {
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.statusBarItem.text = "$(package) Package Checker";
        this.statusBarItem.tooltip = "React Native Package Checker - Click to choose how to open";
        this.statusBarItem.command = 'reactNativePackageChecker.showStatusBarMenu';
    }

    public show(): void {
        this.statusBarItem.show();
    }

    public hide(): void {
        this.statusBarItem.hide();
    }

    public updateVisibility(): void {
        const activeEditor = vscode.window.activeTextEditor;
        
        if (activeEditor && 
            activeEditor.document.fileName.endsWith(EXTENSION_CONFIG.PACKAGE_JSON_FILENAME)) {
            this.show();
        } else {
            this.hide();
        }
    }

    public dispose(): void {
        this.statusBarItem.dispose();
    }
}