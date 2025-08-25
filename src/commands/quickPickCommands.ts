import * as vscode from 'vscode';

import { DependencyCheckService } from '../services/dependencyCheckService';
import { QuickPickService } from '../services/quickPickService';
import { COMMANDS } from '../types';

export async function browseAllPackagesCommand(quickPickService: QuickPickService): Promise<void> {
    await quickPickService.showAllPackages();
}

export async function showSupportedPackagesCommand(quickPickService: QuickPickService): Promise<void> {
    await quickPickService.showFilteredPackages('supported');
}

export async function showUntestedPackagesCommand(quickPickService: QuickPickService): Promise<void> {
    await quickPickService.showFilteredPackages('untested');
}

export async function showUnlistedPackagesCommand(quickPickService: QuickPickService): Promise<void> {
    await quickPickService.showFilteredPackages('unlisted');
}

export async function showUnsupportedPackagesCommand(quickPickService: QuickPickService): Promise<void> {
    await quickPickService.showFilteredPackages('unsupported');
}

export async function showUnmaintainedPackagesCommand(quickPickService: QuickPickService): Promise<void> {
    await quickPickService.showFilteredPackages('unmaintained');
}

export async function browsePackagesCommand(quickPickService: QuickPickService): Promise<void> {
    await quickPickService.showFilterSelection();
}

export async function showQuickActionsWithBackCommand(dependencyCheckService: DependencyCheckService): Promise<void> {
    return showQuickActionsCommand(dependencyCheckService, true);
}

export async function showQuickActionsCommand(
    dependencyCheckService: DependencyCheckService,
    showBackButton: boolean = false
): Promise<void> {
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
                label: '$(edit-sparkle) Update Checked Dependencies',
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
        label: '$(edit-sparkle) Bulk Update Dependencies',
        description: 'Update dependencies to a React Native version',
        detail: 'Analyze and update packages for any React Native version',
    });

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

            if (selectedItem.label.includes('Back to Filter Selection')) {
                await vscode.commands.executeCommand(COMMANDS.BROWSE_PACKAGES);
            } else if (selectedItem.label.includes('Reset Dependency Check')) {
                await vscode.commands.executeCommand('reactNativePackageChecker.disableDependencyCheck');
            } else if (selectedItem.label.includes('Check Dependency Version')) {
                await vscode.commands.executeCommand('reactNativePackageChecker.enableDependencyCheck');
            } else if (selectedItem.label.includes('Update Checked Dependencies')) {
                await vscode.commands.executeCommand(COMMANDS.BULK_UPDATE_TO_EXPECTED_VERSIONS);
            } else if (selectedItem.label.includes('Bulk Update Dependencies')) {
                await vscode.commands.executeCommand(COMMANDS.PERFORM_BULK_UPDATE);
            } else if (selectedItem.label.includes('Refresh Package Data')) {
                await vscode.commands.executeCommand(COMMANDS.REFRESH_PACKAGES);
            } else if (selectedItem.label.includes('Open Package Checker Website')) {
                await vscode.commands.executeCommand(COMMANDS.OPEN_PACKAGE_CHECKER_WEBSITE);
            } else if (selectedItem.label.includes('Open Upgrade Helper Website')) {
                await vscode.commands.executeCommand(COMMANDS.OPEN_UPGRADE_HELPER);
            }
        }
    });

    quickPick.onDidHide(() => {
        quickPick.dispose();
    });

    quickPick.show();
}
