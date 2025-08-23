import * as vscode from 'vscode';

import { FileChangeAnalyzer } from './fileChangeAnalyzer';
import { LoggerService } from './loggerService';
import { PackageService } from './packageService';

export class DebouncedChangeHandler {
    private debounceTimer: NodeJS.Timeout | null = null;
    private pendingChanges = new Map<string, { oldContent: string; newContent: string }>();
    private readonly debounceDelay = 500;

    constructor(
        private packageService: PackageService,
        private fileChangeAnalyzer: FileChangeAnalyzer,
        private logger: LoggerService,
        private onRefreshNeeded: () => void
    ) {}

    handleFileChange(document: vscode.TextDocument, oldContent?: string): void {
        if (!document.fileName.endsWith('package.json')) {
            return;
        }

        const filePath = document.fileName;
        const newContent = document.getText();

        this.pendingChanges.set(filePath, {
            oldContent: oldContent || '',
            newContent,
        });

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this.processPendingChanges();
        }, this.debounceDelay);

        this.logger.debug(`File change debounced for ${filePath}`);
    }

    handleFileSystemChange(uri: vscode.Uri): void {
        if (!uri.fsPath.endsWith('package.json')) {
            return;
        }

        const fileName = uri.fsPath.split('/').pop() || 'package.json';

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(async () => {
            try {
                const document = await vscode.workspace.openTextDocument(uri);
                const newContent = document.getText();

                const oldContent = this.pendingChanges.get(uri.fsPath)?.oldContent || '';

                if (oldContent && newContent !== oldContent) {
                    const changes = this.fileChangeAnalyzer.analyzePackageJsonChanges(oldContent, newContent);

                    if (changes.length > 0) {
                        await this.packageService.handlePackageChanges(changes, newContent);
                        this.onRefreshNeeded();
                    } else {
                        this.logger.debug('File system change: no dependency changes detected');
                    }
                } else {
                    this.logger.debug(`${fileName} → no old content, refreshing`);
                    this.onRefreshNeeded();
                }
            } catch (error: any) {
                this.logger.warn(`File system change analysis failed: ${error.message} - triggering refresh`);
                this.onRefreshNeeded();
            }
        }, this.debounceDelay);
    }

    private async processPendingChanges(): Promise<void> {
        if (this.pendingChanges.size === 0) {
            return;
        }

        this.logger.debug(`Processing ${this.pendingChanges.size} pending file changes`);

        let hasSignificantChanges = false;
        let allChanges: any[] = [];

        for (const [filePath, { oldContent, newContent }] of this.pendingChanges.entries()) {
            if (oldContent && newContent !== oldContent) {
                const changes = this.fileChangeAnalyzer.analyzePackageJsonChanges(oldContent, newContent);

                if (changes.length > 0) {
                    hasSignificantChanges = true;
                    allChanges = allChanges.concat(changes);

                    await this.packageService.handlePackageChanges(changes, newContent);
                }
            } else if (!oldContent) {
                hasSignificantChanges = true;
                this.logger.debug(`No old content available for ${filePath}, clearing cache`);
                this.packageService.clearCache();
                break;
            }
        }

        this.pendingChanges.clear();

        if (hasSignificantChanges) {
            this.onRefreshNeeded();
        } else {
            this.logger.debug('No significant changes detected, skipping refresh');
        }
    }

    public async flushPendingChanges(): Promise<void> {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        await this.processPendingChanges();
    }

    public hasPendingChanges(): boolean {
        return this.pendingChanges.size > 0;
    }

    public dispose(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.pendingChanges.clear();
    }
}
