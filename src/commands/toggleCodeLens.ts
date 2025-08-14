import * as vscode from 'vscode';
import { PackageCodeLensProvider } from '../providers/codeLensProvider';

export async function toggleCodeLens(codeLensProvider: PackageCodeLensProvider): Promise<void> {
    const config = vscode.workspace.getConfiguration('reactNativePackageChecker');
    const currentValue = config.get('enableCodeLens', true);

    await config.update('enableCodeLens', !currentValue, vscode.ConfigurationTarget.Workspace);
    codeLensProvider.refresh();

    const status = !currentValue ? 'enabled' : 'disabled';
    vscode.window.showInformationMessage(`React Native Package Checker ${status}`);
}