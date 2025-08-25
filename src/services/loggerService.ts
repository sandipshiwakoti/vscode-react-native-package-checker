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

    debugApiRequest(method: string, url: string): void {
        this.debug(`API ${method} ${url}`);
    }

    debugApiResponse(url: string, status: number, responseTime: number, size?: number): void {
        const sizeStr = size ? ` ${size}b` : '';
        this.debug(`API response ${status} ${responseTime}ms${sizeStr} ${url}`);
    }

    debugCacheOperation(operation: 'get' | 'set' | 'delete' | 'clear', key: string, ttl?: number): void {
        const ttlStr = ttl ? ` ttl:${ttl}s` : '';
        this.debug(`Cache ${operation} ${key}${ttlStr}`);
    }

    debugParseOperation(file: string, packages: number, dependencies: number): void {
        this.debug(`Parse ${file} found ${packages} packages, ${dependencies} deps`);
    }

    debugStateChange(component: string, from: string, to: string): void {
        this.debug(`State ${component} ${from}→${to}`);
    }

    debugPerformance(operation: string, duration: number, items?: number): void {
        const itemsStr = items ? ` ${items} items` : '';
        this.debug(`Perf ${operation} ${duration}ms${itemsStr}`);
    }

    debugRetry(operation: string, attempt: number, maxAttempts: number, delay: number): void {
        this.debug(`Retry ${operation} ${attempt}/${maxAttempts} delay:${delay}ms`);
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

    logFileChange(packageChanges: any[]): void {
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

    warnSlowOperation(operation: string, duration: number, threshold: number): void {
        this.warn(`Slow ${operation} ${duration}ms (threshold: ${threshold}ms)`);
    }

    warnLargeResponse(endpoint: string, size: number, threshold: number): void {
        this.warn(`Large response ${endpoint} ${size}b (threshold: ${threshold}b)`);
    }

    warnCacheEviction(reason: string, keys: number): void {
        this.warn(`Cache eviction ${reason} ${keys} keys`);
    }

    warnRateLimitApproaching(endpoint: string, remaining: number, resetTime: number): void {
        this.warn(`Rate limit ${endpoint} ${remaining} remaining, resets in ${resetTime}s`);
    }

    warnDeprecatedPackage(packageName: string, version: string): void {
        this.warn(`Deprecated package ${packageName}@${version}`);
    }

    warnMissingDependency(packageName: string, requiredBy: string): void {
        this.warn(`Missing dependency ${packageName} required by ${requiredBy}`);
    }

    warnVersionMismatch(packageName: string, expected: string, actual: string): void {
        this.warn(`Version mismatch ${packageName} expected:${expected} actual:${actual}`);
    }

    warnConfigurationIssue(setting: string, value: any, suggestion: string): void {
        this.warn(`Config issue ${setting}=${value} suggest:${suggestion}`);
    }

    errorApiFailure(endpoint: string, status: number, error: string): void {
        this.error(`API failure ${endpoint} ${status} ${error}`);
    }

    errorNetworkTimeout(endpoint: string, timeout: number): void {
        this.error(`Network timeout ${endpoint} ${timeout}ms`);
    }

    errorParseFailure(file: string, line: number, error: string): void {
        this.error(`Parse failure ${file}:${line} ${error}`);
    }

    errorCacheCorruption(key: string, error: string): void {
        this.error(`Cache corruption ${key} ${error}`);
    }

    errorFileSystemAccess(path: string, operation: string, error: string): void {
        this.error(`FS error ${operation} ${path} ${error}`);
    }

    errorValidationFailure(item: string, field: string, value: any): void {
        this.error(`Validation failure ${item}.${field}=${value}`);
    }

    errorResourceExhaustion(resource: string, limit: number, current: number): void {
        this.error(`Resource exhaustion ${resource} ${current}/${limit}`);
    }

    errorUnexpectedState(component: string, state: string, expected: string): void {
        this.error(`Unexpected state ${component} ${state} expected:${expected}`);
    }

    show(): void {
        this.outputChannel.show();
    }

    dispose(): void {
        this.outputChannel.dispose();
    }
}
