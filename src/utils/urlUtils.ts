import {
  GITHUB_PATHS,
  MAINTENANCE_ISSUE_QUERY,
  MAINTENANCE_PR_QUERY,
  NEW_ARCH_ISSUE_QUERY,
  NEW_ARCH_MERGED_PR_QUERY,
  NEW_ARCH_PR_QUERY,
  NEW_ARCH_RELEASE_NOTES_QUERY,
  EXTERNAL_URLS,
} from '../constants';

const createGithubUrl = (repoUrl: string, path: GITHUB_PATHS | string, query?: string) => {
  const baseUrl = `${repoUrl}/${path}`;
  return query ? `${baseUrl}?${new URLSearchParams({ q: query }).toString()}` : baseUrl;
};

export const getNewArchIssueSearchUrl = (repoUrl: string) =>
  createGithubUrl(repoUrl, GITHUB_PATHS.ISSUES, NEW_ARCH_ISSUE_QUERY);

export const getNewArchPRSearchUrl = (repoUrl: string) =>
  createGithubUrl(repoUrl, GITHUB_PATHS.PULLS, NEW_ARCH_PR_QUERY);

export const getNewArchMergedPRSearchUrl = (repoUrl: string) =>
  createGithubUrl(repoUrl, GITHUB_PATHS.PULLS, NEW_ARCH_MERGED_PR_QUERY);

export const getNewArchReleaseNotesUrl = (repoUrl: string) =>
  createGithubUrl(repoUrl, GITHUB_PATHS.RELEASES, NEW_ARCH_RELEASE_NOTES_QUERY);

export const getReadmeUrl = (repoUrl: string) => createGithubUrl(repoUrl, GITHUB_PATHS.README);

export const getMaintenanceIssuesUrl = (repoUrl: string) =>
  createGithubUrl(repoUrl, GITHUB_PATHS.ISSUES, MAINTENANCE_ISSUE_QUERY);

export const getMaintenancePRSearchUrl = (repoUrl: string) =>
  createGithubUrl(repoUrl, GITHUB_PATHS.PULLS, MAINTENANCE_PR_QUERY);

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
  const parts = version.split('.');
  return parts.length === 2 ? `${version}.0` : version;
};

export function cleanPackageName(pkg: string): string {
  const lastAtIndex = pkg.trim().lastIndexOf('@');
  return lastAtIndex > 0 ? pkg.substring(0, lastAtIndex) : pkg;
}

export function formatDependency(name: string, version: string): string {
  const cleanVersion = String(version).replace(/^\^|~/g, '');
  return /^\d+(\.\d+)*$/.test(cleanVersion) ? `${name}@${cleanVersion}` : name;
}

export function extractPackageVersion(packageName: string): string | undefined {
  const lastAtIndex = packageName.lastIndexOf('@');
  if (lastAtIndex > 0) {
    const version = packageName.substring(lastAtIndex + 1);
    return /^\d+(\.\d+)*$/.test(version) ? version : undefined;
  }
  return undefined;
}