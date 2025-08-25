import { PackageChange } from '../types';
import { hasVersionUpdate } from '../utils/versionUtils';

import { LoggerService } from './loggerService';

export { PackageChange };

export class CacheManagerService {
    private packageCache = new Map<string, any>();
    private versionCache = new Map<string, string>();

    constructor(private logger: LoggerService) {}

    getPackageInfo(packageName: string): any | null {
        const result = this.packageCache.get(packageName) || null;
        return result;
    }

    setPackageInfo(packageName: string, info: any): void {
        this.packageCache.set(packageName, info);
    }

    updatePackageInfo(packageName: string, updates: any): boolean {
        const existing = this.packageCache.get(packageName);
        if (existing) {
            this.packageCache.set(packageName, { ...existing, ...updates });
            return true;
        }
        return false;
    }

    removePackageInfo(packageName: string): void {
        this.packageCache.delete(packageName);
    }

    getMultiplePackageInfos(packageNames: string[]): Record<string, any> {
        const result: Record<string, any> = {};
        packageNames.forEach((name) => {
            const info = this.packageCache.get(name);
            if (info) {
                result[name] = info;
            }
        });
        return result;
    }

    setMultiplePackageInfos(packages: Record<string, any>): void {
        Object.entries(packages).forEach(([name, info]) => {
            this.packageCache.set(name, info);
        });
    }

    getUncachedPackages(packageNames: string[]): string[] {
        return packageNames.filter((name) => !this.packageCache.has(name));
    }

    getPackageVersion(packageName: string): string | null {
        return this.versionCache.get(packageName) || null;
    }

    setPackageVersion(packageName: string, version: string): void {
        this.versionCache.set(packageName, version);
    }

    removePackageVersion(packageName: string): void {
        this.versionCache.delete(packageName);
    }

    getMultiplePackageVersions(packageNames: string[]): Record<string, string> {
        const result: Record<string, string> = {};
        packageNames.forEach((name) => {
            const version = this.versionCache.get(name);
            if (version) {
                result[name] = version;
            }
        });
        return result;
    }

    setMultiplePackageVersions(versions: Record<string, string>): void {
        Object.entries(versions).forEach(([name, version]) => {
            this.versionCache.set(name, version);
        });
    }

    getUncachedVersions(packageNames: string[]): string[] {
        return packageNames.filter((name) => !this.versionCache.has(name));
    }

    needsVersionCheck(packageName: string): boolean {
        return !this.versionCache.has(packageName);
    }

    getLatestVersion(packageName: string): string | null {
        return this.versionCache.get(packageName) || null;
    }

    handlePackageChanges(changes: PackageChange[]): void {
        changes.forEach((change) => {
            if (change.type === 'version_changed' && change.newVersion) {
                const existingInfo = this.packageCache.get(change.packageName);
                if (existingInfo && existingInfo.latestVersion) {
                    const hasUpdate = hasVersionUpdate(change.newVersion, existingInfo.latestVersion);
                    this.updatePackageInfo(change.packageName, {
                        currentVersion: change.newVersion,
                        hasUpdate: hasUpdate,
                    });
                } else {
                    this.updatePackageInfo(change.packageName, {
                        currentVersion: change.newVersion,
                    });
                }
            }
        });
    }

    clearPackageCache(): void {
        this.packageCache.clear();
    }

    clearVersionCache(): void {
        this.versionCache.clear();
    }

    clearAllCache(): void {
        this.clearPackageCache();
        this.clearVersionCache();
    }

    getCacheStats() {
        return {
            packageCount: this.packageCache.size,
            versionCount: this.versionCache.size,
            expiredCount: 0,
        };
    }
}
