import { NPM_REGISTRY_CONFIG } from '../constants';
import { CONTENT_TYPES, HTTP_HEADERS } from '../types';

import { LoggerService } from './loggerService';

export class NpmRegistryService {
    constructor(private logger: LoggerService) {}

    private async fetchWithTimeout(url: string, timeoutMs: number = 5000): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    [HTTP_HEADERS.ACCEPT]: CONTENT_TYPES.JSON,
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
        const startTime = Date.now();
        const url = `${NPM_REGISTRY_CONFIG.BASE_URL}/${encodeURIComponent(packageName)}/latest`;

        try {
            this.logger.debugApiRequest('GET', url);
            const response = await this.fetchWithTimeout(url);
            const duration = Date.now() - startTime;

            if (!response.ok) {
                this.logger.errorApiFailure(url, response.status, 'NPM registry request failed');
                throw new Error(`NPM registry request failed: ${response.status}`);
            }

            this.logger.debugApiResponse(url, response.status, duration);

            const data: any = await response.json();
            const latestVersion = data.version;

            return latestVersion;
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                this.logger.errorNetworkTimeout(url, 5000);
            } else {
                this.logger.error(
                    `NPM registry error ${packageName}: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
            }
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
