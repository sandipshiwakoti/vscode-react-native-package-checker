export enum NewArchSupportStatus {
    Supported = 'supported',
    Unsupported = 'unsupported',
    Untested = 'untested',
    Unlisted = 'unlisted',
}

export enum PackageJsonKeys {
    DEPENDENCIES = 'dependencies',
    DEV_DEPENDENCIES = 'devDependencies',
    PEER_DEPENDENCIES = 'peerDependencies',
    NAME = 'name',
    VERSION = 'version',
}

export enum FileExtensions {
    JSON = '.json',
    PACKAGE_JSON = 'package.json',
}

export enum LOG_LEVEL {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
}

export enum HTTP_METHODS {
    GET = 'GET',
    POST = 'POST',
    PUT = 'PUT',
    DELETE = 'DELETE',
}

export enum CONTENT_TYPES {
    JSON = 'application/json',
    TEXT = 'text/plain',
    HTML = 'text/html',
}

export enum HTTP_HEADERS {
    CONTENT_TYPE = 'Content-Type',
    ACCEPT = 'Accept',
    AUTHORIZATION = 'Authorization',
}

export enum STATUS_LABELS {
    SUPPORTED = 'New Arch Supported',
    UNSUPPORTED = 'New Arch Unsupported',
    UNTESTED = 'New Arch Untested',
    UNLISTED = 'Unlisted',
}

export enum STATUS_DESCRIPTIONS {
    SUPPORTED = 'This package fully supports the New Architecture',
    UNSUPPORTED = 'This package does not support the New Architecture',
    UNTESTED = 'This package has not been tested with the New Architecture',
    UNLISTED = 'This package is not found in the official React Native directory',
}

export enum STATUS_CLASSES {
    SUPPORTED = 'status-supported',
    UNSUPPORTED = 'status-unsupported',
    UNTESTED = 'status-untested',
    UNLISTED = 'status-unlisted',
}

export enum COMMANDS {
    ENABLE_CODE_LENS = 'reactNativePackageChecker.enableCodeLens',
    DISABLE_CODE_LENS = 'reactNativePackageChecker.disableCodeLens',
    SHOW_PACKAGE_DETAILS = 'reactNativePackageChecker.showPackageDetails',
    OPEN_PACKAGE_CHECKER_WEBSITE = 'reactNativePackageChecker.openPackageCheckerWebsite',
    REFRESH_PACKAGES = 'reactNativePackageChecker.refreshPackages',
    UPDATE_PACKAGE_VERSION = 'reactNativePackageChecker.updatePackageVersion',
    OPEN_UPGRADE_HELPER = 'reactNativePackageChecker.openUpgradeHelper',
    SHOW_LOGS = 'reactNativePackageChecker.showLogs',
}

export enum GITHUB_PATHS {
    ISSUES = 'issues',
    PULLS = 'pulls',
    FORKS = 'forks',
    CONTRIBUTORS_ACTIVITY = 'graphs/contributors',
    RELEASES = 'releases',
    README = 'blob/master/README.md',
}

export interface PackageResponse {
    packages: Record<string, PackageInfo>;
    reactNativeVersions: string[];
}

export interface PlatformSupport {
    ios: boolean;
    android: boolean;
    web: boolean;
    windows: boolean;
    macos: boolean;
    fireos: boolean;
}

export interface PackageSupport {
    hasTypes: boolean;
    license: string | null;
    licenseUrl?: string;
    expoGo?: boolean;
    dev?: boolean;
}

export interface GitHubInfo {
    description?: string;
    stargazers_count: number;
    forks_count: number;
    watchers_count: number;
    open_issues_count: number;
    updated_at: string;
}

export interface PackageInfo {
    npmUrl: string;
    githubUrl?: string;
    version?: string;
    alternatives?: string[];
    platforms?: PlatformSupport;
    support?: PackageSupport;
    newArchitecture?: NewArchSupportStatus;
    newArchitectureNote?: string;
    unmaintained?: boolean;
    error?: string;
    github?: GitHubInfo;
    latestVersion?: string;
    currentVersion?: string;
    hasUpdate?: boolean;
    versionFetchError?: string;
}

export interface StatusInfo {
    text: string;
    description: string;
}

export type PackageInfoMap = Record<string, PackageInfo>;

export interface LogEntry {
    level: LOG_LEVEL;
    message: string;
    timestamp: Date;
}
