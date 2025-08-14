export const API_BASE_URL = 'https://react-native-package-checker.vercel.app/api';

export const EXTERNAL_URLS = {
  BUNDLEPHOBIA_BASE: 'https://bundlephobia.com/package',
} as const;

export enum COMMANDS {
  REFRESH_CODE_LENS = 'reactNativePackageChecker.refreshCodeLens',
  TOGGLE_CODE_LENS = 'reactNativePackageChecker.toggleCodeLens',
  ENABLE_CODE_LENS = 'reactNativePackageChecker.enableCodeLens',
  SHOW_PACKAGE_DETAILS = 'reactNativePackageChecker.showPackageDetails',
}

export const CACHE_TIMEOUT = 5 * 60 * 1000;
export const PACKAGE_JSON_PATTERN = '**/package.json';

export const NEW_ARCH_ISSUE_QUERY =
  'is:issue is:open "new arch" OR "new architecture" OR "fabric" OR "turbomodule" OR "JSI" OR "codegen"';

export const NEW_ARCH_PR_QUERY =
  'is:pr is:open "new arch" OR "new architecture" OR "fabric" OR "turbomodule" OR "JSI" OR "codegen"';

export const NEW_ARCH_MERGED_PR_QUERY =
  'is:pr is:merged "new arch" OR "new architecture" OR "fabric" OR "turbomodule" OR "JSI" OR "codegen"';

export const NEW_ARCH_RELEASE_NOTES_QUERY = 'new+arch';

export const MAINTENANCE_ISSUE_QUERY =
  'is:issue is:open "unmaintained" OR "deprecated" OR "abandoned" OR "maintainer" OR "maintenance" OR "not maintained"';

export const MAINTENANCE_PR_QUERY = 'is:pr is:open sort:updated-asc';

export enum GITHUB_PATHS {
  ISSUES = 'issues',
  PULLS = 'pulls',
  FORKS = 'forks',
  CONTRIBUTORS_ACTIVITY = 'graphs/contributors',
  RELEASES = 'releases',
  README = 'blob/master/README.md',
}

export enum STATUS_LABELS {
  SUPPORTED = 'New Arch Supported',
  UNSUPPORTED = 'New Arch Unsupported',
  UNTESTED = 'New Arch Untested',
  UNKNOWN = 'Unknown Status',
}

export enum STATUS_DESCRIPTIONS {
  SUPPORTED = 'This package fully supports the New Architecture',
  UNSUPPORTED = 'This package does not support the New Architecture',
  UNTESTED = 'This package has not been tested with the New Architecture',
  UNKNOWN = 'New Architecture compatibility status is unknown',
}

export enum STATUS_CLASSES {
  SUPPORTED = 'status-supported',
  UNSUPPORTED = 'status-unsupported',
  UNTESTED = 'status-untested',
  UNKNOWN = 'status-unknown',
}