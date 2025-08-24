import * as vscode from 'vscode';

import { DEPENDENCY_CHECK_CONFIG, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants';
import { DiffData, ValidationResult } from '../types';
import {
    createHoverMessage,
    extractCurrentRnVersion,
    hasVersionDifference,
    parseDiff,
} from '../utils/dependencyCheckUtils';
import { parsePackageJson, removePackageFromJson, updatePackageJsonSection } from '../utils/packageUtils';
import { cleanVersion, compareVersions } from '../utils/versionUtils';

import { LoggerService } from './loggerService';

export class DependencyCheckService {
    private _onResultsChanged: vscode.EventEmitter<ValidationResult[]> = new vscode.EventEmitter<ValidationResult[]>();
    public readonly onResultsChanged: vscode.Event<ValidationResult[]> = this._onResultsChanged.event;

    private enabled = false;
    private targetVersion: string | null = null;
    private decorations: vscode.TextEditorDecorationType;
    private cache = new Map<string, DiffData>();

    private currentResults: ValidationResult[] = [];

    constructor(
        private context: vscode.ExtensionContext,
        private logger: LoggerService
    ) {
        this.decorations = vscode.window.createTextEditorDecorationType({
            after: {
                color: new vscode.ThemeColor('errorForeground'),
                fontStyle: 'italic',
            },
        });
    }

    async enable(): Promise<void> {
        try {
            const version = await this.promptForTargetVersion();
            if (!version) {
                return;
            }

            this.targetVersion = version;
            this.enabled = true;

            await this.context.globalState.update(DEPENDENCY_CHECK_CONFIG.STATE_KEYS.ENABLED, true);
            await this.context.globalState.update(DEPENDENCY_CHECK_CONFIG.STATE_KEYS.TARGET_VERSION, version);

            vscode.window.showInformationMessage(SUCCESS_MESSAGES.DEPENDENCY_CHECK_ENABLED(version));
            await this.refresh();
        } catch {
            vscode.window.showErrorMessage('Failed to enable dependency check');
        }
    }

    async disable(): Promise<void> {
        this.enabled = false;
        this.targetVersion = null;

        await this.context.globalState.update(DEPENDENCY_CHECK_CONFIG.STATE_KEYS.ENABLED, false);
        this.clearDecorations();
        this._onResultsChanged.fire([]);

        vscode.window.showInformationMessage(SUCCESS_MESSAGES.DEPENDENCY_CHECK_DISABLED);
    }

    async toggle(): Promise<void> {
        if (this.enabled) {
            await this.disable();
        } else {
            await this.enable();
        }
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    getTargetVersion(): string | null {
        return this.targetVersion;
    }

    getCurrentResults(): ValidationResult[] {
        return this.currentResults;
    }

    async refresh(): Promise<void> {
        if (!this.enabled || !this.targetVersion) {
            this._onResultsChanged.fire([]);
            return;
        }

        try {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor || !activeEditor.document.fileName.endsWith('package.json')) {
                return;
            }

            const content = activeEditor.document.getText();
            const currentRnVersion = extractCurrentRnVersion(content);

            if (!currentRnVersion) {
                vscode.window.showWarningMessage('Could not find React Native version in package.json');
                return;
            }

            if (currentRnVersion === this.targetVersion) {
                const olderVersion = this.getSlightlyOlderVersion(this.targetVersion);
                if (olderVersion) {
                    try {
                        const diffData = await this.fetchDiff(olderVersion, this.targetVersion);
                        const currentPackages = this.parsePackageJson(content);
                        const results = this.generateResults(currentPackages, diffData);

                        this.currentResults = results;
                        this._onResultsChanged.fire(results);
                        this.updateDecorations(results);

                        if (results.length === 0) {
                            vscode.window.showInformationMessage(
                                `All dependencies meet React Native ${this.targetVersion} requirements! Dependency check has been automatically disabled.`
                            );
                            await this.disable();
                        }
                        return;
                    } catch {}
                }

                this.currentResults = [];
                this._onResultsChanged.fire([]);
                this.clearDecorations();
                vscode.window.showInformationMessage(
                    `All dependencies meet React Native ${this.targetVersion} requirements! Dependency check has been automatically disabled.`
                );
                await this.disable();
                return;
            }

            const diffData = await this.fetchDiff(currentRnVersion, this.targetVersion);
            const currentPackages = this.parsePackageJson(content);
            const results = this.generateResults(currentPackages, diffData);

            this.currentResults = results;
            this._onResultsChanged.fire(results);
            this.updateDecorations(results);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to check dependencies: ${errorMessage}`);

            if (errorMessage.includes('not found in rn-diff-purge')) {
                this.enabled = false;
                this.targetVersion = null;
                await this.context.globalState.update(DEPENDENCY_CHECK_CONFIG.STATE_KEYS.ENABLED, false);
                this.clearDecorations();
                this._onResultsChanged.fire([]);
            }
        }
    }

    private async fetchDiff(fromVersion: string, toVersion: string): Promise<DiffData> {
        const cacheKey = `${fromVersion}..${toVersion}`;

        const cached = this.cache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const url = `${DEPENDENCY_CHECK_CONFIG.RN_DIFF_BASE_URL}/${cacheKey}.diff`;

        try {
            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Version ${toVersion} not found in rn-diff-purge`);
                }
                throw new Error(`Failed to fetch diff: HTTP ${response.status}`);
            }

            const rawDiff = await response.text();
            const packageChanges = parseDiff(rawDiff);

            const diffData: DiffData = {
                fromVersion,
                toVersion,
                packageChanges,
                rawDiff,
            };

            this.cache.set(cacheKey, diffData);
            return diffData;
        } catch (error) {
            throw error;
        }
    }

    private isVersionDowngrade(currentVersion: string, targetVersion: string): boolean {
        const cleanCurrent = cleanVersion(currentVersion);
        const cleanTarget = cleanVersion(targetVersion);
        return compareVersions(cleanTarget, cleanCurrent) < 0;
    }

    private getSlightlyOlderVersion(version: string): string | null {
        const parts = version.split('.');
        if (parts.length !== 3) {
            return null;
        }

        const major = parseInt(parts[0]);
        const minor = parseInt(parts[1]);
        const patch = parseInt(parts[2]);

        if (patch > 0) {
            return `${major}.${minor}.${patch - 1}`;
        }

        if (minor > 0) {
            return `${major}.${minor - 1}.0`;
        }

        if (major > 0) {
            return `${major - 1}.0.0`;
        }

        return null;
    }

    private parsePackageJson(content: string): Record<string, string> {
        const packageJson = parsePackageJson(content);
        if (!packageJson) {
            return {};
        }

        const dependencies = packageJson.dependencies || {};
        const devDependencies = packageJson.devDependencies || {};
        return { ...dependencies, ...devDependencies };
    }

    private generateResults(currentPackages: Record<string, string>, diffData: DiffData): ValidationResult[] {
        const results: ValidationResult[] = [];

        for (const change of diffData.packageChanges) {
            if (change.changeType === 'version_change') {
                const currentVersion = currentPackages[change.packageName];
                if (currentVersion && hasVersionDifference(currentVersion, change.toVersion)) {
                    const cleanCurrentVersion = currentVersion.replace(/^[\^~]/, '');
                    results.push({
                        packageName: change.packageName,
                        currentVersion: cleanCurrentVersion,
                        expectedVersion: change.toVersion,
                        hasVersionMismatch: true,
                        changeType: 'version_change',
                        dependencyType: change.dependencyType,
                    });
                }
            } else if (change.changeType === 'addition') {
                if (!currentPackages[change.packageName]) {
                    results.push({
                        packageName: change.packageName,
                        currentVersion: '',
                        expectedVersion: change.toVersion,
                        hasVersionMismatch: true,
                        changeType: 'addition',
                        dependencyType: change.dependencyType,
                    });
                }
            } else if (change.changeType === 'removal') {
                if (currentPackages[change.packageName]) {
                    const cleanCurrentVersion = currentPackages[change.packageName].replace(/^[\^~]/, '');
                    results.push({
                        packageName: change.packageName,
                        currentVersion: cleanCurrentVersion,
                        expectedVersion: '',
                        hasVersionMismatch: true,
                        changeType: 'removal',
                        dependencyType: change.dependencyType,
                    });
                }
            }
        }

        return results;
    }

    private updateDecorations(results: ValidationResult[]): void {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document.fileName.endsWith('package.json')) {
            return;
        }

        const decorationOptions: vscode.DecorationOptions[] = [];
        const content = activeEditor.document.getText();
        const lines = content.split('\n');

        const missingPackages = results.filter((r) => r.hasVersionMismatch && r.changeType === 'addition');
        const otherResults = results.filter((r) => r.hasVersionMismatch && r.changeType !== 'addition');

        const missingDependencies = missingPackages.filter((r) => r.dependencyType === 'dependencies');
        const missingDevDependencies = missingPackages.filter((r) => r.dependencyType === 'devDependencies');
        if (missingDependencies.length > 0) {
            const dependenciesEndIndex = this.findDependencySectionEnd(lines, 'dependencies');
            if (dependenciesEndIndex !== -1) {
                const range = new vscode.Range(
                    dependenciesEndIndex,
                    lines[dependenciesEndIndex].length,
                    dependenciesEndIndex,
                    lines[dependenciesEndIndex].length
                );

                let contentText = '';
                if (missingDependencies.length === 1) {
                    contentText = ` Missing: ${missingDependencies[0].packageName}@${missingDependencies[0].expectedVersion}`;
                } else {
                    contentText = ` Missing: ${missingDependencies.length} packages`;
                }

                const hoverMessage = this.createCombinedMissingPackagesHoverMessage(missingDependencies);

                decorationOptions.push({
                    range,
                    renderOptions: {
                        after: {
                            contentText,
                            color: new vscode.ThemeColor('errorForeground'),
                        },
                    },
                    hoverMessage,
                });
            }
        }

        if (missingDevDependencies.length > 0) {
            const devDependenciesEndIndex = this.findDependencySectionEnd(lines, 'devDependencies');
            if (devDependenciesEndIndex !== -1) {
                const range = new vscode.Range(
                    devDependenciesEndIndex,
                    lines[devDependenciesEndIndex].length,
                    devDependenciesEndIndex,
                    lines[devDependenciesEndIndex].length
                );

                let contentText = '';
                if (missingDevDependencies.length === 1) {
                    contentText = ` Missing: ${missingDevDependencies[0].packageName}@${missingDevDependencies[0].expectedVersion}`;
                } else {
                    contentText = ` Missing: ${missingDevDependencies.length} dev packages`;
                }

                const hoverMessage = this.createCombinedMissingPackagesHoverMessage(missingDevDependencies);

                decorationOptions.push({
                    range,
                    renderOptions: {
                        after: {
                            contentText,
                            color: new vscode.ThemeColor('errorForeground'),
                        },
                    },
                    hoverMessage,
                });
            }
        }

        for (const result of otherResults) {
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.includes(`"${result.packageName}"`) && line.includes(':')) {
                    const range = new vscode.Range(i, line.length, i, line.length);
                    let contentText = '';

                    if (result.changeType === 'removal') {
                        contentText = ` Should be removed`;
                    } else {
                        contentText = ` Expected: ${result.expectedVersion}`;
                    }

                    decorationOptions.push({
                        range,
                        renderOptions: {
                            after: {
                                contentText,
                                color: new vscode.ThemeColor('errorForeground'),
                            },
                        },
                        hoverMessage: createHoverMessage(result, this.targetVersion!),
                    });
                    break;
                }
            }
        }

        activeEditor.setDecorations(this.decorations, decorationOptions);
    }

    private findDependencySectionEnd(lines: string[], sectionType: 'dependencies' | 'devDependencies'): number {
        let sectionStartIndex = -1;
        const sectionName = sectionType === 'dependencies' ? '"dependencies"' : '"devDependencies"';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes(sectionName) && line.includes(':')) {
                sectionStartIndex = i;
                break;
            }
        }

        if (sectionStartIndex === -1) {
            return -1;
        }

        for (let i = sectionStartIndex + 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('}') && !line.includes('"')) {
                return i;
            }
        }

        return -1;
    }

    private createCombinedMissingPackagesHoverMessage(missingPackages: ValidationResult[]): vscode.MarkdownString {
        let message = `**Dependency Version Check: Missing Packages**\n\n`;
        message += `The following packages should be added for React Native ${this.targetVersion}:\n\n`;

        for (const pkg of missingPackages) {
            message += `• **${pkg.packageName}**: \`${pkg.expectedVersion}\`\n`;
        }

        message += `\n[Add All Missing Packages](command:reactNativePackageChecker.bulkUpdateToExpectedVersions)`;

        return new vscode.MarkdownString(message);
    }

    private clearDecorations(): void {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            activeEditor.setDecorations(this.decorations, []);
        }
    }

    private async promptForTargetVersion(): Promise<string | undefined> {
        const activeEditor = vscode.window.activeTextEditor;
        let currentRnVersion: string | null = null;

        if (activeEditor && activeEditor.document.fileName.endsWith('package.json')) {
            const content = activeEditor.document.getText();
            currentRnVersion = extractCurrentRnVersion(content);
        }

        const version = await vscode.window.showInputBox({
            prompt: 'Enter target React Native version (e.g. 0.75.1)',
            placeHolder: '0.75.1',
            validateInput: (value: string) => {
                if (!value) {
                    return 'Version is required';
                }
                if (!DEPENDENCY_CHECK_CONFIG.VERSION_FORMAT_REGEX.test(value)) {
                    return 'Version must be in format x.y.z (e.g., 0.75.1)';
                }

                if (currentRnVersion && this.isVersionDowngrade(currentRnVersion, value)) {
                    return `Target version ${value} is older than current version ${currentRnVersion}. Only upgrades are allowed.`;
                }

                return null;
            },
        });

        return version?.trim();
    }

    async updateToExpectedVersion(packageName: string, expectedVersion: string): Promise<void> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document.fileName.endsWith('package.json')) {
            vscode.window.showErrorMessage(ERROR_MESSAGES.PACKAGE_JSON_NOT_FOUND);
            return;
        }

        const document = activeEditor.document;
        const content = document.getText();
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes(`"${packageName}"`) && line.includes(':')) {
                const updatedLine = line.replace(/"([^"]+)"\s*:\s*"[^"]+"/, `"$1": "${expectedVersion}"`);
                if (updatedLine !== line) {
                    lines[i] = updatedLine;
                    const updatedContent = lines.join('\n');

                    const edit = new vscode.WorkspaceEdit();
                    const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(content.length));
                    edit.replace(document.uri, fullRange, updatedContent);

                    const success = await vscode.workspace.applyEdit(edit);
                    if (success) {
                        vscode.window.showInformationMessage(
                            SUCCESS_MESSAGES.PACKAGE_UPDATED(packageName, expectedVersion)
                        );

                        await document.save();

                        setTimeout(async () => {
                            if (this.targetVersion && this.enabled) {
                                await this.refresh();
                            }
                        }, 1000);
                    } else {
                        vscode.window.showErrorMessage(`Failed to update ${packageName}`);
                    }
                    return;
                }
            }
        }

        vscode.window.showWarningMessage(`Could not find ${packageName} in package.json`);
    }

    async addPackage(
        packageName: string,
        version: string,
        dependencyType?: 'dependencies' | 'devDependencies'
    ): Promise<void> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document.fileName.endsWith('package.json')) {
            vscode.window.showErrorMessage('No package.json file is currently open');
            return;
        }

        const document = activeEditor.document;
        const content = document.getText();

        const packageJson = parsePackageJson(content);
        if (!packageJson) {
            vscode.window.showErrorMessage(ERROR_MESSAGES.PACKAGE_JSON_PARSE_FAILED);
            return;
        }

        try {
            const targetSection = dependencyType || 'dependencies';
            const sectionName = targetSection === 'devDependencies' ? 'devDependencies' : 'dependencies';

            updatePackageJsonSection(packageJson, sectionName, packageName, version);

            const updatedContent = JSON.stringify(packageJson, null, 2);
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(content.length));
            edit.replace(document.uri, fullRange, updatedContent);

            const success = await vscode.workspace.applyEdit(edit);
            if (success) {
                const sectionDisplayName = targetSection === 'devDependencies' ? 'devDependencies' : 'dependencies';
                vscode.window.showInformationMessage(
                    SUCCESS_MESSAGES.PACKAGE_ADDED(packageName, version, sectionDisplayName)
                );
                await document.save();

                setTimeout(async () => {
                    if (this.targetVersion && this.enabled) {
                        await this.refresh();
                    }
                }, 1000);
            } else {
                vscode.window.showErrorMessage(`Failed to add ${packageName}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to parse package.json: ${error}`);
        }
    }

    async removePackage(packageName: string): Promise<void> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document.fileName.endsWith('package.json')) {
            vscode.window.showErrorMessage('No package.json file is currently open');
            return;
        }

        const document = activeEditor.document;
        const content = document.getText();

        const packageJson = parsePackageJson(content);
        if (!packageJson) {
            vscode.window.showErrorMessage('Failed to parse package.json');
            return;
        }

        try {
            const removed = removePackageFromJson(packageJson, packageName);

            if (!removed) {
                vscode.window.showWarningMessage(`Package ${packageName} not found in dependencies`);
                return;
            }

            const updatedContent = JSON.stringify(packageJson, null, 2);
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(content.length));
            edit.replace(document.uri, fullRange, updatedContent);

            const success = await vscode.workspace.applyEdit(edit);
            if (success) {
                vscode.window.showInformationMessage(`Removed ${packageName} from dependencies`);
                await document.save();

                setTimeout(async () => {
                    if (this.targetVersion && this.enabled) {
                        await this.refresh();
                    }
                }, 1000);
            } else {
                vscode.window.showErrorMessage(`Failed to remove ${packageName}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to parse package.json: ${error}`);
        }
    }

    async bulkUpdateToExpectedVersions(): Promise<void> {
        if (!this.enabled || !this.targetVersion) {
            vscode.window.showErrorMessage('Dependency check is not enabled');
            return;
        }

        const results = this.getCurrentResults();
        if (results.length === 0) {
            vscode.window.showInformationMessage('No dependency version mismatches found');
            return;
        }

        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document.fileName.endsWith('package.json')) {
            vscode.window.showErrorMessage('No package.json file is currently open');
            return;
        }

        const previewItems = results.map((result) => {
            let description = '';
            let detail = '';

            if (result.changeType === 'addition') {
                description = `Add ${result.expectedVersion}`;
                detail = `Add new package required for React Native ${this.targetVersion}`;
            } else if (result.changeType === 'removal') {
                description = `Remove ${result.currentVersion}`;
                detail = `Remove package no longer needed for React Native ${this.targetVersion}`;
            } else {
                description = `${result.currentVersion} → ${result.expectedVersion}`;
                detail = `Update to React Native ${this.targetVersion} expected version`;
            }

            return {
                label: result.packageName,
                description,
                detail,
                picked: true,
            };
        });

        const selectedItems = await vscode.window.showQuickPick(previewItems, {
            title: `Bulk Update Dependencies for React Native ${this.targetVersion}`,
            placeHolder: 'Select packages to update (uncheck to skip)',
            canPickMany: true,
            ignoreFocusOut: true,
        });

        if (!selectedItems || selectedItems.length === 0) {
            return;
        }

        const document = activeEditor.document;
        const content = document.getText();

        const packageJson = parsePackageJson(content);
        if (!packageJson) {
            vscode.window.showErrorMessage('Failed to parse package.json');
            return;
        }

        try {
            let updatedCount = 0;
            const failedUpdates: string[] = [];

            for (const item of selectedItems) {
                const result = results.find((r) => r.packageName === item.label);
                if (!result) {
                    continue;
                }

                try {
                    if (result.changeType === 'addition') {
                        const targetSection = result.dependencyType || 'dependencies';
                        updatePackageJsonSection(
                            packageJson,
                            targetSection,
                            result.packageName,
                            result.expectedVersion
                        );
                        updatedCount++;
                    } else if (result.changeType === 'removal') {
                        const removed = removePackageFromJson(packageJson, result.packageName);
                        if (removed) {
                            updatedCount++;
                        } else {
                            failedUpdates.push(result.packageName);
                        }
                    } else {
                        let updated = false;
                        if (packageJson.dependencies && packageJson.dependencies[result.packageName]) {
                            packageJson.dependencies[result.packageName] = result.expectedVersion;
                            updated = true;
                        }
                        if (packageJson.devDependencies && packageJson.devDependencies[result.packageName]) {
                            packageJson.devDependencies[result.packageName] = result.expectedVersion;
                            updated = true;
                        }
                        if (updated) {
                            updatedCount++;
                        } else {
                            failedUpdates.push(result.packageName);
                        }
                    }
                } catch {
                    failedUpdates.push(result.packageName);
                }
            }

            // Sort dependencies alphabetically
            if (packageJson.dependencies) {
                const sortedDeps = Object.keys(packageJson.dependencies)
                    .sort()
                    .reduce((result: Record<string, string>, key: string) => {
                        result[key] = packageJson.dependencies[key];
                        return result;
                    }, {});
                packageJson.dependencies = sortedDeps;
            }

            if (packageJson.devDependencies) {
                const sortedDevDeps = Object.keys(packageJson.devDependencies)
                    .sort()
                    .reduce((result: Record<string, string>, key: string) => {
                        result[key] = packageJson.devDependencies[key];
                        return result;
                    }, {});
                packageJson.devDependencies = sortedDevDeps;
            }

            if (updatedCount > 0) {
                const updatedContent = JSON.stringify(packageJson, null, 2);
                const edit = new vscode.WorkspaceEdit();
                const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(content.length));
                edit.replace(document.uri, fullRange, updatedContent);

                const success = await vscode.workspace.applyEdit(edit);
                if (success) {
                    await document.save();

                    const message = `Updated ${updatedCount} package${updatedCount > 1 ? 's' : ''}`;
                    if (failedUpdates.length > 0) {
                        vscode.window.showWarningMessage(`${message}. Failed to update: ${failedUpdates.join(', ')}`);
                    } else {
                        vscode.window.showInformationMessage(message);
                    }

                    setTimeout(async () => {
                        if (this.targetVersion && this.enabled) {
                            await this.refresh();
                        }
                    }, 1000);
                } else {
                    vscode.window.showErrorMessage('Failed to apply bulk updates');
                }
            } else {
                vscode.window.showWarningMessage('No packages were updated');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to parse package.json: ${error}`);
        }
    }

    async initialize(): Promise<void> {
        this.enabled = false;
        this.targetVersion = null;
        await this.context.globalState.update(DEPENDENCY_CHECK_CONFIG.STATE_KEYS.ENABLED, false);
        await this.context.globalState.update(DEPENDENCY_CHECK_CONFIG.STATE_KEYS.TARGET_VERSION, undefined);
    }

    dispose(): void {
        this._onResultsChanged.dispose();
        this.decorations.dispose();
    }
}
