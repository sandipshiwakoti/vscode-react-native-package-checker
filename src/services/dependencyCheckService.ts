import * as vscode from 'vscode';

import { DEPENDENCY_CHECK_CONFIG } from '../constants';
import { DiffData, ValidationResult } from '../types';
import {
    createHoverMessage,
    extractCurrentRnVersion,
    hasVersionDifference,
    parseDiff,
} from '../utils/dependencyCheckUtils';

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

    /**
     * Enables dependency checking and prompts for target version
     */
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

            vscode.window.showInformationMessage(`Dependency check enabled for React Native ${version}`);
            await this.refresh();
        } catch {
            vscode.window.showErrorMessage('Failed to enable dependency check');
        }
    }

    /**
     * Disables dependency checking
     */
    async disable(): Promise<void> {
        this.enabled = false;
        this.targetVersion = null;

        await this.context.globalState.update(DEPENDENCY_CHECK_CONFIG.STATE_KEYS.ENABLED, false);
        this.clearDecorations();
        this._onResultsChanged.fire([]);

        vscode.window.showInformationMessage('Dependency check disabled');
    }

    /**
     * Toggles dependency checking
     */
    async toggle(): Promise<void> {
        if (this.enabled) {
            await this.disable();
        } else {
            await this.enable();
        }
    }

    /**
     * Checks if dependency checking is enabled
     */
    isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Gets the current target version
     */
    getTargetVersion(): string | null {
        return this.targetVersion;
    }

    /**
     * Refreshes dependency check results
     */
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
                                `All dependencies meet React Native ${this.targetVersion} requirements!`
                            );
                        }
                        return;
                    } catch {}
                }

                this.currentResults = [];
                this._onResultsChanged.fire([]);
                this.clearDecorations();
                vscode.window.showInformationMessage(
                    `All dependencies meet React Native ${this.targetVersion} requirements!`
                );
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

    /**
     * Fetches diff data from rn-diff-purge
     */
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

    /**
     * Gets a slightly older version to compare against when current version matches target
     */
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

    /**
     * Parses package.json content
     */
    private parsePackageJson(content: string): Record<string, string> {
        try {
            const packageJson = JSON.parse(content);
            const dependencies = packageJson.dependencies || {};
            const devDependencies = packageJson.devDependencies || {};
            return { ...dependencies, ...devDependencies };
        } catch {
            return {};
        }
    }

    /**
     * Generates validation results
     */
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
                    });
                }
            }
        }

        return results;
    }

    /**
     * Updates decorations in the editor with hover tooltips
     */
    private updateDecorations(results: ValidationResult[]): void {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document.fileName.endsWith('package.json')) {
            return;
        }

        const decorationOptions: vscode.DecorationOptions[] = [];
        const content = activeEditor.document.getText();
        const lines = content.split('\n');

        for (const result of results) {
            if (!result.hasVersionMismatch) {
                continue;
            }

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.includes(`"${result.packageName}"`) && line.includes(':')) {
                    const range = new vscode.Range(i, line.length, i, line.length);
                    decorationOptions.push({
                        range,
                        renderOptions: {
                            after: {
                                contentText: ` Expected: ${result.expectedVersion}`,
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

    /**
     * Clears all decorations
     */
    private clearDecorations(): void {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            activeEditor.setDecorations(this.decorations, []);
        }
    }

    /**
     * Prompts for target React Native version
     */
    private async promptForTargetVersion(): Promise<string | undefined> {
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
                return null;
            },
        });

        return version?.trim();
    }

    /**
     * Updates a package to expected version
     */
    async updateToExpectedVersion(packageName: string, expectedVersion: string): Promise<void> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document.fileName.endsWith('package.json')) {
            vscode.window.showErrorMessage('No package.json file is currently open');
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
                        vscode.window.showInformationMessage(`Updated ${packageName} to ${expectedVersion}`);

                        await document.save();

                        setTimeout(async () => {
                            if (this.targetVersion) {
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

    /**
     * Initializes the service from saved state
     */
    async initialize(): Promise<void> {
        this.enabled = false;
        this.targetVersion = null;
        await this.context.globalState.update(DEPENDENCY_CHECK_CONFIG.STATE_KEYS.ENABLED, false);
        await this.context.globalState.update(DEPENDENCY_CHECK_CONFIG.STATE_KEYS.TARGET_VERSION, undefined);
    }

    /**
     * Disposes the service
     */
    dispose(): void {
        this._onResultsChanged.dispose();
        this.decorations.dispose();
    }
}
