import { NPM_REGISTRY_CONFIG } from '../constants';

export interface NpmPackageResponse {
    'dist-tags': {
        latest: string;
    };
    versions: Record<string, any>;
}

export class NpmRegistryService {
    private async fetchWithTimeout(url: string, timeoutMs: number = 5000): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    Accept: 'application/json',
                },
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    async fetchLatestVersion(packageName: string): Promise<string> {
        try {
            const response = await this.fetchWithTimeout(
                `${NPM_REGISTRY_CONFIG.BASE_URL}/${encodeURIComponent(packageName)}/latest`
            );

            if (!response.ok) {
                throw new Error(`NPM registry request failed: ${response.status}`);
            }

            const data: any = await response.json();
            const latestVersion = data.version;

            return latestVersion;
        } catch (error) {
            console.error(`Failed to fetch latest version for ${packageName}:`, error);
            throw error;
        }
    }

    async fetchLatestVersions(packageNames: string[]): Promise<Record<string, string>> {
        const results: Record<string, string> = {};

        const fetchPromises = packageNames.map(async (packageName) => {
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
}
