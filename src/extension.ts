import * as vscode from 'vscode';

import { disableCodeLens, enableCodeLens, initializeCodeLens } from './commands/codeLensCommand';
import { openPackageCheckerWebsite } from './commands/openPackageCheckerWebsiteCommand';
import { openUpgradeHelper } from './commands/openUpgradeHelper';
import { refreshPackages } from './commands/refreshPackagesCommand';
import { showPackageDetails } from './commands/showPackageDetailsCommand';
import { COMMANDS, EXTENSION_CONFIG } from './constants/index';
import { BrowserService } from './services/browserService';
import { CacheManagerService } from './services/cacheManagerService';
import { CodeLensProviderService } from './services/codeLensProviderService';
import { CodeLensService } from './services/codeLensService';
import { DebouncedChangeHandler } from './services/debouncedChangeHandler';
import { FileChangeAnalyzer } from './services/fileChangeAnalyzer';
import { LoadingNotificationService } from './services/loadingNotificationService';
import { LoggerService } from './services/loggerService';
import { NpmRegistryService } from './services/npmRegistryService';
import { PackageDetailsService } from './services/packageDetailsService';
import { PackageService } from './services/packageService';
import { VersionUpdateCommandHandler } from './services/versionUpdateCommandHandler';
import { VersionUpdateService } from './services/versionUpdateService';
import { PackageInfo } from './types';

const documentContentCache = new Map<string, string>();

export function activate(context: vscode.ExtensionContext) {
    const logger = new LoggerService();
    const cacheManager = new CacheManagerService();
    const npmRegistryService = new NpmRegistryService();
    const loadingNotificationService = new LoadingNotificationService();
    const versionUpdateService = new VersionUpdateService();

    const packageService = new PackageService(npmRegistryService, loadingNotificationService, cacheManager, logger);

    const codeLensProviderService = new CodeLensProviderService(packageService, context);
    const codeLensService = new CodeLensService(codeLensProviderService, context);

    const fileChangeAnalyzer = new FileChangeAnalyzer(logger);
    const debouncedChangeHandler = new DebouncedChangeHandler(packageService, fileChangeAnalyzer, logger, () =>
        codeLensProviderService.refresh()
    );

    const versionUpdateCommandHandler = new VersionUpdateCommandHandler(
        versionUpdateService,
        codeLensProviderService,
        packageService
    );

    const browserService = new BrowserService();
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

    const checkerCommand = vscode.commands.registerCommand(COMMANDS.OPEN_PACKAGE_CHECKER_WEBSITE, () =>
        openPackageCheckerWebsite(browserService)
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
            const filePath = event.document.fileName;
            const oldContent = documentContentCache.get(filePath) || '';
            const newContent = event.document.getText();

            if (oldContent !== newContent) {
                documentContentCache.set(filePath, newContent);

                debouncedChangeHandler.handleFileChange(event.document, oldContent);
            }
        }
    });

    const documentOpenListener = vscode.workspace.onDidOpenTextDocument((document: vscode.TextDocument) => {
        if (document.fileName.endsWith('package.json')) {
            documentContentCache.set(document.fileName, document.getText());
        }
    });

    const documentCloseListener = vscode.workspace.onDidCloseTextDocument((document: vscode.TextDocument) => {
        if (document.fileName.endsWith('package.json')) {
            documentContentCache.delete(document.fileName);
        }
    });

    const documentSaveListener = vscode.workspace.onDidSaveTextDocument(async (document: vscode.TextDocument) => {
        if (document.fileName.endsWith('package.json')) {
            const filePath = document.fileName;
            const oldContent = documentContentCache.get(filePath) || '';
            const currentContent = document.getText();

            if (oldContent !== currentContent) {
                const changes = fileChangeAnalyzer.analyzePackageJsonChanges(oldContent, currentContent);

                if (changes.length > 0) {
                    await packageService.handlePackageChanges(changes, currentContent);
                    codeLensProviderService.refresh();
                }
            }

            documentContentCache.set(filePath, currentContent);
        }
    });

    const fileSystemWatcher = vscode.workspace.createFileSystemWatcher('**/package.json');

    const fileChangeListener = fileSystemWatcher.onDidChange((uri: vscode.Uri) => {
        debouncedChangeHandler.handleFileSystemChange(uri);
    });

    const fileCreateListener = fileSystemWatcher.onDidCreate((uri: vscode.Uri) => {
        debouncedChangeHandler.handleFileSystemChange(uri);
    });

    const fileDeleteListener = fileSystemWatcher.onDidDelete((uri: vscode.Uri) => {
        if (uri.fsPath.endsWith('package.json')) {
            logger.info(`Package.json deleted: ${uri.fsPath}`);
            documentContentCache.delete(uri.fsPath);
            packageService.clearCache();
            codeLensProviderService.refresh();
        }
    });

    vscode.workspace.textDocuments.forEach((document) => {
        if (document.fileName.endsWith('package.json')) {
            documentContentCache.set(document.fileName, document.getText());
        }
    });

    const showCacheStatsCommand = vscode.commands.registerCommand('reactNativePackageChecker.showCacheStats', () => {
        const stats = packageService.getCacheStats();
        logger.info('Cache Statistics', stats);
        vscode.window.showInformationMessage(
            `Cache: ${stats.packageCount} packages, ${stats.versionCount} versions, ${stats.expiredCount} expired`
        );
    });

    const showLogsCommand = vscode.commands.registerCommand('reactNativePackageChecker.showLogs', () => {
        logger.show();
    });

    context.subscriptions.push(
        codeLensDisposable,
        enableCommand,
        disableCommand,
        detailsCommand,
        checkerCommand,
        refreshCommand,
        openUpgradeHelperCommand,
        showCacheStatsCommand,
        showLogsCommand,
        codeLensProviderService,
        loadingNotificationService,
        logger,
        debouncedChangeHandler,
        documentChangeListener,
        documentOpenListener,
        documentCloseListener,
        documentSaveListener,
        fileSystemWatcher,
        fileChangeListener,
        fileCreateListener,
        fileDeleteListener
    );

    logger.info('React Native Package Checker activated');
}

export function deactivate() {
    documentContentCache.clear();
}
