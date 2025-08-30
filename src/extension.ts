import * as vscode from 'vscode';

import {
    browseAllPackagesCommand,
    browsePackagesCommand,
    showQuickActionsCommand,
    showQuickActionsWithBackCommand,
    showSupportedPackagesCommand,
    showUnlistedPackagesCommand,
    showUnmaintainedPackagesCommand,
    showUnsupportedPackagesCommand,
    showUntestedPackagesCommand,
} from './commands/quickPickCommands';
import {
    addPackage,
    applyRequirements,
    disableRequirements,
    enableRequirements,
    removePackage,
    updateToRequiredVersion,
} from './commands/requirementsCommands';
import { EXTENSION_CONFIG } from './constants/index';
import { ApplyRequirementsService } from './services/applyRequirementsService';
import { BrowserService } from './services/browserService';
import { CacheManagerService } from './services/cacheManagerService';
import { CodeLensProviderService } from './services/codeLensProviderService';
import { DebouncedChangeService } from './services/debouncedChangeService';
import { FileChangeService } from './services/fileChangeService';
import { LoggerService } from './services/loggerService';
import { NpmRegistryService } from './services/npmRegistryService';
import { PackageDecorationService } from './services/packageDecorationService';
import { PackageDetailsService } from './services/packageDetailsService';
import { PackageFilterService } from './services/packageFilterService';
import { PackageService } from './services/packageService';
import { QuickPickService } from './services/quickPickService';
import { RequirementsService } from './services/requirementsService';
import { VersionUpdateService } from './services/versionUpdateService';
import { extractPackageNames } from './utils/packageUtils';
import { openPackageCheckerWebsite, openUpgradeHelper, refreshPackages, showPackageDetails } from './commands';
import { COMMANDS, FileExtensions } from './types';
import { PackageInfo } from './types';

const documentContentCache = new Map<string, string>();

export async function activate(context: vscode.ExtensionContext) {
    const logger = new LoggerService();

    const cacheManager = new CacheManagerService(logger);

    const npmRegistryService = new NpmRegistryService(logger);
    const packageService = new PackageService(npmRegistryService, cacheManager, logger);

    const requirementsService = new RequirementsService(context, logger, cacheManager);
    await requirementsService.initialize();

    const packageDecorationService = new PackageDecorationService(context);

    const codeLensProviderService = new CodeLensProviderService(
        packageService,
        requirementsService,
        packageDecorationService
    );
    const versionUpdateService = new VersionUpdateService(codeLensProviderService, packageService);

    const fileChangeService = new FileChangeService(logger);
    const debouncedChangeService = new DebouncedChangeService(packageService, fileChangeService, logger, () => {
        codeLensProviderService.refresh();
        if (requirementsService.isEnabled()) {
            requirementsService.refresh();
        }
    });

    const browserService = new BrowserService();
    const packageDetailsService = new PackageDetailsService();

    const packageFilterService = new PackageFilterService();
    const quickPickService = new QuickPickService(packageService, packageFilterService, packageDetailsService);
    const applyRequirementsService = new ApplyRequirementsService(cacheManager);

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
    await codeLensProviderService.initialize();

    const updateRequirementsContext = () => {
        vscode.commands.executeCommand(
            'setContext',
            'reactNativePackageChecker.requirementsEnabled',
            requirementsService.isEnabled()
        );
    };

    updateRequirementsContext();

    requirementsService.onResultsChanged(() => {
        updateRequirementsContext();
        codeLensProviderService.refresh();
    });

    const documentChangeListener = vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
        if (event.document.fileName.endsWith(FileExtensions.PACKAGE_JSON)) {
            const filePath = event.document.fileName;
            const oldContent = documentContentCache.get(filePath) || '';
            const newContent = event.document.getText();

            if (oldContent !== newContent) {
                documentContentCache.set(filePath, newContent);
                debouncedChangeService.handleFileChange(event.document, oldContent);

                if (requirementsService.isEnabled()) {
                    requirementsService.refresh();
                }
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

    const activeEditorChangeListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && editor.document.fileName.endsWith(FileExtensions.PACKAGE_JSON)) {
            const packageWithVersions = extractPackageNames(editor.document.getText());
            const cachedPackageInfos = packageService.getCachedResultsByVersions(packageWithVersions);
            if (Object.keys(cachedPackageInfos).length > 0) {
                packageDecorationService.updateDecorations(cachedPackageInfos);
            }
        }
    });

    const configurationChangeListener = vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('reactNativePackageChecker.showStatusDecorations')) {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && activeEditor.document.fileName.endsWith(FileExtensions.PACKAGE_JSON)) {
                const packageWithVersions = extractPackageNames(activeEditor.document.getText());
                const cachedPackageInfos = packageService.getCachedResultsByVersions(packageWithVersions);
                if (Object.keys(cachedPackageInfos).length > 0) {
                    packageDecorationService.updateDecorations(cachedPackageInfos);
                }
            }
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

    const showRequirementsCommand = vscode.commands.registerCommand(COMMANDS.SHOW_REQUIREMENTS, () =>
        enableRequirements(requirementsService)
    );

    const hideRequirementsCommand = vscode.commands.registerCommand(COMMANDS.HIDE_REQUIREMENTS, () =>
        disableRequirements(requirementsService)
    );

    const updateToRequiredVersionCommand = vscode.commands.registerCommand(
        COMMANDS.UPDATE_TO_REQUIRED_VERSION,
        (packageName: string, requiredVersion: string) =>
            updateToRequiredVersion(packageName, requiredVersion, requirementsService)
    );

    const addPackageCommand = vscode.commands.registerCommand(
        COMMANDS.ADD_PACKAGE,
        (packageName: string, version: string, dependencyType?: 'dependencies' | 'devDependencies') =>
            addPackage(packageName, version, dependencyType, requirementsService)
    );

    const removePackageCommand = vscode.commands.registerCommand(COMMANDS.REMOVE_PACKAGE, (packageName: string) =>
        removePackage(packageName, requirementsService)
    );

    const browseAllPackagesCommandDisposable = vscode.commands.registerCommand(
        'reactNativePackageChecker.browseAllPackages',
        () => browseAllPackagesCommand(quickPickService)
    );

    const showSupportedPackagesCommandDisposable = vscode.commands.registerCommand(
        'reactNativePackageChecker.showSupportedPackages',
        () => showSupportedPackagesCommand(quickPickService)
    );

    const showUnsupportedPackagesCommandDisposable = vscode.commands.registerCommand(
        'reactNativePackageChecker.showUnsupportedPackages',
        () => showUnsupportedPackagesCommand(quickPickService)
    );

    const showUntestedPackagesCommandDisposable = vscode.commands.registerCommand(
        'reactNativePackageChecker.showUntestedPackages',
        () => showUntestedPackagesCommand(quickPickService)
    );

    const showUnlistedPackagesCommandDisposable = vscode.commands.registerCommand(
        'reactNativePackageChecker.showUnlistedPackages',
        () => showUnlistedPackagesCommand(quickPickService)
    );

    const showUnmaintainedPackagesCommandDisposable = vscode.commands.registerCommand(
        'reactNativePackageChecker.showUnmaintainedPackages',
        () => showUnmaintainedPackagesCommand(quickPickService)
    );

    const browsePackagesCommandDisposable = vscode.commands.registerCommand(COMMANDS.BROWSE_PACKAGES, () =>
        browsePackagesCommand(quickPickService)
    );

    const showQuickActionsCommandDisposable = vscode.commands.registerCommand(COMMANDS.SHOW_QUICK_ACTIONS, () =>
        showQuickActionsCommand(requirementsService)
    );

    const showQuickActionsWithBackCommandDisposable = vscode.commands.registerCommand(
        COMMANDS.SHOW_QUICK_ACTIONS_WITH_BACK,
        () => showQuickActionsWithBackCommand(requirementsService)
    );

    const toggleStatusDecorationsCommand = vscode.commands.registerCommand(COMMANDS.TOGGLE_STATUS_DECORATIONS, () =>
        packageDecorationService.toggleDecorations()
    );

    const applyRequirementsCommand = vscode.commands.registerCommand(COMMANDS.APPLY_REQUIREMENTS, () =>
        applyRequirements(applyRequirementsService)
    );

    const toggleCodeLensAnalyzingCommand = vscode.commands.registerCommand(
        'reactNativePackageChecker.toggleCodeLensAnalyzing',
        () => {
            // This command is disabled and does nothing - it's just for the UI state
        }
    );

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
        logger,
        debouncedChangeService,
        documentChangeListener,
        documentOpenListener,
        documentCloseListener,
        documentSaveListener,
        fileSystemWatcher,
        fileChangeListener,
        fileCreateListener,
        fileDeleteListener,
        requirementsService,
        showRequirementsCommand,
        hideRequirementsCommand,
        updateToRequiredVersionCommand,
        addPackageCommand,
        removePackageCommand,
        browseAllPackagesCommandDisposable,
        showSupportedPackagesCommandDisposable,
        showUnsupportedPackagesCommandDisposable,
        showUntestedPackagesCommandDisposable,
        showUnlistedPackagesCommandDisposable,
        showUnmaintainedPackagesCommandDisposable,
        browsePackagesCommandDisposable,
        showQuickActionsCommandDisposable,
        showQuickActionsWithBackCommandDisposable,
        toggleStatusDecorationsCommand,
        applyRequirementsCommand,
        toggleCodeLensAnalyzingCommand,
        packageDecorationService,
        activeEditorChangeListener,
        configurationChangeListener
    );

    logger.info('React Native Package Checker activated');
}

export function deactivate() {
    documentContentCache.clear();
}
