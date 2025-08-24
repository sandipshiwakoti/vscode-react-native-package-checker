import * as vscode from 'vscode';

import {
    NewArchSupportStatus,
    PackageInfo,
    PackageInfoMap,
    PackageQuickPickItem,
    PackageStatus,
    STATUS_LABELS,
} from '../types';
import { extractDependenciesOnly } from '../utils/packageUtils';
import { extractPackageNameFromVersionString } from '../utils/versionUtils';

import { PackageDetailsService } from './packageDetailsService';
import { PackageFilterService } from './packageFilterService';
import { PackageService } from './packageService';

export class QuickPickService {
    constructor(
        private packageService: PackageService,
        private packageFilterService: PackageFilterService,
        private packageDetailsService: PackageDetailsService
    ) {}

    async showAllPackages(showBackButton: boolean = false): Promise<void> {
        const packages = await this.getPackagesFromActiveDocument();
        if (!packages || Object.keys(packages).length === 0) {
            vscode.window.showInformationMessage('No packages found. Please open a package.json file first.');
            return;
        }

        await this.showQuickPick(packages, 'Browse All Packages', showBackButton);
    }

    async showFilteredPackages(status: PackageStatus, showBackButton: boolean = false): Promise<void> {
        const allPackages = await this.getPackagesFromActiveDocument();
        if (!allPackages || Object.keys(allPackages).length === 0) {
            vscode.window.showInformationMessage('No packages found. Please open a package.json file first.');
            return;
        }

        const filteredPackages = this.packageFilterService.filterPackagesByStatus(allPackages, status);

        if (Object.keys(filteredPackages).length === 0) {
            const statusLabel = this.getStatusLabel(status);
            vscode.window.showInformationMessage(`No ${statusLabel.toLowerCase()} packages found.`);
            return;
        }

        const title = `Browse ${this.getStatusLabel(status)} Packages`;
        await this.showQuickPick(filteredPackages, title, showBackButton);
    }

    async showPackagesForTotalCount(): Promise<void> {
        await this.showAllPackages();
    }

    async showFilterSelection(): Promise<void> {
        const allPackages = await this.getPackagesFromActiveDocument();
        if (!allPackages || Object.keys(allPackages).length === 0) {
            vscode.window.showInformationMessage('No packages found. Please open a package.json file first.');
            return;
        }

        const statusCounts = this.packageFilterService.getStatusCounts(allPackages);
        const filterItems = this.createFilterQuickPickItems(statusCounts);

        const quickPick = vscode.window.createQuickPick();
        quickPick.title = 'Browse Packages by Filter';
        quickPick.placeholder = 'Select a filter to browse packages...';
        quickPick.items = filterItems;
        quickPick.canSelectMany = false;

        quickPick.onDidAccept(() => {
            const selectedItem = quickPick.selectedItems[0] as any;
            if (selectedItem && selectedItem.status) {
                quickPick.dispose();
                if (selectedItem.status === 'quick-actions') {
                    vscode.commands.executeCommand('reactNativePackageChecker.showQuickActionsWithBack');
                } else if (selectedItem.status === 'all') {
                    this.showAllPackages(true);
                } else {
                    this.showFilteredPackages(selectedItem.status, true);
                }
            }
        });

        quickPick.onDidHide(() => {
            quickPick.dispose();
        });

        quickPick.show();
    }

    createFilterQuickPickItems(statusCounts: Record<PackageStatus, number>): any[] {
        const items = [
            {
                label: `$(package) All Packages (${statusCounts.all})`,
                description: 'Browse all packages',
                status: 'all' as PackageStatus,
                count: statusCounts.all,
            },
            {
                label: `$(check) New Arch Supported (${statusCounts.supported})`,
                description: 'Packages that fully support the New Architecture',
                status: 'supported' as PackageStatus,
                count: statusCounts.supported,
            },
            {
                label: `$(check) New Arch Unsupported (${statusCounts.unsupported})`,
                description: 'Packages that do not support the New Architecture',
                status: 'unsupported' as PackageStatus,
                count: statusCounts.unsupported,
            },
            {
                label: `$(warning) New Arch Untested (${statusCounts.untested})`,
                description: 'Packages that have not been tested with the New Architecture',
                status: 'untested' as PackageStatus,
                count: statusCounts.untested,
            },
            {
                label: `$(question) Unlisted (${statusCounts.unlisted})`,
                description: 'Packages not found in the official React Native directory',
                status: 'unlisted' as PackageStatus,
                count: statusCounts.unlisted,
            },
            {
                label: `$(archive) Unmaintained (${statusCounts.unmaintained})`,
                description: 'Packages that are no longer maintained',
                status: 'unmaintained' as PackageStatus,
                count: statusCounts.unmaintained,
            },
            {
                label: `$(list-unordered) Quick Actions`,
                description: 'Access quick actions menu',
                status: 'quick-actions' as any,
                count: 1,
            },
        ];

        return items.filter((item) => item.status === 'quick-actions' || item.count > 0);
    }

    createQuickPickItems(packages: PackageInfoMap): PackageQuickPickItem[] {
        const items: PackageQuickPickItem[] = [];

        Object.entries(packages).forEach(([packageName, packageInfo]) => {
            const item: PackageQuickPickItem = {
                label: packageName,
                description: this.getPackageDescription(packageInfo),
                detail: this.getPackageDetail(packageInfo),
                packageName,
                packageInfo,
                status: packageInfo.newArchitecture || NewArchSupportStatus.Unlisted,
            };

            items.push(item);
        });

        items.sort((a, b) => a.packageName.localeCompare(b.packageName));

        return items;
    }

    setupQuickPickSearch(
        quickPick: vscode.QuickPick<PackageQuickPickItem>,
        allPackages: PackageInfoMap,
        showBackButton: boolean = false
    ): void {
        let searchTimeout: NodeJS.Timeout | undefined;

        quickPick.onDidChangeValue((searchTerm) => {
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }

            searchTimeout = setTimeout(() => {
                const filteredPackages = this.packageFilterService.searchPackages(allPackages, searchTerm);
                const filteredItems = this.createQuickPickItems(filteredPackages);

                if (showBackButton && !searchTerm.trim()) {
                    const backButton: PackageQuickPickItem = {
                        label: '$(arrow-left) Back to Filter Selection',
                        description: 'Return to the filter selection menu',
                        detail: '',
                        packageName: '__back__',
                        packageInfo: {} as PackageInfo,
                        status: NewArchSupportStatus.Unlisted,
                    };
                    quickPick.items = [backButton, ...filteredItems];
                } else {
                    quickPick.items = filteredItems;
                }
            }, 150);
        });
    }

    handlePackageSelection(item: PackageQuickPickItem): void {
        const activeEditor = vscode.window.activeTextEditor;
        const isPackageJsonOpen = activeEditor && activeEditor.document.fileName.endsWith('package.json');

        if (isPackageJsonOpen) {
            this.navigateToPackageInJson(item.packageName);
        }

        this.packageDetailsService.showPackageDetails(item.packageName, item.packageInfo);
    }

    private async showQuickPick(
        packages: PackageInfoMap,
        title: string,
        showBackButton: boolean = false
    ): Promise<void> {
        const quickPick = vscode.window.createQuickPick<PackageQuickPickItem>();

        try {
            quickPick.title = title;
            quickPick.placeholder = 'Search packages by name, version, or status...';
            quickPick.matchOnDescription = true;
            quickPick.matchOnDetail = true;
            quickPick.canSelectMany = false;

            const items = this.createQuickPickItems(packages);

            if (showBackButton) {
                const backButton: PackageQuickPickItem = {
                    label: '$(arrow-left) Back to Filter Selection',
                    description: 'Return to the filter selection menu',
                    detail: '',
                    packageName: '__back__',
                    packageInfo: {} as PackageInfo,
                    status: NewArchSupportStatus.Unlisted,
                };
                quickPick.items = [backButton, ...items];
            } else {
                quickPick.items = items;
            }

            this.setupQuickPickSearch(quickPick, packages, showBackButton);

            quickPick.onDidAccept(() => {
                const selectedItem = quickPick.selectedItems[0];
                if (selectedItem) {
                    if (selectedItem.packageName === '__back__') {
                        quickPick.dispose();
                        this.showFilterSelection();
                    } else {
                        this.handlePackageSelection(selectedItem);
                        quickPick.dispose();
                    }
                }
            });

            quickPick.onDidHide(() => {
                quickPick.dispose();
            });

            quickPick.show();
        } catch (error) {
            quickPick.dispose();
            vscode.window.showErrorMessage(`Failed to show package picker: ${error}`);
        }
    }

    private async getPackagesFromActiveDocument(): Promise<PackageInfoMap> {
        try {
            const activeEditor = vscode.window.activeTextEditor;

            if (activeEditor && activeEditor.document.fileName.endsWith('package.json')) {
                return await this.getPackagesFromDocument(activeEditor.document);
            }

            const packageJsonDocs = vscode.workspace.textDocuments.filter((doc) =>
                doc.fileName.endsWith('package.json')
            );

            if (packageJsonDocs.length > 0) {
                const document = packageJsonDocs[0];
                return await this.getPackagesFromDocument(document);
            }

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                const packageJsonUri = vscode.Uri.joinPath(workspaceFolders[0].uri, 'package.json');
                try {
                    const document = await vscode.workspace.openTextDocument(packageJsonUri);
                    return await this.getPackagesFromDocumentWithCachedData(document);
                } catch {
                    return {};
                }
            }

            return {};
        } catch (error) {
            console.error('Failed to get packages from active document:', error);
            return {};
        }
    }

    private async getPackagesFromDocument(document: vscode.TextDocument): Promise<PackageInfoMap> {
        try {
            const packageWithVersions = extractDependenciesOnly(document.getText());
            if (packageWithVersions.length === 0) {
                return {};
            }

            const cachedResults = this.packageService.getCachedResultsByVersions(packageWithVersions);

            const packageNames = packageWithVersions.map((pkg) => extractPackageNameFromVersionString(pkg));
            const cachedPackageNames = Object.keys(cachedResults);
            const hasAllCachedData = packageNames.every((name) => cachedPackageNames.includes(name));

            if (hasAllCachedData && Object.keys(cachedResults).length > 0) {
                return cachedResults;
            }

            const showLatestVersion = vscode.workspace
                .getConfiguration('reactNativePackageChecker')
                .get('showLatestVersion', true);

            return await this.packageService.checkPackages(
                packageWithVersions,
                undefined,
                showLatestVersion,
                document.getText()
            );
        } catch (error) {
            console.error('Failed to get packages from document:', error);
            return {};
        }
    }

    private async getPackagesFromDocumentWithCachedData(document: vscode.TextDocument): Promise<PackageInfoMap> {
        try {
            const packageWithVersions = extractDependenciesOnly(document.getText());
            if (packageWithVersions.length === 0) {
                return {};
            }

            const cachedResults = this.packageService.getCachedResultsByVersions(packageWithVersions);

            if (Object.keys(cachedResults).length > 0) {
                return cachedResults;
            }

            const showLatestVersion = vscode.workspace
                .getConfiguration('reactNativePackageChecker')
                .get('showLatestVersion', true);

            return await this.packageService.checkPackages(
                packageWithVersions,
                undefined,
                showLatestVersion,
                document.getText()
            );
        } catch (error) {
            console.error('Failed to get packages from document with cached data:', error);
            return {};
        }
    }

    private getPackageDescription(packageInfo: PackageInfo): string {
        if (packageInfo.currentVersion) {
            return `v${packageInfo.currentVersion}`;
        }
        if (packageInfo.latestVersion) {
            return `v${packageInfo.latestVersion} (latest)`;
        }
        return '';
    }

    private getPackageDetail(packageInfo: PackageInfo): string {
        const details: string[] = [];

        const statusLabel = this.getPackageStatusLabel(packageInfo);
        details.push(statusLabel);

        if (packageInfo.hasUpdate && packageInfo.latestVersion) {
            details.push(`Update available: v${packageInfo.latestVersion}`);
        }

        const isUnlisted =
            packageInfo.newArchitecture === NewArchSupportStatus.Unlisted || !packageInfo.newArchitecture;

        if (packageInfo.error && !isUnlisted) {
            details.push(`Error: ${packageInfo.error}`);
        }

        if (packageInfo.versionFetchError && !isUnlisted) {
            details.push(`Version error: ${packageInfo.versionFetchError}`);
        }

        return details.join(' • ');
    }

    private getPackageStatusLabel(packageInfo: PackageInfo): string {
        if (packageInfo.unmaintained) {
            return 'Unmaintained';
        }

        switch (packageInfo.newArchitecture) {
            case NewArchSupportStatus.Supported:
                return STATUS_LABELS.SUPPORTED;
            case NewArchSupportStatus.Unsupported:
                return STATUS_LABELS.UNSUPPORTED;
            case NewArchSupportStatus.Untested:
                return STATUS_LABELS.UNTESTED;
            case NewArchSupportStatus.Unlisted:
            default:
                return STATUS_LABELS.UNLISTED;
        }
    }

    private getStatusLabel(status: PackageStatus): string {
        switch (status) {
            case 'supported':
                return 'New Arch Supported';
            case 'unsupported':
                return 'New Arch Unsupported';
            case 'untested':
                return 'New Arch Untested';
            case 'unlisted':
                return 'Unlisted';
            case 'unmaintained':
                return 'Unmaintained';
            case 'all':
            default:
                return 'All';
        }
    }

    private async navigateToPackageInJson(packageName: string): Promise<void> {
        try {
            const activeEditor = vscode.window.activeTextEditor;

            if (!activeEditor || !activeEditor.document.fileName.endsWith('package.json')) {
                return;
            }

            const packageJsonDoc = activeEditor.document;
            const lineNumber = this.findPackageLineNumber(packageJsonDoc.getText(), packageName);
            if (lineNumber === -1) {
                return;
            }

            const position = new vscode.Position(lineNumber, 0);
            const range = new vscode.Range(
                position,
                position.with(undefined, packageJsonDoc.lineAt(lineNumber).text.length)
            );

            activeEditor.selection = new vscode.Selection(position, range.end);
            activeEditor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        } catch (error) {
            console.error('Failed to navigate to package in package.json:', error);
        }
    }

    private async findPackageJsonDocument(): Promise<vscode.TextDocument | undefined> {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.fileName.endsWith('package.json')) {
            return activeEditor.document;
        }

        const packageJsonDocs = vscode.workspace.textDocuments.filter((doc) => doc.fileName.endsWith('package.json'));

        if (packageJsonDocs.length > 0) {
            return packageJsonDocs[0];
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const packageJsonUri = vscode.Uri.joinPath(workspaceFolders[0].uri, 'package.json');
            try {
                return await vscode.workspace.openTextDocument(packageJsonUri);
            } catch {
                return undefined;
            }
        }

        return undefined;
    }

    private findPackageLineNumber(content: string, packageName: string): number {
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const packageRegex = new RegExp(`^\\s*"${packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:`);
            if (packageRegex.test(line)) {
                return i;
            }
        }

        return -1;
    }
}
