import * as vscode from 'vscode';

import { ERROR_MESSAGES, EXTERNAL_URLS, REQUIREMENTS_CONFIG, SUCCESS_MESSAGES } from '../constants';
import { DiffData, RequirementResult } from '../types';
import {
    isInDependencySection,
    parsePackageJson,
    removePackageFromJson,
    updatePackageJsonSection,
} from '../utils/packageUtils';
import {
    createRequirementsHoverMessage,
    extractCurrentRnVersion,
    hasRequirementMismatch,
    parseDiff,
} from '../utils/requirementsUtils';
import { promptForVersionOperation } from '../utils/versionUtils';
import { cleanVersion, compareVersions } from '../utils/versionUtils';

import { CacheManagerService } from './cacheManagerService';
import { LoggerService } from './loggerService';
import { SuccessModalService } from './successModalService';

export class RequirementsService {
    private _onResultsChanged: vscode.EventEmitter<RequirementResult[]> = new vscode.EventEmitter<
        RequirementResult[]
    >();
    public readonly onResultsChanged: vscode.Event<RequirementResult[]> = this._onResultsChanged.event;

    private enabled = false;
    private targetVersion: string | null = null;
    private originalRnVersion: string | null = null;
    private decorations: vscode.TextEditorDecorationType;
    private cache = new Map<string, DiffData>();
    private suppressSuccessModal = false;

    private currentResults: RequirementResult[] = [];

    constructor(
        private context: vscode.ExtensionContext,
        private logger: LoggerService,
        private cacheManager: CacheManagerService
    ) {
        this.decorations = vscode.window.createTextEditorDecorationType({
            after: {
                color: new vscode.ThemeColor('errorForeground'),
                fontStyle: 'italic',
            },
        });
    }

    async enable(suppressSuccessModal: boolean = false): Promise<void> {
        try {
            const activeEditor = vscode.window.activeTextEditor;
            let currentRnVersion: string | null = null;

            if (activeEditor && activeEditor.document.fileName.endsWith('package.json')) {
                const content = activeEditor.document.getText();
                currentRnVersion = extractCurrentRnVersion(content);
            }

            const versionOperation = await promptForVersionOperation(currentRnVersion || undefined, this.cacheManager);
            if (!versionOperation) {
                return;
            }

            this.targetVersion = versionOperation.targetVersion;
            this.originalRnVersion = versionOperation.sourceVersion;
            this.enabled = true;

            await this.context.globalState.update(REQUIREMENTS_CONFIG.STATE_KEYS.ENABLED, true);
            await this.context.globalState.update(
                REQUIREMENTS_CONFIG.STATE_KEYS.TARGET_VERSION,
                versionOperation.targetVersion
            );
            await this.context.globalState.update('requirementsOriginalRnVersion', versionOperation.sourceVersion);

            vscode.window.showInformationMessage(
                SUCCESS_MESSAGES.REQUIREMENTS_ENABLED(
                    versionOperation.targetVersion,
                    versionOperation.sourceVersion || undefined
                )
            );
            await this.refresh(suppressSuccessModal);

            setTimeout(() => {
                this.scrollToFirstPackageWithIssues();
            }, 1000);
        } catch {
            vscode.window.showErrorMessage('Failed to enable requirements');
        }
    }

    async disable(): Promise<void> {
        this.enabled = false;
        this.targetVersion = null;
        this.originalRnVersion = null;

        await this.context.globalState.update(REQUIREMENTS_CONFIG.STATE_KEYS.ENABLED, false);
        await this.context.globalState.update('requirementsOriginalRnVersion', undefined);
        this.clearDecorations();
        this._onResultsChanged.fire([]);

        vscode.window.showInformationMessage(SUCCESS_MESSAGES.REQUIREMENTS_DISABLED);
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

    getOriginalRnVersion(): string | null {
        return this.originalRnVersion;
    }

    getCurrentResults(): RequirementResult[] {
        return this.currentResults;
    }

    setSuppressSuccessModal(suppress: boolean): void {
        this.suppressSuccessModal = suppress;
    }

    async refresh(suppressSuccessModal: boolean = false): Promise<void> {
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

            // Always use the original React Native version for diff to ensure all packages are checked
            // This prevents issues when RN version is updated but other packages still need updates
            const fromVersion = this.originalRnVersion || currentRnVersion;

            // Validate version compatibility before making API call
            const versionComparison = compareVersions(this.targetVersion, fromVersion);

            if (versionComparison < 0) {
                // Only prevent API call for downgrades, not same versions
                const errorMessage = `Target version ${this.targetVersion} is older than current version ${fromVersion}. Only upgrades are supported. Please choose a newer version.`;
                vscode.window.showErrorMessage(errorMessage);
                // Disable requirements since the target version is invalid
                await this.disable();
                return;
            }

            // If versions are the same, we still need to check other packages
            // Use baseline version to generate meaningful diff for same-version scenarios
            let diffData: DiffData;

            if (versionComparison === 0) {
                // When versions are the same, use static baseline version to generate diff
                const baselineVersion = REQUIREMENTS_CONFIG.BASELINE_VERSION;
                diffData = await this.fetchDiff(baselineVersion, this.targetVersion);
            } else {
                diffData = await this.fetchDiff(fromVersion, this.targetVersion);
            }
            const currentPackages = this.parsePackageJson(content);
            const results = this.generateResults(currentPackages, diffData);

            this.currentResults = results;
            this._onResultsChanged.fire(results);
            this.updateDecorations(results);

            // Check if all requirements are fulfilled
            if (results.length === 0) {
                const shouldSuppressModal = suppressSuccessModal || this.suppressSuccessModal;

                if (!shouldSuppressModal) {
                    await SuccessModalService.showRequirementsFulfilledModal(this.targetVersion);
                }

                // Reset the suppress flag after use
                this.suppressSuccessModal = false;

                await this.disable();
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to check requirements: ${errorMessage}`);

            if (errorMessage.includes('not found in rn-diff-purge')) {
                this.enabled = false;
                this.targetVersion = null;
                await this.context.globalState.update(REQUIREMENTS_CONFIG.STATE_KEYS.ENABLED, false);
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

        const url = `${REQUIREMENTS_CONFIG.RN_DIFF_BASE_URL}/${cacheKey}.diff`;

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

    private generateResults(currentPackages: Record<string, string>, diffData: DiffData): RequirementResult[] {
        const results: RequirementResult[] = [];

        for (const change of diffData.packageChanges) {
            if (change.changeType === 'version_change') {
                const currentVersion = currentPackages[change.packageName];
                if (currentVersion && hasRequirementMismatch(currentVersion, change.toVersion)) {
                    const cleanCurrentVersion = currentVersion.replace(/^[\^~]/, '');
                    results.push({
                        packageName: change.packageName,
                        currentVersion: cleanCurrentVersion,
                        requiredVersion: change.toVersion,
                        hasRequirementMismatch: true,
                        changeType: 'version_change',
                        dependencyType: change.dependencyType,
                    });
                }
            } else if (change.changeType === 'addition') {
                const currentVersion = currentPackages[change.packageName];
                if (!currentVersion) {
                    results.push({
                        packageName: change.packageName,
                        currentVersion: '',
                        requiredVersion: change.toVersion,
                        hasRequirementMismatch: true,
                        changeType: 'addition',
                        dependencyType: change.dependencyType,
                    });
                } else if (hasRequirementMismatch(currentVersion, change.toVersion)) {
                    const cleanCurrentVersion = currentVersion.replace(/^[\^~]/, '');
                    results.push({
                        packageName: change.packageName,
                        currentVersion: cleanCurrentVersion,
                        requiredVersion: change.toVersion,
                        hasRequirementMismatch: true,
                        changeType: 'version_change',
                        dependencyType: change.dependencyType,
                    });
                }
            } else if (change.changeType === 'removal') {
                if (currentPackages[change.packageName]) {
                    const cleanCurrentVersion = currentPackages[change.packageName].replace(/^[\^~]/, '');
                    results.push({
                        packageName: change.packageName,
                        currentVersion: cleanCurrentVersion,
                        requiredVersion: '',
                        hasRequirementMismatch: true,
                        changeType: 'removal',
                        dependencyType: change.dependencyType,
                    });
                }
            }
        }

        return results;
    }

    private updateDecorations(results: RequirementResult[]): void {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document.fileName.endsWith('package.json')) {
            return;
        }

        const decorationOptions: vscode.DecorationOptions[] = [];
        const content = activeEditor.document.getText();
        const lines = content.split('\n');

        const missingPackages = results.filter((r) => r.hasRequirementMismatch && r.changeType === 'addition');
        const otherResults = results.filter((r) => r.hasRequirementMismatch && r.changeType !== 'addition');

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
                    contentText = ` Missing: ${missingDependencies[0].packageName}@${missingDependencies[0].requiredVersion}`;
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
                    contentText = ` Missing: ${missingDevDependencies[0].packageName}@${missingDevDependencies[0].requiredVersion}`;
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
                    // Only show decorations for packages in dependency sections (not scripts, etc.)
                    if (isInDependencySection(lines, i)) {
                        const range = new vscode.Range(i, line.length, i, line.length);
                        let contentText = '';

                        if (result.changeType === 'removal') {
                            contentText = ` Should be removed`;
                        } else {
                            contentText = ` Required: ${result.requiredVersion}`;
                        }

                        decorationOptions.push({
                            range,
                            renderOptions: {
                                after: {
                                    contentText,
                                    color: new vscode.ThemeColor('errorForeground'),
                                },
                            },
                            hoverMessage: createRequirementsHoverMessage(
                                result,
                                this.targetVersion!,
                                this.originalRnVersion || undefined
                            ),
                        });
                        break;
                    }
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

    private createCombinedMissingPackagesHoverMessage(missingPackages: RequirementResult[]): vscode.MarkdownString {
        let message = `**Requirements Check: Missing Packages**\n\n`;
        message += `The following packages should be added for React Native ${this.targetVersion}:\n\n`;

        for (const pkg of missingPackages) {
            message += `• **${pkg.packageName}**: \`${pkg.requiredVersion}\`\n`;
        }

        // Determine the dependency type for the command
        const dependencyType = missingPackages[0]?.dependencyType || 'dependencies';
        const sectionName = dependencyType === 'devDependencies' ? 'dev packages' : 'packages';

        // Use specific commands for each dependency type to avoid argument issues
        const commandName =
            dependencyType === 'devDependencies'
                ? 'reactNativePackageChecker.addAllMissingDevPackages'
                : 'reactNativePackageChecker.addAllMissingDependencies';

        message += `\n[Add All Missing ${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)}](command:${commandName})`;

        // Use the original RN version (source version) for upgrade helper link
        if (this.originalRnVersion && this.originalRnVersion !== this.targetVersion) {
            const diffUrl = `${EXTERNAL_URLS.UPGRADE_HELPER_BASE}/?from=${this.originalRnVersion}&to=${this.targetVersion}#RnDiffApp-package.json`;
            message += `\n\n---\n\n[View React Native ${this.targetVersion} upgrade guide](${diffUrl})`;
        }

        const markdownString = new vscode.MarkdownString(message);
        markdownString.isTrusted = true;
        markdownString.supportHtml = true;
        return markdownString;
    }

    private clearDecorations(): void {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            activeEditor.setDecorations(this.decorations, []);
        }
    }

    async updateToRequiredVersion(packageName: string, requiredVersion: string): Promise<void> {
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
                // Only update if we're in a dependency section (not scripts, etc.)
                if (isInDependencySection(lines, i)) {
                    const updatedLine = line.replace(/"([^"]+)"\s*:\s*"[^"]+"/, `"$1": "${requiredVersion}"`);
                    if (updatedLine !== line) {
                        lines[i] = updatedLine;
                        const updatedContent = lines.join('\n');

                        const edit = new vscode.WorkspaceEdit();
                        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(content.length));
                        edit.replace(document.uri, fullRange, updatedContent);

                        const success = await vscode.workspace.applyEdit(edit);
                        if (success) {
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

    async addAllMissingPackages(dependencyType: 'dependencies' | 'devDependencies'): Promise<void> {
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

        // Get missing packages for the specified dependency type
        const missingPackages = this.currentResults.filter(
            (r) => r.changeType === 'addition' && r.dependencyType === dependencyType
        );

        if (missingPackages.length === 0) {
            vscode.window.showInformationMessage(`No missing ${dependencyType} to add`);
            return;
        }

        try {
            // Sort packages alphabetically (like yarn add does)
            const sortedPackages = missingPackages.sort((a, b) => a.packageName.localeCompare(b.packageName));

            // Add all packages to the appropriate section
            for (const pkg of sortedPackages) {
                updatePackageJsonSection(packageJson, dependencyType, pkg.packageName, pkg.requiredVersion);
            }

            // Ensure the section is sorted alphabetically
            if (packageJson[dependencyType]) {
                const sortedSection = Object.keys(packageJson[dependencyType])
                    .sort()
                    .reduce((result: Record<string, string>, key: string) => {
                        result[key] = packageJson[dependencyType][key];
                        return result;
                    }, {});
                packageJson[dependencyType] = sortedSection;
            }

            const updatedContent = JSON.stringify(packageJson, null, 2);
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(content.length));
            edit.replace(document.uri, fullRange, updatedContent);

            const success = await vscode.workspace.applyEdit(edit);
            if (success) {
                await document.save();

                const packageNames = sortedPackages.map((p) => p.packageName).join(', ');
                vscode.window.showInformationMessage(
                    `Added ${sortedPackages.length} missing ${dependencyType === 'devDependencies' ? 'dev ' : ''}package${sortedPackages.length > 1 ? 's' : ''}: ${packageNames}`
                );

                setTimeout(async () => {
                    if (this.targetVersion && this.enabled) {
                        await this.refresh();
                    }
                }, 1000);
            } else {
                vscode.window.showErrorMessage(`Failed to add missing ${dependencyType}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to parse package.json: ${error}`);
        }
    }

    async initialize(): Promise<void> {
        // Always initialize as disabled by default
        this.enabled = false;
        this.targetVersion = null;
        this.originalRnVersion = null;
        await this.context.globalState.update(REQUIREMENTS_CONFIG.STATE_KEYS.ENABLED, false);
        await this.context.globalState.update(REQUIREMENTS_CONFIG.STATE_KEYS.TARGET_VERSION, undefined);
        await this.context.globalState.update('requirementsOriginalRnVersion', undefined);
    }

    private scrollToFirstPackageWithIssues(): void {
        const activeEditor = vscode.window.activeTextEditor;
        if (
            !activeEditor ||
            !activeEditor.document.fileName.endsWith('package.json') ||
            this.currentResults.length === 0
        ) {
            return;
        }

        const content = activeEditor.document.getText();
        const lines = content.split('\n');

        const firstResult = this.currentResults[0];
        if (!firstResult) {
            return;
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes(`"${firstResult.packageName}"`) && line.includes(':')) {
                // Only scroll to packages in dependency sections (not scripts, etc.)
                if (isInDependencySection(lines, i)) {
                    const position = new vscode.Position(i, 0);
                    const range = new vscode.Range(position, position.with(undefined, line.length));

                    activeEditor.selection = new vscode.Selection(position, range.end);
                    activeEditor.revealRange(range, vscode.TextEditorRevealType.InCenter);
                    break;
                }
            }
        }
    }

    dispose(): void {
        this._onResultsChanged.dispose();
        this.decorations.dispose();
    }
}
