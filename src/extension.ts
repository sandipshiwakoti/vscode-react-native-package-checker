import * as vscode from 'vscode';

import { EXTENSION_CONFIG } from './constants/index';
import { BrowserService } from './services/browserService';
import { CacheManagerService } from './services/cacheManagerService';
import { CodeLensProviderService } from './services/codeLensProviderService';
import { DebouncedChangeService } from './services/debouncedChangeService';
import { FileChangeService } from './services/fileChangeService';
import { LoadingNotificationService } from './services/loadingNotificationService';
import { LoggerService } from './services/loggerService';
import { NpmRegistryService } from './services/npmRegistryService';
import { PackageDetailsService } from './services/packageDetailsService';
import { PackageService } from './services/packageService';
import { VersionUpdateService } from './services/versionUpdateService';
import { openPackageCheckerWebsite, openUpgradeHelper, refreshPackages, showPackageDetails } from './commands';
import { COMMANDS, FileExtensions } from './types';
import { PackageInfo } from './types';

const documentContentCache = new Map<string, string>();

export function activate(context: vscode.ExtensionContext) {
    const logger = new LoggerService();
    const cacheManager = new CacheManagerService();
    const npmRegistryService = new NpmRegistryService();
    const loadingNotificationService = new LoadingNotificationService();
    const packageService = new PackageService(npmRegistryService, loadingNotificationService, cacheManager, logger);

    const codeLensProviderService = new CodeLensProviderService(packageService, context);
    const versionUpdateService = new VersionUpdateService(codeLensProviderService, packageService);

    const fileChangeService = new FileChangeService(logger);
    const debouncedChangeService = new DebouncedChangeService(packageService, fileChangeService, logger, () =>
        codeLensProviderService.refresh()
    );

    const browserService = new BrowserService();
    const packageDetailsService = new PackageDetailsService();

    const codeLensDisposable = vscode.languages.registerCodeLensProvider(
        { language: EXTENSION_CONFIG.LANGUAGE_JSON, pattern: EXTENSION_CONFIG.PACKAGE_JSON_PATTERN },
        codeLensProviderService
    );

    const enableCommand = vscode.commands.registerCommand(COMMANDS.ENABLE_CODE_LENS, () =>
        codeLensProviderService.enable()
    );

    const disableCommand = vscode.commands.registerCommand(COMMANDS.DISABLE_CODE_LENS, () =>
        codeLensProviderService.disable()
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
        refreshPackages(codeLensProviderService)
    );

    const openUpgradeHelperCommand = vscode.commands.registerCommand(
        COMMANDS.OPEN_UPGRADE_HELPER,
        (fromRNVersion?: string, toRnVersion?: string) => {
            const readFromPackageJson = !fromRNVersion;
            return openUpgradeHelper(browserService, fromRNVersion, toRnVersion, readFromPackageJson);
        }
    );

    versionUpdateService.register(context);

    codeLensProviderService.initialize();

    const documentChangeListener = vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
        if (event.document.fileName.endsWith(FileExtensions.PACKAGE_JSON)) {
            const filePath = event.document.fileName;
            const oldContent = documentContentCache.get(filePath) || '';
            const newContent = event.document.getText();

            if (oldContent !== newContent) {
                documentContentCache.set(filePath, newContent);

                debouncedChangeService.handleFileChange(event.document, oldContent);
            }
        }
    });

    const documentOpenListener = vscode.workspace.onDidOpenTextDocument((document: vscode.TextDocument) => {
        if (document.fileName.endsWith(FileExtensions.PACKAGE_JSON)) {
            documentContentCache.set(document.fileName, document.getText());
        }
    });

    const documentCloseListener = vscode.workspace.onDidCloseTextDocument((document: vscode.TextDocument) => {
        if (document.fileName.endsWith(FileExtensions.PACKAGE_JSON)) {
            documentContentCache.delete(document.fileName);
        }
    });

    const documentSaveListener = vscode.workspace.onDidSaveTextDocument(async (document: vscode.TextDocument) => {
        if (document.fileName.endsWith(FileExtensions.PACKAGE_JSON)) {
            const filePath = document.fileName;
            const oldContent = documentContentCache.get(filePath) || '';
            const currentContent = document.getText();

            if (oldContent !== currentContent) {
                const changes = fileChangeService.analyzePackageJsonChanges(oldContent, currentContent);

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
        debouncedChangeService.handleFileSystemChange(uri);
    });

    const fileCreateListener = fileSystemWatcher.onDidCreate((uri: vscode.Uri) => {
        debouncedChangeService.handleFileSystemChange(uri);
    });

    const fileDeleteListener = fileSystemWatcher.onDidDelete((uri: vscode.Uri) => {
        if (uri.fsPath.endsWith(FileExtensions.PACKAGE_JSON)) {
            logger.info(`Package.json deleted: ${uri.fsPath}`);
            documentContentCache.delete(uri.fsPath);
            packageService.clearCache();
            codeLensProviderService.refresh();
        }
    });

    vscode.workspace.textDocuments.forEach((document) => {
        if (document.fileName.endsWith(FileExtensions.PACKAGE_JSON)) {
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

    const showLogsCommand = vscode.commands.registerCommand(COMMANDS.SHOW_LOGS, () => {
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
        debouncedChangeService,
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
