import * as vscode from 'vscode';

import { FileExtensions } from '../types';

import { FileChangeService } from './fileChangeService';
import { LoggerService } from './loggerService';
import { PackageService } from './packageService';

export class DebouncedChangeService {
    private debounceTimer: NodeJS.Timeout | null = null;
    private pendingChanges = new Map<string, { oldContent: string; newContent: string }>();
    private readonly debounceDelay = 500;

    constructor(
        private packageService: PackageService,
        private fileChangeService: FileChangeService,
        private logger: LoggerService,
        private onRefreshNeeded: () => void
    ) {}

    handleFileChange(document: vscode.TextDocument, oldContent?: string): void {
        if (!document.fileName.endsWith(FileExtensions.PACKAGE_JSON)) {
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
    }

    handleFileSystemChange(uri: vscode.Uri): void {
        if (!uri.fsPath.endsWith(FileExtensions.PACKAGE_JSON)) {
            return;
        }

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(async () => {
            try {
                const document = await vscode.workspace.openTextDocument(uri);
                const newContent = document.getText();

                const oldContent = this.pendingChanges.get(uri.fsPath)?.oldContent || '';

                if (oldContent && newContent !== oldContent) {
                    const changes = this.fileChangeService.analyzePackageJsonChanges(oldContent, newContent);

                    if (changes.length > 0) {
                        await this.packageService.handlePackageChanges(changes, newContent);
                        this.onRefreshNeeded();
                    }
                } else {
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

        let hasSignificantChanges = false;
        let allChanges: any[] = [];

        for (const [, { oldContent, newContent }] of this.pendingChanges.entries()) {
            if (oldContent && newContent !== oldContent) {
                const changes = this.fileChangeService.analyzePackageJsonChanges(oldContent, newContent);

                if (changes.length > 0) {
                    hasSignificantChanges = true;
                    allChanges = allChanges.concat(changes);

                    await this.packageService.handlePackageChanges(changes, newContent);
                }
            } else if (!oldContent) {
                hasSignificantChanges = true;
                this.packageService.clearCache();
                break;
            }
        }

        this.pendingChanges.clear();

        if (hasSignificantChanges) {
            this.onRefreshNeeded();
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
