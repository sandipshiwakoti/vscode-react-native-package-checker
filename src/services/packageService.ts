import { API_BASE_URL, API_CONFIG } from '../constants';
import { NewArchSupportStatus, PackageInfo, PackageInfoMap, PackageResponse } from '../types';
import { extractPackageNameFromVersionString, hasVersionUpdate } from '../utils/versionUtils';

import { CacheManagerService, PackageChange } from './cacheManagerService';
import { LoadingNotificationService } from './loadingNotificationService';
import { LoggerService } from './loggerService';
import { NpmRegistryService } from './npmRegistryService';

export class PackageService {
    constructor(
        private npmRegistryService: NpmRegistryService,
        private loadingNotificationService: LoadingNotificationService,
        private cacheManager: CacheManagerService,
        private logger: LoggerService
    ) {}

    async checkPackages(
        packageWithVersions: string[],
        onVersionsReady?: () => void,
        showLatestVersion: boolean = true,
        documentContent?: string
    ): Promise<PackageInfoMap> {
        if (!packageWithVersions?.length) {
            return {};
        }

        const packageNames = packageWithVersions.map((pkg) => extractPackageNameFromVersionString(pkg));

        let fetchedPackagesCount = 0;
        let fetchedVersionsCount = 0;

        const depsPackages = documentContent
            ? packageNames.filter((pkg) => this.isDependencyNotDev(pkg, documentContent))
            : packageNames;

        const cachedPackageInfos = this.cacheManager.getMultiplePackageInfos(packageNames);

        let uncachedPackages = this.cacheManager.getUncachedPackages(depsPackages);

        const devDepsPackages = documentContent
            ? packageNames.filter((pkg) => !this.isDependencyNotDev(pkg, documentContent))
            : [];

        devDepsPackages.forEach((packageName) => {
            if (!cachedPackageInfos[packageName]) {
                cachedPackageInfos[packageName] = {
                    npmUrl: '',
                    latestVersion: '',
                    newArchitecture: NewArchSupportStatus.Unlisted,
                };
            }
        });

        if (uncachedPackages.length > 0) {
            this.logger.info(
                `Fetching ${uncachedPackages.length} ${uncachedPackages.length === 1 ? 'package' : 'packages'} data`
            );
        }

        this.populateCurrentVersions(cachedPackageInfos, packageWithVersions);

        let packageInfos = cachedPackageInfos;

        if (uncachedPackages.length > 0) {
            let loadingDisposable: any = null;

            try {
                const startTime = Date.now();
                this.logger.logLoadingState('start', 'package info', uncachedPackages);

                loadingDisposable = this.loadingNotificationService.showLoading(
                    `Fetching information for ${uncachedPackages.length} packages...`
                );

                const data = await this.fetchPackageData(uncachedPackages);

                const foundPackages: PackageInfoMap = {};

                Object.entries(data.packages).forEach(([packageName, packageInfo]) => {
                    foundPackages[packageName] = packageInfo;
                });

                this.cacheManager.setMultiplePackageInfos(foundPackages);

                const duration = Date.now() - startTime;
                this.logger.info(
                    `Fetched ${uncachedPackages.length} ${uncachedPackages.length === 1 ? 'package' : 'packages'} data (${duration}ms)`
                );

                fetchedPackagesCount = uncachedPackages.length;

                packageInfos = { ...packageInfos, ...foundPackages };
                this.populateCurrentVersions(packageInfos, packageWithVersions);

                this.loadingNotificationService.hideLoading(loadingDisposable);
            } catch (error: any) {
                this.logger.error('Failed to fetch package info', { error: error.message, packages: uncachedPackages });
                console.error('Failed to check packages:', error);

                if (loadingDisposable) {
                    this.loadingNotificationService.hideLoading(loadingDisposable);
                }

                if (Object.keys(packageInfos).length === 0) {
                    throw error;
                }
            }
        }

        if (showLatestVersion) {
            fetchedVersionsCount = await this.handleVersionFetching(packageInfos, packageWithVersions);
        }

        if (fetchedPackagesCount > 0 || fetchedVersionsCount > 0) {
            const parts = [];
            if (fetchedPackagesCount > 0) {
                parts.push(`${fetchedPackagesCount} packages`);
            }
            if (fetchedVersionsCount > 0) {
                parts.push(`${fetchedVersionsCount} versions`);
            }
            this.logger.info(`Cached ${parts.join(' and ')} data`);
        }

        onVersionsReady?.();

        return packageInfos;
    }

    private async handleVersionFetching(packageInfos: PackageInfoMap, packageWithVersions: string[]): Promise<number> {
        const allPackageNames = packageWithVersions.map((pkg) => extractPackageNameFromVersionString(pkg));

        const packageNames = allPackageNames;

        const cachedVersions = this.cacheManager.getMultiplePackageVersions(packageNames);
        const uncachedVersionPackages = this.cacheManager.getUncachedVersions(packageNames);

        const packagesNeedingVersionCheck = allPackageNames.filter((packageName) => {
            return this.cacheManager.needsVersionCheck(packageName);
        });

        Object.entries(cachedVersions).forEach(([packageName, version]) => {
            if (packageInfos[packageName]) {
                packageInfos[packageName].latestVersion = version;
                this.updatePackageVersionInfo(packageInfos[packageName], packageWithVersions, packageName);
            } else {
                packageInfos[packageName] = {
                    npmUrl: '',
                    latestVersion: version,
                    newArchitecture: NewArchSupportStatus.Unlisted,
                };
                this.updatePackageVersionInfo(packageInfos[packageName], packageWithVersions, packageName);
            }
        });

        if (packagesNeedingVersionCheck.length > 0 && uncachedVersionPackages.length > 0) {
            let versionLoadingDisposable: any = null;

            try {
                this.logger.info(
                    `Fetching ${uncachedVersionPackages.length} ${uncachedVersionPackages.length === 1 ? 'version' : 'versions'} data`
                );

                const startTime = Date.now();
                this.logger.logLoadingState('start', 'version info', uncachedVersionPackages);

                versionLoadingDisposable =
                    this.loadingNotificationService.showLoadingForPackages(uncachedVersionPackages);

                const latestVersions = await this.npmRegistryService.fetchLatestVersions(uncachedVersionPackages);
                this.cacheManager.setMultiplePackageVersions(latestVersions);
                const duration = Date.now() - startTime;
                this.logger.info(
                    `Fetched ${uncachedVersionPackages.length} ${uncachedVersionPackages.length === 1 ? 'version' : 'versions'} data (${duration}ms)`
                );

                Object.entries(latestVersions).forEach(([packageName, version]) => {
                    if (packageInfos[packageName]) {
                        packageInfos[packageName].latestVersion = version;
                        this.updatePackageVersionInfo(packageInfos[packageName], packageWithVersions, packageName);
                    } else {
                        packageInfos[packageName] = {
                            npmUrl: '',
                            latestVersion: version,
                            newArchitecture: NewArchSupportStatus.Unlisted,
                        };
                        this.updatePackageVersionInfo(packageInfos[packageName], packageWithVersions, packageName);
                    }
                });

                return uncachedVersionPackages.length;
            } catch (error: any) {
                this.logger.error('Failed to fetch version info', {
                    error: error.message,
                    packages: uncachedVersionPackages,
                });
                console.error('Failed to fetch version information:', error);

                uncachedVersionPackages.forEach((packageName) => {
                    if (packageInfos[packageName]) {
                        packageInfos[packageName].versionFetchError = 'Failed to fetch version information';
                    }
                });
                return 0;
            } finally {
                if (versionLoadingDisposable) {
                    this.loadingNotificationService.hideLoading(versionLoadingDisposable);
                }
            }
        }

        return 0;
    }

    private updatePackageVersionInfo(
        packageInfo: PackageInfo,
        packageWithVersions: string[],
        packageName: string
    ): void {
        const pkgWithVersion = packageWithVersions.find(
            (pkg) => extractPackageNameFromVersionString(pkg) === packageName
        );

        if (pkgWithVersion && packageInfo.latestVersion) {
            const currentVersion = this.extractVersion(pkgWithVersion);
            packageInfo.currentVersion = currentVersion;
            packageInfo.hasUpdate = hasVersionUpdate(currentVersion, packageInfo.latestVersion);
        }
    }

    public async handlePackageChanges(changes: PackageChange[], documentContent?: string): Promise<void> {
        if (changes.length === 0) {
            return;
        }

        this.logger.logFileChange('package changes', changes);

        const addedDependencies: string[] = [];
        const addedDevDependencies: string[] = [];

        for (const change of changes) {
            switch (change.type) {
                case 'version_changed':
                    this.cacheManager.handlePackageChanges([change]);
                    this.logger.debug(
                        `Cache updated: ${change.packageName} ${change.oldVersion} → ${change.newVersion}`
                    );
                    break;

                case 'removed':
                    this.cacheManager.removePackageInfo(change.packageName);
                    this.cacheManager.removePackageVersion(change.packageName);
                    this.logger.debug(`Cache removed: ${change.packageName}`);
                    break;

                case 'added':
                    if (documentContent && this.isDependencyNotDev(change.packageName, documentContent)) {
                        addedDependencies.push(change.packageName);
                        this.logger.debug(`New dependency: ${change.packageName} - will fetch package data`);
                    } else {
                        addedDevDependencies.push(change.packageName);
                        this.logger.debug(`New devDependency: ${change.packageName} - will fetch version data only`);
                    }
                    break;
            }
        }

        if (addedDependencies.length > 0) {
            await this.fetchMultiplePackages(addedDependencies);
        }

        if (addedDevDependencies.length > 0) {
            await this.fetchVersionsOnly(addedDevDependencies);
        }
    }

    private async fetchVersionsOnly(packageNames: string[]): Promise<void> {
        try {
            this.logger.info(
                `Fetching ${packageNames.length} ${packageNames.length === 1 ? 'version' : 'versions'} data`
            );

            const startTime = Date.now();
            const latestVersions = await this.npmRegistryService.fetchLatestVersions(packageNames);
            this.cacheManager.setMultiplePackageVersions(latestVersions);

            packageNames.forEach((packageName) => {
                const version = latestVersions[packageName];
                if (version) {
                    this.cacheManager.setPackageInfo(packageName, {
                        npmUrl: '',
                        latestVersion: version,
                        newArchitecture: NewArchSupportStatus.Unlisted,
                    });
                }
            });

            const duration = Date.now() - startTime;

            this.logger.info(
                `Fetched ${packageNames.length} ${packageNames.length === 1 ? 'version' : 'versions'} data (${duration}ms)`
            );
        } catch (error: any) {
            this.logger.debug(`Failed to fetch versions for devDependencies: ${error.message}`);
            packageNames.forEach((packageName) => {
                this.cacheManager.setPackageInfo(packageName, {
                    npmUrl: '',
                    latestVersion: '',
                    versionFetchError: `Failed to fetch version: ${error.message}`,
                    newArchitecture: NewArchSupportStatus.Unlisted,
                });
            });
        }
    }

    private async fetchMultiplePackages(packageNames: string[]): Promise<void> {
        try {
            this.logger.info(
                `Fetching ${packageNames.length} ${packageNames.length === 1 ? 'package' : 'packages'} data`
            );

            const startTime = Date.now();
            const packageData = await this.fetchPackageData(packageNames);

            const foundPackages: PackageInfoMap = {};
            Object.entries(packageData.packages).forEach(([packageName, packageInfo]) => {
                foundPackages[packageName] = packageInfo;
            });

            this.cacheManager.setMultiplePackageInfos(foundPackages);
            const duration = Date.now() - startTime;

            this.logger.info(
                `Fetched ${packageNames.length} ${packageNames.length === 1 ? 'package' : 'packages'} data (${duration}ms)`
            );

            const validPackages = packageNames.filter((name) => {
                const info = foundPackages[name];
                return info && !info.error;
            });

            if (validPackages.length > 0) {
                try {
                    this.logger.info(
                        `Fetching ${validPackages.length} ${validPackages.length === 1 ? 'version' : 'versions'} data`
                    );

                    const versionStartTime = Date.now();
                    const latestVersions = await this.npmRegistryService.fetchLatestVersions(validPackages);
                    this.cacheManager.setMultiplePackageVersions(latestVersions);
                    const versionDuration = Date.now() - versionStartTime;

                    this.logger.info(
                        `Fetched ${validPackages.length} ${validPackages.length === 1 ? 'version' : 'versions'} data (${versionDuration}ms)`
                    );
                } catch (versionError) {
                    this.logger.debug(`Failed to fetch versions for bulk packages: ${versionError}`);
                }
            }
        } catch (error: any) {
            this.logger.debug(`Failed to fetch bulk packages: ${error.message}`);
            packageNames.forEach((packageName) => {
                this.cacheManager.setPackageInfo(packageName, {
                    npmUrl: '',
                    error: `Failed to fetch: ${error.message}`,
                    newArchitecture: NewArchSupportStatus.Unlisted,
                });
            });
        }
    }

    public updatePackageVersionInCache(packageName: string, newVersion: string): void {
        const updated = this.cacheManager.updatePackageInfo(packageName, {
            currentVersion: newVersion,
            hasUpdate: false,
        });

        if (updated) {
            this.logger.logCacheUpdate('version updated', [packageName]);
        }
    }

    public clearCache(): void {
        this.logger.debug('Cache cleared');
        this.cacheManager.clearAllCache();
    }

    public getCachedResultsByVersions(packageWithVersions: string[]): PackageInfoMap {
        const packageNames = packageWithVersions.map((pkg) => extractPackageNameFromVersionString(pkg));
        const results = this.cacheManager.getMultiplePackageInfos(packageNames);
        this.populateCurrentVersions(results, packageWithVersions);
        return results;
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
                if (!packageInfo.newArchitecture) {
                    packageInfo.newArchitecture = NewArchSupportStatus.Unlisted;
                }
            });

            return packageResponse;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    private populateCurrentVersions(packageInfos: PackageInfoMap, packageWithVersions: string[]): void {
        packageWithVersions.forEach((pkgWithVersion) => {
            const packageName = extractPackageNameFromVersionString(pkgWithVersion);
            const currentVersion = this.extractVersion(pkgWithVersion);
            const packageInfo = packageInfos[packageName];

            if (packageInfo) {
                packageInfo.currentVersion = currentVersion;

                if (packageInfo.latestVersion) {
                    packageInfo.hasUpdate = hasVersionUpdate(currentVersion, packageInfo.latestVersion);
                }

                if (!packageInfo.newArchitecture) {
                    packageInfo.newArchitecture = NewArchSupportStatus.Unlisted;
                }
            }
        });
    }

    private extractVersion(packageWithVersion: string): string {
        const parts = packageWithVersion.split('@');
        return parts[parts.length - 1] || '';
    }

    private isDependencyNotDev(packageName: string, documentContent: string): boolean {
        try {
            const packageJson = JSON.parse(documentContent);
            const dependencies = packageJson.dependencies || {};
            const isDep = dependencies[packageName] !== undefined;

            return isDep;
        } catch {
            return true;
        }
    }

    public getCacheStats() {
        return this.cacheManager.getCacheStats();
    }

    public getCachedVersion(packageName: string): string | null {
        return this.cacheManager.getLatestVersion(packageName);
    }
}
