import * as vscode from 'vscode';

import { LOG_LEVEL } from '../types';

export class LoggerService {
    private outputChannel: vscode.OutputChannel;
    private logLevel: LOG_LEVEL = LOG_LEVEL.INFO;
    private isEnabled: boolean = true;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('RN Package Checker');
        this.loadConfiguration();
    }

    private loadConfiguration(): void {
        const config = vscode.workspace.getConfiguration('reactNativePackageChecker');
        this.isEnabled = config.get('enableLogging', true);
        const logLevelStr = config.get('logLevel', 'info') as string;
        this.logLevel = this.parseLogLevel(logLevelStr);
    }

    private parseLogLevel(level: string): LOG_LEVEL {
        switch (level.toLowerCase()) {
            case 'debug':
                return LOG_LEVEL.DEBUG;
            case 'info':
                return LOG_LEVEL.INFO;
            case 'warn':
                return LOG_LEVEL.WARN;
            case 'error':
                return LOG_LEVEL.ERROR;
            default:
                return LOG_LEVEL.INFO;
        }
    }

    private shouldLog(level: LOG_LEVEL): boolean {
        return this.isEnabled && level >= this.logLevel;
    }

    private formatMessage(level: LOG_LEVEL, message: string, data?: any): string {
        const timestamp = new Date().toISOString();
        const levelStr = LOG_LEVEL[level].padEnd(5);
        let formatted = `[${timestamp}] ${levelStr} ${message}`;

        if (data) {
            formatted += `\n${JSON.stringify(data, null, 2)}`;
        }

        return formatted;
    }

    debug(message: string, data?: any): void {
        if (this.shouldLog(LOG_LEVEL.DEBUG)) {
            const formatted = this.formatMessage(LOG_LEVEL.DEBUG, message, data);
            this.outputChannel.appendLine(formatted);
        }
    }

    info(message: string, data?: any): void {
        if (this.shouldLog(LOG_LEVEL.INFO)) {
            const formatted = this.formatMessage(LOG_LEVEL.INFO, message, data);
            this.outputChannel.appendLine(formatted);
        }
    }

    warn(message: string, data?: any): void {
        if (this.shouldLog(LOG_LEVEL.WARN)) {
            const formatted = this.formatMessage(LOG_LEVEL.WARN, message, data);
            this.outputChannel.appendLine(formatted);
        }
    }

    error(message: string, data?: any): void {
        if (this.shouldLog(LOG_LEVEL.ERROR)) {
            const formatted = this.formatMessage(LOG_LEVEL.ERROR, message, data);
            this.outputChannel.appendLine(formatted);
        }
    }

    logApiCall(endpoint: string, packages: string[], duration?: number): void {
        const durationStr = duration ? ` (${duration}ms)` : '';
        const apiType = endpoint.includes('package-info')
            ? 'package-info'
            : endpoint.includes('registry')
              ? 'npm registry'
              : endpoint;
        this.info(`API ${apiType} ${packages.length} packages${durationStr}`);
    }

    logCacheHit(packageNames: string[]): void {
        if (packageNames.length > 0) {
            const packageList =
                packageNames.length <= 5
                    ? packageNames.join(', ')
                    : `${packageNames.slice(0, 5).join(', ')} +${packageNames.length - 5} more`;
            this.debug(`Cache hit (${packageNames.length}) ${packageList}`);
        }
    }

    logCacheMiss(packageNames: string[]): void {
        if (packageNames.length > 0) {
            const packageList =
                packageNames.length <= 5
                    ? packageNames.join(', ')
                    : `${packageNames.slice(0, 5).join(', ')} +${packageNames.length - 5} more`;
            this.debug(`Cache miss (${packageNames.length}) ${packageList}`);
        }
    }

    logCacheUpdate(operation: string, packageNames: string[]): void {
        if (packageNames.length > 0) {
            const packageList =
                packageNames.length <= 3
                    ? packageNames.join(', ')
                    : `${packageNames.slice(0, 3).join(', ')} +${packageNames.length - 3} more`;
            this.debug(`Cache ${operation} (${packageNames.length}) ${packageList}`);
        }
    }

    logFileChange(changeType: string, packageChanges: any[]): void {
        const counts = packageChanges.reduce(
            (acc, c) => {
                acc[c.type] = (acc[c.type] || 0) + 1;
                return acc;
            },
            {} as Record<string, number>
        );

        const summary = Object.entries(counts)
            .map(([type, count]) => {
                if (type === 'version_changed') {
                    return `${count} updated`;
                }
                if (type === 'added') {
                    return `${count} added`;
                }
                if (type === 'removed') {
                    return `${count} removed`;
                }
                return `${count} ${type}`;
            })
            .join(', ');

        if (packageChanges.length === 1 && packageChanges[0].type === 'version_changed') {
            const change = packageChanges[0];
            this.info(`Cached ${change.packageName} ${change.oldVersion}→${change.newVersion} (1 updated)`);
        } else if (packageChanges.length <= 3) {
            const packageNames = packageChanges.map((c) => c.packageName);
            this.info(`Cached ${packageNames.join(', ')} (${summary})`);
        } else {
            this.info(`Cached (${summary})`);
        }
    }

    logLoadingState(state: 'start' | 'end', operation: string, packages?: string[]): void {
        const message = `Loading ${state} ${operation}`;
        this.debug(message, packages ? { packages } : undefined);
    }

    show(): void {
        this.outputChannel.show();
    }

    dispose(): void {
        this.outputChannel.dispose();
    }
}
