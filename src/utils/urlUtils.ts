import { EXTERNAL_URLS, REGEX_PATTERNS } from '../constants';
import { GITHUB_QUERIES } from '../constants/queries';
import { GITHUB_PATHS, NewArchSupportStatus, STATUS_CLASSES } from '../types';

const createGithubUrl = (repoUrl: string, path: GITHUB_PATHS | string, query?: string) => {
    const baseUrl = `${repoUrl}/${path}`;
    return query ? `${baseUrl}?${new URLSearchParams({ q: query }).toString()}` : baseUrl;
};

export const getNewArchIssueSearchUrl = (repoUrl: string) =>
    createGithubUrl(repoUrl, GITHUB_PATHS.ISSUES, GITHUB_QUERIES.NEW_ARCH_ISSUE);

export const getNewArchPRSearchUrl = (repoUrl: string) =>
    createGithubUrl(repoUrl, GITHUB_PATHS.PULLS, GITHUB_QUERIES.NEW_ARCH_PR);

export const getNewArchMergedPRSearchUrl = (repoUrl: string) =>
    createGithubUrl(repoUrl, GITHUB_PATHS.PULLS, GITHUB_QUERIES.NEW_ARCH_MERGED_PR);

export const getNewArchReleaseNotesUrl = (repoUrl: string) =>
    createGithubUrl(repoUrl, GITHUB_PATHS.RELEASES, GITHUB_QUERIES.NEW_ARCH_RELEASE_NOTES);

export const getReadmeUrl = (repoUrl: string) => createGithubUrl(repoUrl, GITHUB_PATHS.README);

export const getMaintenanceIssuesUrl = (repoUrl: string) =>
    createGithubUrl(repoUrl, GITHUB_PATHS.ISSUES, GITHUB_QUERIES.MAINTENANCE_ISSUE);

export const getMaintenancePRSearchUrl = (repoUrl: string) =>
    createGithubUrl(repoUrl, GITHUB_PATHS.PULLS, GITHUB_QUERIES.MAINTENANCE_PR);

export const getContributorsActivityUrl = (repoUrl: string) =>
    createGithubUrl(repoUrl, GITHUB_PATHS.CONTRIBUTORS_ACTIVITY);

export const getActiveForksUrl = (repoUrl: string) => createGithubUrl(repoUrl, GITHUB_PATHS.FORKS);

export const getBundlePhobiaUrl = (packageName: string, version?: string): string => {
    return `${EXTERNAL_URLS.BUNDLEPHOBIA_BASE}/${packageName}${version ? `@${version}` : ''}`;
};

export const getNormalizedVersion = (version: string | null) => {
    if (!version) {
        return null;
    }
    const parts = version.split(REGEX_PATTERNS.DOT_SEPARATOR);
    return parts.length === 2 ? `${version}${REGEX_PATTERNS.VERSION_PATCH_SUFFIX}` : version;
};

export function cleanPackageName(pkg: string): string {
    const lastAtIndex = pkg.trim().lastIndexOf(REGEX_PATTERNS.AT_SEPARATOR);
    return lastAtIndex > 0 ? pkg.substring(0, lastAtIndex) : pkg;
}

export function formatDependency(name: string, version: string): string {
    const cleanVersion = String(version).replace(REGEX_PATTERNS.VERSION_PREFIX_CLEAN, '');
    return REGEX_PATTERNS.VERSION_NUMERIC.test(cleanVersion)
        ? `${name}${REGEX_PATTERNS.AT_SEPARATOR}${cleanVersion}`
        : name;
}

export function extractPackageVersion(packageName: string): string | undefined {
    const lastAtIndex = packageName.lastIndexOf(REGEX_PATTERNS.AT_SEPARATOR);
    if (lastAtIndex > 0) {
        const version = packageName.substring(lastAtIndex + 1);
        return REGEX_PATTERNS.VERSION_NUMERIC.test(version) ? version : undefined;
    }
    return undefined;
}

export function getStatusClass(status?: NewArchSupportStatus | string): string {
    switch (status) {
        case NewArchSupportStatus.Supported:
            return STATUS_CLASSES.SUPPORTED;
        case NewArchSupportStatus.Unsupported:
            return STATUS_CLASSES.UNSUPPORTED;
        case NewArchSupportStatus.Untested:
            return STATUS_CLASSES.UNTESTED;
        case NewArchSupportStatus.Unlisted:
        default:
            return STATUS_CLASSES.UNLISTED;
    }
}
