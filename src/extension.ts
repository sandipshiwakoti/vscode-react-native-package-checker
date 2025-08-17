import * as vscode from 'vscode';

import { disableCodeLens, enableCodeLens, initializeCodeLens } from './commands/codeLensCommand';
import { refreshPackages } from './commands/refreshPackagesCommand';
import { showCheckerOptions } from './commands/showCheckerOptionsCommand';
import { showPackageDetails } from './commands/showPackageDetailsCommand';
import { COMMANDS, EXTENSION_CONFIG } from './constants/index';
import { BrowserService } from './services/browserService';
import { CheckerService } from './services/checkerService';
import { CodeLensProviderService } from './services/codeLensProviderService';
import { CodeLensService } from './services/codeLensService';
import { PackageDetailsService } from './services/packageDetailsService';
import { PackageService } from './services/packageService';
import { StatusBarService } from './services/statusBarService';
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

    const enableCommand = vscode.commands.registerCommand(COMMANDS.ENABLE_CODE_LENS, () =>
        enableCodeLens(codeLensService)
    );

    const disableCommand = vscode.commands.registerCommand(COMMANDS.DISABLE_CODE_LENS, () =>
        disableCodeLens(codeLensService)
    );

    const detailsCommand = vscode.commands.registerCommand(
        COMMANDS.SHOW_PACKAGE_DETAILS,
        (packageName: string, packageInfo: PackageInfo) =>
            showPackageDetails(packageDetailsService, packageName, packageInfo, context)
    );

    const checkerCommand = vscode.commands.registerCommand(COMMANDS.SHOW_CHECKER_OPTIONS, () =>
        showCheckerOptions(checkerService, browserService, context)
    );

    const refreshCommand = vscode.commands.registerCommand(COMMANDS.REFRESH_PACKAGES, () =>
        refreshPackages(codeLensProviderService, packageService)
    );

    initializeCodeLens(codeLensService);

    const activeEditorListener = vscode.window.onDidChangeActiveTextEditor(() => {
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
        refreshCommand,
        statusBarService,
        codeLensProviderService,
        activeEditorListener,
        documentChangeListener
    );
}

export function deactivate() {}
