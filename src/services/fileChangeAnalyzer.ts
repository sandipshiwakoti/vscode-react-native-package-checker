import { PackageChange } from './cacheManagerService';
import { LoggerService } from './loggerService';

export interface PackageJsonDiff {
    added: Record<string, string>;
    removed: Record<string, string>;
    updated: Record<string, { from: string; to: string }>;
    versionChanged: Record<string, { from: string; to: string }>;
}

export class FileChangeAnalyzer {
    constructor(private logger: LoggerService) {}

    analyzePackageJsonChanges(oldContent: string, newContent: string): PackageChange[] {
        try {
            if (!this.hasDependencyChanges(oldContent, newContent)) {
                this.logger.debug('No dependency changes detected, skipping analysis');
                return [];
            }

            const oldPackages = this.extractPackages(oldContent);
            const newPackages = this.extractPackages(newContent);

            const diff = this.calculateDiff(oldPackages, newPackages);
            const changes = this.convertDiffToChanges(diff);

            this.logger.debug('Package.json changes analyzed', {
                diff,
                changeCount: changes.length,
            });

            return changes;
        } catch (error: any) {
            this.logger.error('Failed to analyze package.json changes', { error: error.message });
            return [];
        }
    }

    private hasDependencyChanges(oldContent: string, newContent: string): boolean {
        try {
            const oldJson = JSON.parse(oldContent);
            const newJson = JSON.parse(newContent);

            const oldDeps = JSON.stringify({
                dependencies: oldJson.dependencies || {},
                devDependencies: oldJson.devDependencies || {},
            });
            const newDeps = JSON.stringify({
                dependencies: newJson.dependencies || {},
                devDependencies: newJson.devDependencies || {},
            });

            const hasChanges = oldDeps !== newDeps;

            if (!hasChanges) {
                this.logger.debug('No dependency changes detected - other package.json fields changed');
            }

            return hasChanges;
        } catch {
            this.logger.debug('Could not parse package.json content, assuming changes exist');
            return true;
        }
    }

    private extractPackages(content: string): Record<string, string> {
        try {
            const packageJson = JSON.parse(content);
            const dependencies = packageJson.dependencies || {};
            const devDependencies = packageJson.devDependencies || {};

            return { ...dependencies, ...devDependencies };
        } catch {
            return {};
        }
    }

    private calculateDiff(oldPackages: Record<string, string>, newPackages: Record<string, string>): PackageJsonDiff {
        const added: Record<string, string> = {};
        const removed: Record<string, string> = {};
        const updated: Record<string, { from: string; to: string }> = {};
        const versionChanged: Record<string, { from: string; to: string }> = {};

        for (const [packageName, version] of Object.entries(newPackages)) {
            if (!(packageName in oldPackages)) {
                added[packageName] = version;
            }
        }

        for (const [packageName, version] of Object.entries(oldPackages)) {
            if (!(packageName in newPackages)) {
                removed[packageName] = version;
            }
        }

        for (const [packageName, newVersion] of Object.entries(newPackages)) {
            const oldVersion = oldPackages[packageName];
            if (oldVersion && oldVersion !== newVersion) {
                const cleanOldVersion = this.cleanVersion(oldVersion);
                const cleanNewVersion = this.cleanVersion(newVersion);

                if (cleanOldVersion !== cleanNewVersion) {
                    versionChanged[packageName] = { from: oldVersion, to: newVersion };
                }
            }
        }

        return { added, removed, updated, versionChanged };
    }

    private cleanVersion(version: string): string {
        return version.replace(/^[\^~]/, '');
    }

    private convertDiffToChanges(diff: PackageJsonDiff): PackageChange[] {
        const changes: PackageChange[] = [];

        for (const [packageName, version] of Object.entries(diff.added)) {
            changes.push({
                type: 'added',
                packageName,
                newVersion: version,
            });
        }

        for (const [packageName, version] of Object.entries(diff.removed)) {
            changes.push({
                type: 'removed',
                packageName,
                oldVersion: version,
            });
        }

        for (const [packageName, { from, to }] of Object.entries(diff.versionChanged)) {
            changes.push({
                type: 'version_changed',
                packageName,
                oldVersion: from,
                newVersion: to,
            });
        }

        return changes;
    }

    requiresApiCall(changes: PackageChange[]): boolean {
        return changes.some((change) => change.type === 'added' || change.type === 'updated');
    }

    getPackagesNeedingFetch(changes: PackageChange[]): string[] {
        return changes
            .filter((change) => change.type === 'added' || change.type === 'updated')
            .map((change) => change.packageName);
    }
}
