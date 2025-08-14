import * as vscode from 'vscode';
import { PackageCodeLensProvider } from './providers/codeLensProvider';
import { PackageService } from './services/packageService';

import { toggleCodeLens } from './commands/toggleCodeLens';
import { showPackageDetails } from './commands/showPackageDetails';
import { COMMANDS, PACKAGE_JSON_PATTERN } from './constants';
import { PackageInfo } from './types';

export function activate(context: vscode.ExtensionContext) {

	const packageService = new PackageService();
	const codeLensProvider = new PackageCodeLensProvider(packageService);

	const codeLensDisposable = vscode.languages.registerCodeLensProvider(
		{ language: 'json', pattern: PACKAGE_JSON_PATTERN },
		codeLensProvider
	);

	const refreshCommand = vscode.commands.registerCommand(
		COMMANDS.REFRESH_CODE_LENS,
		() => {
			codeLensProvider.refresh();
			vscode.window.showInformationMessage('Package status refreshed');
		}
	);

	const toggleCommand = vscode.commands.registerCommand(
		COMMANDS.TOGGLE_CODE_LENS,
		() => toggleCodeLens(codeLensProvider)
	);

	const enableCommand = vscode.commands.registerCommand(
		COMMANDS.ENABLE_CODE_LENS,
		() => toggleCodeLens(codeLensProvider)
	);

	const detailsCommand = vscode.commands.registerCommand(
		COMMANDS.SHOW_PACKAGE_DETAILS,
		(packageName: string, packageInfo: PackageInfo) => showPackageDetails(packageName, packageInfo, context)
	);

	const activeEditorListener = vscode.window.onDidChangeActiveTextEditor(() => {
		codeLensProvider.refresh();
	});

	const documentChangeListener = vscode.workspace.onDidChangeTextDocument(() => {
		codeLensProvider.refresh();
	});

	context.subscriptions.push(
		codeLensDisposable,
		refreshCommand,
		toggleCommand,
		enableCommand,
		detailsCommand,
		codeLensProvider,
		activeEditorListener,
		documentChangeListener
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
