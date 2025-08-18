import { NPM_REGISTRY_CONFIG } from '../constants';

export interface NpmPackageResponse {
    'dist-tags': {
        latest: string;
    };
    versions: Record<string, any>;
}

export class NpmRegistryService {
    private versionCache = new Map<string, string>();
    private cacheExpiry = new Map<string, number>();

    async fetchLatestVersion(packageName: string): Promise<string> {
        if (this.isCached(packageName)) {
            return this.versionCache.get(packageName)!;
        }

        try {
            const response = await fetch(`${NPM_REGISTRY_CONFIG.BASE_URL}/${encodeURIComponent(packageName)}`);

            if (!response.ok) {
                throw new Error(`NPM registry request failed: ${response.status}`);
            }

            const data = (await response.json()) as NpmPackageResponse;
            const latestVersion = data['dist-tags'].latest;

            this.updateCache(packageName, latestVersion);
            return latestVersion;
        } catch (error) {
            console.error(`Failed to fetch latest version for ${packageName}:`, error);
            throw error;
        }
    }

    async fetchLatestVersions(packageNames: string[]): Promise<Record<string, string>> {
        const results: Record<string, string> = {};
        const uncachedPackages = packageNames.filter((name) => !this.isCached(name));

        packageNames.forEach((name) => {
            if (this.isCached(name)) {
                results[name] = this.versionCache.get(name)!;
            }
        });

        if (uncachedPackages.length === 0) {
            return results;
        }

        const fetchPromises = uncachedPackages.map(async (packageName) => {
            try {
                const version = await this.fetchLatestVersion(packageName);
                return { packageName, version };
            } catch (error) {
                console.error(`Failed to fetch version for ${packageName}:`, error);
                return { packageName, version: null };
            }
        });

        const fetchResults = await Promise.allSettled(fetchPromises);

        fetchResults.forEach((result) => {
            if (result.status === 'fulfilled' && result.value.version) {
                results[result.value.packageName] = result.value.version;
            }
        });

        return results;
    }

    private isCached(packageName: string): boolean {
        const expiry = this.cacheExpiry.get(packageName);
        if (!expiry || Date.now() > expiry) {
            this.versionCache.delete(packageName);
            this.cacheExpiry.delete(packageName);
            return false;
        }
        return this.versionCache.has(packageName);
    }

    private updateCache(packageName: string, version: string): void {
        const now = Date.now();
        this.versionCache.set(packageName, version);
        this.cacheExpiry.set(packageName, now + NPM_REGISTRY_CONFIG.CACHE_TIMEOUT);
    }

    clearCache(): void {
        this.versionCache.clear();
        this.cacheExpiry.clear();
    }
}
