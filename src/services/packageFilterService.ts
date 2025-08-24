import {
    FilterConfig,
    NewArchSupportStatus,
    PackageInfo,
    PackageInfoMap,
    PackageStatus,
    StatusPackageMap,
} from '../types';

export class PackageFilterService {
    filterPackagesByStatus(packages: PackageInfoMap, status: PackageStatus): PackageInfoMap {
        if (status === 'all') {
            return packages;
        }

        const filtered: PackageInfoMap = {};

        Object.entries(packages).forEach(([packageName, packageInfo]) => {
            if (this.matchesStatus(packageInfo, status)) {
                filtered[packageName] = packageInfo;
            }
        });

        return filtered;
    }

    searchPackages(packages: PackageInfoMap, searchTerm: string): PackageInfoMap {
        if (!searchTerm || searchTerm.trim() === '') {
            return packages;
        }

        const normalizedSearchTerm = searchTerm.toLowerCase().trim();
        const filtered: PackageInfoMap = {};

        Object.entries(packages).forEach(([packageName, packageInfo]) => {
            if (this.matchesSearchTerm(packageName, packageInfo, normalizedSearchTerm)) {
                filtered[packageName] = packageInfo;
            }
        });

        return filtered;
    }

    getPackagesByStatus(packages: PackageInfoMap): StatusPackageMap {
        const statusMap: StatusPackageMap = {
            supported: {},
            unsupported: {},
            untested: {},
            unlisted: {},
            unmaintained: {},
        };

        Object.entries(packages).forEach(([packageName, packageInfo]) => {
            if (packageInfo.unmaintained) {
                statusMap.unmaintained[packageName] = packageInfo;
            }

            switch (packageInfo.newArchitecture) {
                case NewArchSupportStatus.Supported:
                    statusMap.supported[packageName] = packageInfo;
                    break;
                case NewArchSupportStatus.Unsupported:
                    statusMap.unsupported[packageName] = packageInfo;
                    break;
                case NewArchSupportStatus.Untested:
                    statusMap.untested[packageName] = packageInfo;
                    break;
                case NewArchSupportStatus.Unlisted:
                default:
                    statusMap.unlisted[packageName] = packageInfo;
                    break;
            }
        });

        return statusMap;
    }

    applyFilters(packages: PackageInfoMap, config: FilterConfig): PackageInfoMap {
        let filtered = packages;

        if (config.status && config.status !== 'all') {
            filtered = this.filterPackagesByStatus(filtered, config.status);
        }

        if (config.searchTerm) {
            filtered = this.searchPackages(filtered, config.searchTerm);
        }

        return filtered;
    }

    getStatusCounts(packages: PackageInfoMap): Record<PackageStatus, number> {
        const statusMap = this.getPackagesByStatus(packages);

        return {
            supported: Object.keys(statusMap.supported).length,
            unsupported: Object.keys(statusMap.unsupported).length,
            untested: Object.keys(statusMap.untested).length,
            unlisted: Object.keys(statusMap.unlisted).length,
            unmaintained: Object.keys(statusMap.unmaintained).length,
            all: Object.keys(packages).length,
        };
    }

    private matchesStatus(packageInfo: PackageInfo, status: PackageStatus): boolean {
        if (status === 'unmaintained') {
            return packageInfo.unmaintained === true;
        }

        switch (status) {
            case 'supported':
                return packageInfo.newArchitecture === NewArchSupportStatus.Supported;
            case 'unsupported':
                return packageInfo.newArchitecture === NewArchSupportStatus.Unsupported;
            case 'untested':
                return packageInfo.newArchitecture === NewArchSupportStatus.Untested;
            case 'unlisted':
                return packageInfo.newArchitecture === NewArchSupportStatus.Unlisted || !packageInfo.newArchitecture;
            default:
                return false;
        }
    }

    private matchesSearchTerm(packageName: string, packageInfo: PackageInfo, searchTerm: string): boolean {
        if (packageName.toLowerCase().includes(searchTerm)) {
            return true;
        }

        if (packageInfo.currentVersion && packageInfo.currentVersion.toLowerCase().includes(searchTerm)) {
            return true;
        }

        if (packageInfo.latestVersion && packageInfo.latestVersion.toLowerCase().includes(searchTerm)) {
            return true;
        }

        if (packageInfo.newArchitecture && packageInfo.newArchitecture.toLowerCase().includes(searchTerm)) {
            return true;
        }

        const statusLabels = this.getStatusLabels(packageInfo);
        if (statusLabels.some((label) => label.toLowerCase().includes(searchTerm))) {
            return true;
        }

        return false;
    }

    private getStatusLabels(packageInfo: PackageInfo): string[] {
        const labels: string[] = [];

        if (packageInfo.unmaintained) {
            labels.push('unmaintained');
        }

        switch (packageInfo.newArchitecture) {
            case NewArchSupportStatus.Supported:
                labels.push('supported', 'new arch supported');
                break;
            case NewArchSupportStatus.Unsupported:
                labels.push('unsupported', 'new arch unsupported');
                break;
            case NewArchSupportStatus.Untested:
                labels.push('untested', 'new arch untested');
                break;
            case NewArchSupportStatus.Unlisted:
            default:
                labels.push('unlisted');
                break;
        }

        return labels;
    }
}
