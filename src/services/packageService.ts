import { API_BASE_URL, API_CONFIG } from '../constants';
import { NewArchSupportStatus, PackageInfo, PackageInfoMap, PackageResponse } from '../types';
import { extractPackageNameFromVersionString, hasVersionUpdate } from '../utils/versionUtils';

import { CacheManagerService, PackageChange } from './cacheManagerService';
import { LoggerService } from './loggerService';
import { NpmRegistryService } from './npmRegistryService';

export class PackageService {
    constructor(
        private npmRegistryService: NpmRegistryService,
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
            try {
                const startTime = Date.now();
                this.logger.logLoadingState('start', 'package info', uncachedPackages);

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
            } catch (error: any) {
                this.logger.error('Failed to fetch package info', { error: error.message, packages: uncachedPackages });
                console.error('Failed to check packages:', error);

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
            try {
                this.logger.info(
                    `Fetching ${uncachedVersionPackages.length} ${uncachedVersionPackages.length === 1 ? 'version' : 'versions'} data`
                );

                const startTime = Date.now();
                this.logger.logLoadingState('start', 'version info', uncachedVersionPackages);

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

        this.logger.logFileChange(changes);

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
                        this.logger.debug(
                            `New dependency: ${change.packageName} - will fetch package data and version data`
                        );
                    } else {
                        addedDevDependencies.push(change.packageName);
                        this.logger.debug(`New devDependency: ${change.packageName} - will fetch version data only`);
                    }
                    break;
            }
        }

        if (addedDependencies.length > 0) {
            this.logger.debug(
                `Processing ${addedDependencies.length} added dependencies: ${addedDependencies.join(', ')}`
            );
            await this.fetchMultiplePackages(addedDependencies);
        }

        if (addedDevDependencies.length > 0) {
            this.logger.debug(
                `Processing ${addedDevDependencies.length} added devDependencies: ${addedDevDependencies.join(', ')}`
            );
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
                this.cacheManager.setPackageInfo(packageName, {
                    npmUrl: '',
                    latestVersion: version || '',
                    newArchitecture: NewArchSupportStatus.Unlisted,
                    ...(version ? {} : { versionFetchError: 'Package not found on npm registry' }),
                });
            });

            const duration = Date.now() - startTime;
            const successCount = Object.keys(latestVersions).length;

            if (successCount > 0) {
                this.logger.info(
                    `Fetched ${successCount} ${successCount === 1 ? 'version' : 'versions'} data (${duration}ms)`
                );
            } else {
                this.logger.debug(`No versions found for ${packageNames.length} packages (${duration}ms)`);
            }
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
            const unlistedPackages: string[] = [];

            Object.entries(packageData.packages).forEach(([packageName, packageInfo]) => {
                foundPackages[packageName] = packageInfo;
            });

            packageNames.forEach((packageName) => {
                if (!foundPackages[packageName]) {
                    unlistedPackages.push(packageName);
                    foundPackages[packageName] = {
                        npmUrl: '',
                        latestVersion: '',
                        newArchitecture: NewArchSupportStatus.Unlisted,
                    };
                }
            });

            this.cacheManager.setMultiplePackageInfos(foundPackages);
            const duration = Date.now() - startTime;

            this.logger.info(
                `Fetched ${packageNames.length} ${packageNames.length === 1 ? 'package' : 'packages'} data (${duration}ms)`
            );

            if (unlistedPackages.length > 0) {
                this.logger.debug(`Found ${unlistedPackages.length} unlisted packages: ${unlistedPackages.join(', ')}`);
            }

            const packagesNeedingVersions = packageNames.filter((packageName) => {
                return !this.cacheManager.getPackageVersion(packageName);
            });

            if (packagesNeedingVersions.length > 0) {
                try {
                    this.logger.info(
                        `Fetching ${packagesNeedingVersions.length} ${packagesNeedingVersions.length === 1 ? 'version' : 'versions'} data`
                    );

                    const versionStartTime = Date.now();
                    const latestVersions = await this.npmRegistryService.fetchLatestVersions(packagesNeedingVersions);
                    this.cacheManager.setMultiplePackageVersions(latestVersions);

                    packagesNeedingVersions.forEach((packageName) => {
                        const version = latestVersions[packageName];
                        if (version) {
                            this.cacheManager.updatePackageInfo(packageName, {
                                latestVersion: version,
                            });
                            this.logger.debug(`Updated ${packageName} with version ${version}`);
                        } else {
                            this.cacheManager.updatePackageInfo(packageName, {
                                versionFetchError: 'Package not found on npm registry',
                            });
                            this.logger.debug(`Package ${packageName} not found on npm registry`);
                        }
                    });

                    const versionDuration = Date.now() - versionStartTime;
                    const successCount = Object.keys(latestVersions).length;

                    if (successCount > 0) {
                        this.logger.info(
                            `Fetched ${successCount} ${successCount === 1 ? 'version' : 'versions'} data (${versionDuration}ms)`
                        );
                    } else {
                        this.logger.debug(
                            `No versions found for ${packagesNeedingVersions.length} packages (${versionDuration}ms)`
                        );
                    }
                } catch (versionError) {
                    this.logger.debug(`Failed to fetch versions for bulk packages: ${versionError}`);
                    packagesNeedingVersions.forEach((packageName) => {
                        this.cacheManager.updatePackageInfo(packageName, {
                            versionFetchError: 'Failed to fetch version information',
                        });
                    });
                }
            }
        } catch (error: any) {
            this.logger.debug(`Failed to fetch bulk packages: ${error.message}`);

            const packagesNeedingVersions = packageNames.filter((packageName) => {
                return !this.cacheManager.getPackageVersion(packageName);
            });

            if (packagesNeedingVersions.length > 0) {
                try {
                    this.logger.info(
                        `Package API failed, attempting to fetch versions for ${packagesNeedingVersions.length} packages`
                    );
                    const latestVersions = await this.npmRegistryService.fetchLatestVersions(packagesNeedingVersions);

                    packageNames.forEach((packageName) => {
                        const version = latestVersions[packageName];
                        this.cacheManager.setPackageInfo(packageName, {
                            npmUrl: '',
                            latestVersion: version || '',
                            newArchitecture: NewArchSupportStatus.Unlisted,
                            ...(version ? {} : { versionFetchError: 'Failed to fetch version information' }),
                        });
                    });

                    const successCount = Object.keys(latestVersions).length;
                    if (successCount > 0) {
                        this.cacheManager.setMultiplePackageVersions(latestVersions);
                        this.logger.info(
                            `Fallback: fetched ${successCount} ${successCount === 1 ? 'version' : 'versions'} data`
                        );
                    } else {
                        this.logger.debug(`Fallback: no versions found for ${packagesNeedingVersions.length} packages`);
                    }
                } catch {
                    packageNames.forEach((packageName) => {
                        this.cacheManager.setPackageInfo(packageName, {
                            npmUrl: '',
                            error: `Failed to fetch: ${error.message}`,
                            newArchitecture: NewArchSupportStatus.Unlisted,
                        });
                    });
                }
            } else {
                packageNames.forEach((packageName) => {
                    this.cacheManager.setPackageInfo(packageName, {
                        npmUrl: '',
                        error: `Failed to fetch: ${error.message}`,
                        newArchitecture: NewArchSupportStatus.Unlisted,
                    });
                });
            }
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
