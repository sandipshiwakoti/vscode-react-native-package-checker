import * as vscode from 'vscode';
import { CodeLensProviderService } from './codeLensProviderService';
import { EXTENSION_CONFIG } from '../constants';

export class CodeLensService {
    constructor(
        private codeLensProviderService: CodeLensProviderService,
        private context: vscode.ExtensionContext
    ) {}

    async enable(): Promise<void> {
        await this.updateState(true);
        vscode.window.showInformationMessage('React Native Package Checker enabled');
    }

    async disable(): Promise<void> {
        await this.updateState(false);
        vscode.window.showInformationMessage('React Native Package Checker disabled');
    }

    initialize(): void {
        const isEnabled = this.context.globalState.get(
            EXTENSION_CONFIG.CODE_LENS_STATE_KEY, 
            EXTENSION_CONFIG.DEFAULT_CODE_LENS_ENABLED
        );
        vscode.commands.executeCommand('setContext', EXTENSION_CONFIG.CODE_LENS_CONTEXT_KEY, isEnabled);
    }

    private async updateState(enabled: boolean): Promise<void> {
        await this.context.globalState.update(EXTENSION_CONFIG.CODE_LENS_STATE_KEY, enabled);
        await vscode.commands.executeCommand('setContext', EXTENSION_CONFIG.CODE_LENS_CONTEXT_KEY, enabled);
        this.codeLensProviderService.refresh();
    }
}