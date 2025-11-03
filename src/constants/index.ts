export const BASE_URL = 'https://react-native-package-checker.vercel.app';
export const API_BASE_URL = `${BASE_URL}/api`;

export const EXTERNAL_URLS = {
    BUNDLEPHOBIA_BASE: 'https://bundlephobia.com/package',
    UPGRADE_HELPER_BASE: 'https://react-native-community.github.io/upgrade-helper',
    REACT_NATIVE_DIRECTORY_BASE: 'https://reactnative.directory',
} as const;

export const EXTENSION_CONFIG = {
    CACHE_TIMEOUT: 5 * 60 * 1000,
    PACKAGE_JSON_PATTERN: '**/package.json',
    DEFAULT_CODE_LENS_ENABLED: false,
    CODE_LENS_STATE_KEY: 'enableCodeLens',
    CODE_LENS_CONTEXT_KEY: 'reactNativePackageChecker.enabled',
    LANGUAGE_JSON: 'json',
    VERSION_CLEAN_REGEX: /[\^~]/,
    PACKAGE_LINE_REGEX: /"([^"]+)"\s*:\s*"[^"]+"/,
    LINE_SEPARATOR: '\n',
    TOOLTIP_SEPARATOR: '\n\n',
    CONFIGURATION_SECTION: 'reactNativePackageChecker',
    SHOW_LATEST_VERSION_KEY: 'showLatestVersion',
    DEFAULT_SHOW_LATEST_VERSION: true,
} as const;

export const REGEX_PATTERNS = {
    VERSION_PREFIX_CLEAN: /^\^|~/g,
    VERSION_NUMERIC: /^\d+(\.\d+)*$/,
    DOT_SEPARATOR: '.',
    AT_SEPARATOR: '@',
    VERSION_PATCH_SUFFIX: '.0',
} as const;

export const API_CONFIG = {
    ENDPOINT_PACKAGE_INFO: '/package-info',
    METHOD_POST: 'POST',
    HEADER_CONTENT_TYPE: 'Content-Type',
    CONTENT_TYPE_JSON: 'application/json',
} as const;

export const NPM_REGISTRY_CONFIG = {
    BASE_URL: 'https://registry.npmjs.org',
    CACHE_TIMEOUT: 15 * 60 * 1000, // 15 minutes
    REQUEST_TIMEOUT: 5000, // 5 seconds
} as const;

export const UI_CONFIG = {
    EXTENSION_NAME: 'React Native Package Checker',
    PACKAGE_DETAILS_PANEL_ID: 'packageDetails',
    LOGO_PATH: 'assets/logo.svg',
} as const;

export const STATUS_SYMBOLS = {
    SUPPORTED: '$(check)',
    UNSUPPORTED: '$(close)',
    UNTESTED: '$(warning)',
    UNLISTED: '$(question)',
    UNMAINTAINED: '$(archive)',
    UPDATE: '$(arrow-up)',
    LATEST: '$(check)',
    UPGRADE_HELPER: '$(globe)',
    DEPENDENCY_UPDATE: '$(tools)',
    ADD: '$(add)',
    REMOVE: '$(remove)',
} as const;

export const REQUIREMENTS_CONFIG = {
    RN_DIFF_BASE_URL: 'https://raw.githubusercontent.com/react-native-community/rn-diff-purge/diffs/diffs',
    BASELINE_VERSION: '0.65.0',
    VERSION_FORMAT_REGEX: /^\d+\.\d+\.\d+$/,
    REQUEST_TIMEOUT: 10000,
    STATE_KEYS: {
        ENABLED: 'requirementsEnabled',
        TARGET_VERSION: 'requirementsTargetVersion',
    },
} as const;

export const GITHUB_QUERIES = {
    NEW_ARCH_ISSUE:
        'is:issue is:open "new arch" OR "new architecture" OR "fabric" OR "turbomodule" OR "JSI" OR "codegen"',
    NEW_ARCH_PR: 'is:pr is:open "new arch" OR "new architecture" OR "fabric" OR "turbomodule" OR "JSI" OR "codegen"',
    NEW_ARCH_MERGED_PR:
        'is:pr is:merged "new arch" OR "new architecture" OR "fabric" OR "turbomodule" OR "JSI" OR "codegen"',
    NEW_ARCH_RELEASE_NOTES: 'new+arch',
    MAINTENANCE_ISSUE:
        'is:issue is:open "unmaintained" OR "deprecated" OR "abandoned" OR "maintainer" OR "maintenance" OR "not maintained"',
    MAINTENANCE_PR: 'is:pr is:open sort:updated-asc',
} as const;

export const INTERNAL_PACKAGES = [
    // Core React packages (maintained by Meta)
    'react',
    'react-dom',
    'react-native',

    // Metro and bundling (official React Native bundler)
    'metro',
    'metro-config',
    'metro-react-native-babel-preset',
    'metro-resolver',
    'metro-runtime',
    'metro-source-map',
    'metro-transform-plugins',
    'metro-transform-worker',

    // Official React Native CLI and tools
    '@react-native-community/cli',
    '@react-native-community/cli-platform-android',
    '@react-native-community/cli-platform-ios',
    '@react-native-community/cli-server-api',
    '@react-native-community/cli-tools',
    '@react-native-community/cli-types',
    '@react-native-community/cli-debugger-ui',
    '@react-native-community/cli-hermes',

    // Babel (build-time transformation tools)
    '@babel/core',
    '@babel/preset-env',
    '@babel/runtime',
    '@babel/preset-typescript',
    '@babel/preset-react',
    'babel-plugin-module-resolver',

    // Official React Native codegen and tools
    '@react-native/codegen',
    'react-native-codegen',
    '@react-native/gradle-plugin',
    '@react-native/js-polyfills',
    '@react-native/metro-config',
    '@react-native/normalize-colors',
    '@react-native/polyfills',
];

export const ERROR_MESSAGES = {
    PACKAGE_JSON_NOT_FOUND: 'No package.json file is currently open',
    PACKAGE_JSON_PARSE_FAILED: 'Failed to parse package.json',
    NO_PACKAGES_FOUND: 'No packages found. Please open a package.json file first.',
    COMMAND_EXECUTION_FAILED: 'Failed to execute command. Please try again.',
} as const;

export const SUCCESS_MESSAGES = {
    PACKAGE_ADDED: (packageName: string, version: string, section: string) =>
        `Added ${packageName}@${version} to ${section}`,
    PACKAGE_REMOVED: (packageName: string) => `Removed ${packageName} from dependencies`,
    PACKAGE_UPDATED: (packageName: string, version: string) => `Updated ${packageName} to ${version}`,
    REQUIREMENTS_ENABLED: (version: string, sourceVersion?: string) => {
        const baseMessage = `Requirements displayed for React Native ${version}. Mismatched versions will be highlighted with update suggestions.`;
        if (sourceVersion && sourceVersion !== version) {
            const upgradeUrl = `${EXTERNAL_URLS.UPGRADE_HELPER_BASE}/?from=${sourceVersion}&to=${version}#RnDiffApp-package.json`;
            return `${baseMessage} [View upgrade guide](${upgradeUrl})`;
        }
        return baseMessage;
    },
    REQUIREMENTS_DISABLED: 'Requirements are now hidden.',
    REQUIREMENTS_APPLIED: (count: number, version: string) =>
        `Successfully applied ${count} requirement${count > 1 ? 's' : ''} for React Native ${version}. All requirements fulfilled!`,
} as const;
