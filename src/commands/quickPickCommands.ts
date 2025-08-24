import * as vscode from 'vscode';

import { DependencyCheckService } from '../services/dependencyCheckService';
import { LoggerService } from '../services/loggerService';
import { QuickPickService } from '../services/quickPickService';
import { COMMANDS, PackageStatus } from '../types';

async function executeCommand<T extends any[]>(
    commandName: string,
    logger: LoggerService,
    operation: (...args: T) => Promise<void>,
    ...args: T
): Promise<void> {
    try {
        await operation(...args);
        logger.info(`${commandName} command executed`);
    } catch (error) {
        logger.error(`Failed to execute ${commandName} command`, { error });
        vscode.window.showErrorMessage(`Failed to ${commandName.toLowerCase()}. Please try again.`);
    }
}

export async function browseAllPackagesCommand(
    quickPickService: QuickPickService,
    logger: LoggerService
): Promise<void> {
    return executeCommand('Browse all packages', logger, () => quickPickService.showAllPackages());
}

export async function showSupportedPackagesCommand(
    quickPickService: QuickPickService,
    logger: LoggerService
): Promise<void> {
    return executeCommand(
        'Show supported packages',
        logger,
        (status: PackageStatus) => quickPickService.showFilteredPackages(status),
        'supported'
    );
}

export async function showUntestedPackagesCommand(
    quickPickService: QuickPickService,
    logger: LoggerService
): Promise<void> {
    return executeCommand(
        'Show untested packages',
        logger,
        (status: PackageStatus) => quickPickService.showFilteredPackages(status),
        'untested'
    );
}

export async function showUnlistedPackagesCommand(
    quickPickService: QuickPickService,
    logger: LoggerService
): Promise<void> {
    return executeCommand(
        'Show unlisted packages',
        logger,
        (status: PackageStatus) => quickPickService.showFilteredPackages(status),
        'unlisted'
    );
}

export async function showUnsupportedPackagesCommand(
    quickPickService: QuickPickService,
    logger: LoggerService
): Promise<void> {
    return executeCommand(
        'Show unsupported packages',
        logger,
        (status: PackageStatus) => quickPickService.showFilteredPackages(status),
        'unsupported'
    );
}

export async function showUnmaintainedPackagesCommand(
    quickPickService: QuickPickService,
    logger: LoggerService
): Promise<void> {
    return executeCommand(
        'Show unmaintained packages',
        logger,
        (status: PackageStatus) => quickPickService.showFilteredPackages(status),
        'unmaintained'
    );
}

export async function browsePackagesCommand(quickPickService: QuickPickService, logger: LoggerService): Promise<void> {
    return executeCommand('Browse packages', logger, () => quickPickService.showFilterSelection());
}

export async function showQuickActionsWithBackCommand(
    dependencyCheckService: DependencyCheckService,
    logger: LoggerService
): Promise<void> {
    return showQuickActionsCommand(dependencyCheckService, logger, true);
}

export async function showQuickActionsCommand(
    dependencyCheckService: DependencyCheckService,
    logger: LoggerService,
    showBackButton: boolean = false
): Promise<void> {
    try {
        const quickPick = vscode.window.createQuickPick();
        quickPick.title = 'Quick Actions';
        quickPick.placeholder = 'Select an action to perform';

        const items: vscode.QuickPickItem[] = [];

        if (showBackButton) {
            items.push({
                label: '$(arrow-left) Back to Filter Selection',
                description: 'Return to the filter selection menu',
                detail: '',
            });
        }

        if (dependencyCheckService.isEnabled()) {
            items.push({
                label: '$(refresh) Reset Dependency Check',
                description: 'Disable dependency checking or check for a different React Native version',
                detail: `Currently checking for React Native ${dependencyCheckService.getTargetVersion()}`,
            });

            const validationResults = dependencyCheckService.getCurrentResults();
            if (validationResults.length > 0) {
                items.push({
                    label: '$(edit-sparkle) Bulk Update Dependencies',
                    description: `Update all ${validationResults.length} mismatched dependencies to expected versions`,
                    detail: `Update packages to React Native ${dependencyCheckService.getTargetVersion()} expected versions`,
                });
            }
        } else {
            items.push({
                label: '$(gear) Check Dependency Version',
                description: 'Check if dependencies match expected versions for a React Native version',
                detail: 'Enable dependency version validation',
            });
        }

        items.push({
            label: '$(refresh) Refresh Package Data',
            description: 'Refresh all package information from the registry',
            detail: 'Update package status and version information',
        });

        items.push({
            label: '$(link-external) Open Package Checker Website',
            description: 'Visit the React Native Package Checker website',
            detail: 'Browse the full package directory online',
        });

        items.push({
            label: '$(link-external) Open Upgrade Helper Website',
            description: 'Visit the React Native Upgrade Helper website',
            detail: 'Get help upgrading React Native versions',
        });

        quickPick.items = items;

        quickPick.onDidChangeSelection(async (selection) => {
            if (selection.length > 0) {
                const selectedItem = selection[0];
                quickPick.hide();

                try {
                    if (selectedItem.label.includes('Back to Filter Selection')) {
                        await vscode.commands.executeCommand(COMMANDS.BROWSE_PACKAGES);
                    } else if (selectedItem.label.includes('Reset Dependency Check')) {
                        await vscode.commands.executeCommand('reactNativePackageChecker.disableDependencyCheck');
                    } else if (selectedItem.label.includes('Check Dependency Version')) {
                        await vscode.commands.executeCommand('reactNativePackageChecker.enableDependencyCheck');
                    } else if (selectedItem.label.includes('Bulk Update Dependencies')) {
                        await vscode.commands.executeCommand(COMMANDS.BULK_UPDATE_TO_EXPECTED_VERSIONS);
                    } else if (selectedItem.label.includes('Refresh Package Data')) {
                        await vscode.commands.executeCommand(COMMANDS.REFRESH_PACKAGES);
                    } else if (selectedItem.label.includes('Open Package Checker Website')) {
                        await vscode.commands.executeCommand(COMMANDS.OPEN_PACKAGE_CHECKER_WEBSITE);
                    } else if (selectedItem.label.includes('Open Upgrade Helper Website')) {
                        await vscode.commands.executeCommand(COMMANDS.OPEN_UPGRADE_HELPER);
                    }
                } catch (error) {
                    logger.error('Failed to execute quick action', { action: selectedItem.label, error });
                    vscode.window.showErrorMessage(`Failed to execute action: ${selectedItem.label}`);
                }
            }
        });

        quickPick.onDidHide(() => {
            quickPick.dispose();
        });

        quickPick.show();
        logger.info('Quick actions menu displayed');
    } catch (error) {
        logger.error('Failed to show quick actions menu', { error });
        vscode.window.showErrorMessage('Failed to show quick actions menu. Please try again.');
    }
}
