import * as vscode from 'vscode';
import { CodeLensProviderService } from './services/codeLensProviderService';
import { PackageService } from './services/packageService';

import { enableCodeLens, disableCodeLens, initializeCodeLens } from './commands/codeLensCommand';
import { CodeLensService } from './services/codeLensService';
import { BrowserService } from './services/browserService';
import { CheckerService } from './services/checkerService';
import { PackageDetailsService } from './services/packageDetailsService';
import { showPackageDetails } from './commands/showPackageDetailsCommand';
import { showChecker } from './commands/showCheckerCommand';
import { openInBrowser } from './commands/openInBrowserCommand';
import { showStatusBarMenu } from './commands/showStatusBarMenuCommand';
import { StatusBarService } from './services/statusBarService';

import { COMMANDS, EXTENSION_CONFIG } from './constants/index';
import { PackageInfo } from './types';

export function activate(context: vscode.ExtensionContext) {
	const packageService = new PackageService();
	const codeLensProviderService = new CodeLensProviderService(packageService, context);
	const codeLensService = new CodeLensService(codeLensProviderService, context);
	const browserService = new BrowserService();
	const checkerService = new CheckerService();
	const packageDetailsService = new PackageDetailsService();
	const statusBarService = new StatusBarService();

	const codeLensDisposable = vscode.languages.registerCodeLensProvider(
		{ language: EXTENSION_CONFIG.LANGUAGE_JSON, pattern: EXTENSION_CONFIG.PACKAGE_JSON_PATTERN },
		codeLensProviderService
	);

	const enableCommand = vscode.commands.registerCommand(
		COMMANDS.ENABLE_CODE_LENS,
		() => enableCodeLens(codeLensService)
	);

	const disableCommand = vscode.commands.registerCommand(
		COMMANDS.DISABLE_CODE_LENS,
		() => disableCodeLens(codeLensService)
	);

	const detailsCommand = vscode.commands.registerCommand(
		COMMANDS.SHOW_PACKAGE_DETAILS,
		(packageName: string, packageInfo: PackageInfo) => showPackageDetails(packageDetailsService, packageName, packageInfo, context)
	);

	const checkerCommand = vscode.commands.registerCommand(
		COMMANDS.SHOW_CHECKER,
		() => showChecker(checkerService, context)
	);

	const browserCommand = vscode.commands.registerCommand(
		COMMANDS.OPEN_IN_BROWSER,
		() => openInBrowser(browserService)
	);

	const statusBarMenuCommand = vscode.commands.registerCommand(
		COMMANDS.SHOW_STATUS_BAR_MENU,
		() => showStatusBarMenu(checkerService, browserService, context)
	);

	initializeCodeLens(codeLensService);

	const activeEditorListener = vscode.window.onDidChangeActiveTextEditor(() => {
		codeLensProviderService.refresh();
		statusBarService.updateVisibility();
	});

	statusBarService.updateVisibility();

	const documentChangeListener = vscode.workspace.onDidChangeTextDocument(() => {
		codeLensProviderService.refresh();
	});

	context.subscriptions.push(
		codeLensDisposable,
		enableCommand,
		disableCommand,
		detailsCommand,
		checkerCommand,
		browserCommand,
		statusBarMenuCommand,
		statusBarService,
		codeLensProviderService,
		activeEditorListener,
		documentChangeListener
	);
}

export function deactivate() { }