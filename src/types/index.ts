export enum NewArchSupportStatus {
    Supported = 'supported',
    Unsupported = 'unsupported',
    Untested = 'untested',
    Unlisted = 'unlisted',
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
}

export interface StatusInfo {
    text: string;
    description: string;
}

export type PackageInfoMap = Record<string, PackageInfo>;
