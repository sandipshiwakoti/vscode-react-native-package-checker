import { API_BASE_URL, API_CONFIG, EXTENSION_CONFIG } from '../constants';
import { NewArchSupportStatus, PackageInfo, PackageInfoMap, PackageResponse } from '../types';

import { LoadingNotificationService } from './loadingNotificationService';
import { NpmRegistryService } from './npmRegistryService';

export class PackageService {
    private cache = new Map<string, PackageInfo>();
    private cacheExpiry = new Map<string, number>();

    constructor(
        private npmRegistryService: NpmRegistryService,
        private loadingNotificationService: LoadingNotificationService
    ) {}

    async checkPackages(
        packageWithVersions: string[],
        onVersionsReady?: () => void,
        showLatestVersion: boolean = true
    ): Promise<PackageInfoMap> {
        if (!packageWithVersions?.length) {
            return {};
        }

        const uncachedPackages = packageWithVersions.filter((pkg) => {
            const packageName = this.extractPackageName(pkg);
            return !this.isCached(packageName);
        });

        if (uncachedPackages.length === 0) {
            const cachedResults = this.getCachedResultsByVersions(packageWithVersions);
            this.populateCurrentVersions(cachedResults, packageWithVersions);
            await this.handleVersionsAndCallback(
                cachedResults,
                packageWithVersions,
                showLatestVersion,
                onVersionsReady
            );
            return cachedResults;
        }

        let loadingDisposable: any = null;

        try {
            loadingDisposable = this.loadingNotificationService.showLoading(`Fetching package information...`);
            const data = await this.fetchPackageData(uncachedPackages);
            this.updateCache(data.packages);

            const results = this.getCachedResultsByVersions(packageWithVersions);
            this.populateCurrentVersions(results, packageWithVersions);
            await this.handleVersionsAndCallback(results, packageWithVersions, showLatestVersion, onVersionsReady);
            return results;
        } catch (error) {
            console.error('Failed to check packages:', error);
            const cachedResults = this.getCachedResultsByVersions(packageWithVersions);
            this.populateCurrentVersions(cachedResults, packageWithVersions);

            if (Object.keys(cachedResults).length === 0) {
                throw error;
            }

            try {
                await this.handleVersionsAndCallback(
                    cachedResults,
                    packageWithVersions,
                    showLatestVersion,
                    onVersionsReady
                );
            } catch (versionError) {
                console.error('Failed to fetch version information:', versionError);
            }

            return cachedResults;
        } finally {
            if (loadingDisposable) {
                this.loadingNotificationService.hideLoading(loadingDisposable);
            }
        }
    }

    private async handleVersionsAndCallback(
        results: PackageInfoMap,
        packageWithVersions: string[],
        showLatestVersion: boolean,
        onVersionsReady?: () => void
    ): Promise<void> {
        try {
            if (showLatestVersion) {
                await this.enrichWithVersionInfo(results, packageWithVersions);
            }
        } finally {
            onVersionsReady?.();
        }
    }

    public extractPackageName(packageWithVersion: string): string {
        const lastAtIndex = packageWithVersion.lastIndexOf('@');
        if (lastAtIndex === -1 || lastAtIndex === 0) {
            return packageWithVersion;
        }
        return packageWithVersion.substring(0, lastAtIndex);
    }

    public clearCache(): void {
        this.cache.clear();
        this.cacheExpiry.clear();
    }

    private async fetchPackageData(packages: string[]): Promise<PackageResponse> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(`${API_BASE_URL}${API_CONFIG.ENDPOINT_PACKAGE_INFO}`, {
                method: API_CONFIG.METHOD_POST,
                headers: { [API_CONFIG.HEADER_CONTENT_TYPE]: API_CONFIG.CONTENT_TYPE_JSON },
                body: JSON.stringify({ packages }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error response:', errorText);
                throw new Error(`API request failed: ${response.status}`);
            }

            const packageResponse = (await response.json()) as PackageResponse;

            Object.entries(packageResponse.packages).forEach(([, packageInfo]) => {
                if (!packageInfo.newArchitecture && packageInfo.error) {
                    packageInfo.newArchitecture = NewArchSupportStatus.Unlisted;
                }
            });

            return packageResponse;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    public getCachedResultsByVersions(packageWithVersions: string[]): PackageInfoMap {
        return packageWithVersions.reduce((result, pkg) => {
            const packageName = this.extractPackageName(pkg);
            const cached = this.cache.get(packageName);
            if (cached) {
                result[packageName] = cached;
            }
            return result;
        }, {} as PackageInfoMap);
    }

    private isCached(packageName: string): boolean {
        const expiry = this.cacheExpiry.get(packageName);
        if (!expiry || Date.now() > expiry) {
            this.cache.delete(packageName);
            this.cacheExpiry.delete(packageName);
            return false;
        }
        return this.cache.has(packageName);
    }

    private updateCache(packages: PackageInfoMap): void {
        const now = Date.now();
        Object.entries(packages).forEach(([name, info]) => {
            this.cache.set(name, info);
            this.cacheExpiry.set(name, now + EXTENSION_CONFIG.CACHE_TIMEOUT);
        });
    }

    private populateCurrentVersions(packageInfos: PackageInfoMap, packageWithVersions: string[]): void {
        packageWithVersions.forEach((pkgWithVersion) => {
            const packageName = this.extractPackageName(pkgWithVersion);
            const currentVersion = this.extractVersion(pkgWithVersion);
            const packageInfo = packageInfos[packageName];

            if (packageInfo) {
                packageInfo.currentVersion = currentVersion;

                if (!packageInfo.newArchitecture && packageInfo.error) {
                    packageInfo.newArchitecture = NewArchSupportStatus.Unlisted;
                }
            }
        });
    }

    private async enrichWithVersionInfo(packageInfos: PackageInfoMap, packageWithVersions: string[]): Promise<void> {
        const packagesNeedingVersionCheck = packageWithVersions.filter((pkg) => {
            const packageName = this.extractPackageName(pkg);
            const packageInfo = packageInfos[packageName];
            return packageInfo && !packageInfo.versionFetchError;
        });

        if (packagesNeedingVersionCheck.length === 0) {
            return;
        }

        const packagesWithoutLatestVersion = packagesNeedingVersionCheck.filter((pkg) => {
            const packageName = this.extractPackageName(pkg);
            const packageInfo = packageInfos[packageName];
            return !packageInfo.latestVersion;
        });

        let versionLoadingDisposable: any = null;
        let latestVersions: Record<string, string> = {};

        if (packagesWithoutLatestVersion.length > 0) {
            const packageNames = packagesWithoutLatestVersion.map((pkg) => this.extractPackageName(pkg));

            try {
                versionLoadingDisposable = this.loadingNotificationService.showLoadingForPackages(packageNames);
                latestVersions = await this.npmRegistryService.fetchLatestVersions(packageNames);
            } catch (error) {
                console.error('Failed to fetch version information:', error);
                packageNames.forEach((packageName) => {
                    if (packageInfos[packageName]) {
                        packageInfos[packageName].versionFetchError = 'Failed to fetch version information';
                    }
                });
                return;
            } finally {
                if (versionLoadingDisposable) {
                    this.loadingNotificationService.hideLoading(versionLoadingDisposable);
                }
            }
        }

        packagesNeedingVersionCheck.forEach((pkgWithVersion) => {
            const packageName = this.extractPackageName(pkgWithVersion);
            const currentVersion = this.extractVersion(pkgWithVersion);
            const packageInfo = packageInfos[packageName];

            if (packageInfo) {
                const latestVersion = latestVersions[packageName] || packageInfo.latestVersion;
                if (latestVersion) {
                    packageInfo.latestVersion = latestVersion;
                    packageInfo.currentVersion = currentVersion;
                    packageInfo.hasUpdate = this.hasVersionUpdate(currentVersion, latestVersion);
                }
            }
        });
    }

    private extractVersion(packageWithVersion: string): string {
        const parts = packageWithVersion.split('@');
        return parts[parts.length - 1] || '';
    }

    private hasVersionUpdate(currentVersion: string, latestVersion: string): boolean {
        if (!currentVersion || !latestVersion) {
            return false;
        }
        const cleanCurrent = currentVersion.replace(/^[\^~]/, '');
        const cleanLatest = latestVersion.replace(/^[\^~]/, '');
        return this.compareVersions(cleanLatest, cleanCurrent) > 0;
    }

    private compareVersions(version1: string, version2: string): number {
        const v1Parts = version1.split('.').map(Number);
        const v2Parts = version2.split('.').map(Number);
        const maxLength = Math.max(v1Parts.length, v2Parts.length);

        for (let i = 0; i < maxLength; i++) {
            const v1Part = v1Parts[i] || 0;
            const v2Part = v2Parts[i] || 0;
            if (v1Part > v2Part) {
                return 1;
            }
            if (v1Part < v2Part) {
                return -1;
            }
        }
        return 0;
    }

    updatePackageVersionInCache(packageName: string, newVersion: string): void {
        const cachedPackage = this.cache.get(packageName);
        if (cachedPackage) {
            cachedPackage.currentVersion = newVersion;
            cachedPackage.hasUpdate = false;
            this.cache.set(packageName, cachedPackage);
        }
    }
}
