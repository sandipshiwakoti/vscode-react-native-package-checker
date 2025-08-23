import { EXTENSION_CONFIG, NPM_REGISTRY_CONFIG } from '../constants';
import { PackageInfo, PackageInfoMap } from '../types';
import { compareVersions } from '../utils/versionUtils';

export interface CacheEntry<T> {
    data: T;
    expiry: number;
}

export interface PackageChange {
    type: 'added' | 'removed' | 'updated' | 'version_changed';
    packageName: string;
    oldVersion?: string;
    newVersion?: string;
}

export class CacheManagerService {
    private packageCache = new Map<string, CacheEntry<PackageInfo>>();
    private versionCache = new Map<string, CacheEntry<string>>();

    getPackageInfo(packageName: string): PackageInfo | null {
        const entry = this.packageCache.get(packageName);
        if (!entry || Date.now() > entry.expiry) {
            this.packageCache.delete(packageName);
            return null;
        }
        return entry.data;
    }

    setPackageInfo(packageName: string, packageInfo: PackageInfo): void {
        const expiry = Date.now() + EXTENSION_CONFIG.CACHE_TIMEOUT;
        this.packageCache.set(packageName, { data: packageInfo, expiry });
    }

    updatePackageInfo(packageName: string, updates: Partial<PackageInfo>): boolean {
        const entry = this.packageCache.get(packageName);
        if (!entry || Date.now() > entry.expiry) {
            return false;
        }

        entry.data = { ...entry.data, ...updates };
        return true;
    }

    removePackageInfo(packageName: string): void {
        this.packageCache.delete(packageName);
    }

    getPackageVersion(packageName: string): string | null {
        const entry = this.versionCache.get(packageName);
        if (!entry || Date.now() > entry.expiry) {
            this.versionCache.delete(packageName);
            return null;
        }
        return entry.data;
    }

    setPackageVersion(packageName: string, version: string): void {
        const expiry = Date.now() + NPM_REGISTRY_CONFIG.CACHE_TIMEOUT;
        this.versionCache.set(packageName, { data: version, expiry });
    }

    removePackageVersion(packageName: string): void {
        this.versionCache.delete(packageName);
    }

    getMultiplePackageInfos(packageNames: string[]): PackageInfoMap {
        const result: PackageInfoMap = {};
        for (const packageName of packageNames) {
            const info = this.getPackageInfo(packageName);
            if (info) {
                result[packageName] = info;
            }
        }
        return result;
    }

    setMultiplePackageInfos(packages: PackageInfoMap): void {
        Object.entries(packages).forEach(([name, info]) => {
            this.setPackageInfo(name, info);
        });
    }

    getMultiplePackageVersions(packageNames: string[]): Record<string, string> {
        const result: Record<string, string> = {};
        for (const packageName of packageNames) {
            const version = this.getPackageVersion(packageName);
            if (version) {
                result[packageName] = version;
            }
        }
        return result;
    }

    setMultiplePackageVersions(versions: Record<string, string>): void {
        Object.entries(versions).forEach(([name, version]) => {
            this.setPackageVersion(name, version);
        });
    }

    handlePackageChanges(changes: PackageChange[]): void {
        for (const change of changes) {
            switch (change.type) {
                case 'removed':
                    this.removePackageInfo(change.packageName);
                    this.removePackageVersion(change.packageName);
                    break;

                case 'version_changed':
                    const packageInfo = this.getPackageInfo(change.packageName);
                    if (packageInfo && packageInfo.latestVersion) {
                        const hasUpdate = compareVersions(packageInfo.latestVersion, change.newVersion || '') > 0;
                        this.updatePackageInfo(change.packageName, {
                            currentVersion: change.newVersion,
                            hasUpdate: hasUpdate,
                        });
                    } else {
                        this.updatePackageInfo(change.packageName, {
                            currentVersion: change.newVersion,
                            hasUpdate: false,
                        });
                    }
                    break;

                case 'added':
                    break;

                case 'updated':
                    break;
            }
        }
    }

    getCachedPackageNames(): string[] {
        const now = Date.now();
        const validPackages: string[] = [];

        for (const [packageName, entry] of this.packageCache.entries()) {
            if (now <= entry.expiry) {
                validPackages.push(packageName);
            } else {
                this.packageCache.delete(packageName);
            }
        }

        return validPackages;
    }

    getUncachedPackages(requestedPackages: string[]): string[] {
        return requestedPackages.filter((packageName) => !this.getPackageInfo(packageName));
    }

    getUncachedVersions(requestedPackages: string[]): string[] {
        return requestedPackages.filter((packageName) => !this.getPackageVersion(packageName));
    }

    getCacheStats(): { packageCount: number; versionCount: number; expiredCount: number } {
        const now = Date.now();
        let expiredCount = 0;

        for (const [key, entry] of this.packageCache.entries()) {
            if (now > entry.expiry) {
                this.packageCache.delete(key);
                expiredCount++;
            }
        }

        for (const [key, entry] of this.versionCache.entries()) {
            if (now > entry.expiry) {
                this.versionCache.delete(key);
                expiredCount++;
            }
        }

        return {
            packageCount: this.packageCache.size,
            versionCount: this.versionCache.size,
            expiredCount,
        };
    }

    clearPackageCache(): void {
        this.packageCache.clear();
    }

    clearVersionCache(): void {
        this.versionCache.clear();
    }

    clearAllCache(): void {
        this.packageCache.clear();
        this.versionCache.clear();
    }

    needsVersionCheck(packageName: string): boolean {
        const packageInfo = this.getPackageInfo(packageName);
        if (!packageInfo) {
            return false;
        }

        if (packageInfo.error) {
            return false;
        }

        return !packageInfo.latestVersion;
    }

    getLatestVersion(packageName: string): string | null {
        const packageInfo = this.getPackageInfo(packageName);
        return packageInfo?.latestVersion || null;
    }
}
