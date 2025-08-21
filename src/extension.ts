import * as vscode from 'vscode';

import { disableCodeLens, enableCodeLens, initializeCodeLens } from './commands/codeLensCommand';
import { openUpgradeHelper } from './commands/openUpgradeHelper';
import { refreshPackages } from './commands/refreshPackagesCommand';
import { showCheckerOptions } from './commands/showCheckerOptionsCommand';
import { showPackageDetails } from './commands/showPackageDetailsCommand';
import { COMMANDS, EXTENSION_CONFIG } from './constants/index';
import { BrowserService } from './services/browserService';
import { CheckerService } from './services/checkerService';
import { CodeLensProviderService } from './services/codeLensProviderService';
import { CodeLensService } from './services/codeLensService';
import { LoadingNotificationService } from './services/loadingNotificationService';
import { NpmRegistryService } from './services/npmRegistryService';
import { PackageDetailsService } from './services/packageDetailsService';
import { PackageService } from './services/packageService';
import { VersionUpdateCommandHandler } from './services/versionUpdateCommandHandler';
import { VersionUpdateService } from './services/versionUpdateService';
import { PackageInfo } from './types';

export function activate(context: vscode.ExtensionContext) {
    const npmRegistryService = new NpmRegistryService();
    const loadingNotificationService = new LoadingNotificationService();
    const versionUpdateService = new VersionUpdateService();

    const packageService = new PackageService(npmRegistryService, loadingNotificationService);
    const codeLensProviderService = new CodeLensProviderService(packageService, context);
    const codeLensService = new CodeLensService(codeLensProviderService, context);

    const versionUpdateCommandHandler = new VersionUpdateCommandHandler(
        versionUpdateService,
        codeLensProviderService,
        packageService
    );

    const browserService = new BrowserService();
    const checkerService = new CheckerService();
    const packageDetailsService = new PackageDetailsService();

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

    const openUpgradeHelperCommand = vscode.commands.registerCommand(
        COMMANDS.OPEN_UPGRADE_HELPER,
        (fromRNVersion: string, toRnVersion?: string) => openUpgradeHelper(browserService, fromRNVersion, toRnVersion)
    );

    versionUpdateCommandHandler.register(context);

    initializeCodeLens(codeLensService);

    const documentChangeListener = vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
        if (event.document.fileName.endsWith('package.json')) {
            packageService.clearCache();
            codeLensProviderService.refresh();
        }
    });

    const fileSystemWatcher = vscode.workspace.createFileSystemWatcher('**/package.json');
    const fileChangeListener = fileSystemWatcher.onDidChange((uri: vscode.Uri) => {
        if (uri.fsPath.endsWith('package.json')) {
            packageService.clearCache();
            codeLensProviderService.refresh();
        }
    });

    const fileCreateListener = fileSystemWatcher.onDidCreate((uri: vscode.Uri) => {
        if (uri.fsPath.endsWith('package.json')) {
            packageService.clearCache();
            codeLensProviderService.refresh();
        }
    });

    context.subscriptions.push(
        codeLensDisposable,
        enableCommand,
        disableCommand,
        detailsCommand,
        checkerCommand,
        refreshCommand,
        codeLensProviderService,
        loadingNotificationService,
        openUpgradeHelperCommand,
        documentChangeListener,
        fileSystemWatcher,
        fileChangeListener,
        fileCreateListener
    );
}

export function deactivate() {}
