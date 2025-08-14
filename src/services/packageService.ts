import { CACHE_TIMEOUT, API_BASE_URL } from '../constants';
import { PackageResponse, PackageInfo, PackageInfoMap } from '../types';

export class PackageService {
    private cache = new Map<string, PackageInfo>();
    private cacheExpiry = new Map<string, number>();

    async checkPackages(packageWithVersions: string[]): Promise<PackageInfoMap> {
        const uncachedPackages = packageWithVersions.filter(pkg => {
            const packageName = this.extractPackageName(pkg);
            return !this.isCached(packageName);
        });

        if (uncachedPackages.length === 0) {
            return this.getCachedResultsByVersions(packageWithVersions);
        }

        try {
            const data = await this.fetchPackageData(uncachedPackages);
            this.updateCache(data.packages);
            return this.getCachedResultsByVersions(packageWithVersions);
        } catch (error) {
            console.error('Failed to check packages:', error);
            return this.getCachedResultsByVersions(packageWithVersions);
        }
    }

    private extractPackageName(packageWithVersion: string): string {
        return packageWithVersion.split('@').slice(0, -1).join('@') || packageWithVersion;
    }

    private async fetchPackageData(packages: string[]): Promise<PackageResponse> {
        const response = await fetch(`${API_BASE_URL}/package-info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ packages })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error response:', errorText);
            throw new Error(`API request failed: ${response.status}`);
        }

        return response.json() as Promise<PackageResponse>;
    }

    private getCachedResultsByVersions(packageWithVersions: string[]): PackageInfoMap {
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
            this.cacheExpiry.set(name, now + CACHE_TIMEOUT);
        });
    }

    clearCache(): void {
        this.cache.clear();
        this.cacheExpiry.clear();
    }
}