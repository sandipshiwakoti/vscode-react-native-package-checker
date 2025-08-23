// export const BASE_URL = 'https://react-native-package-checker.vercel.app';
export const BASE_URL = 'http://localhost:3000';

export const API_BASE_URL = `${BASE_URL}/api`;

export const EXTERNAL_URLS = {
    BUNDLEPHOBIA_BASE: 'https://bundlephobia.com/package',
    UPGRADE_HELPER_BASE: 'https://react-native-community.github.io/upgrade-helper',
} as const;

export const EXTENSION_CONFIG = {
    CACHE_TIMEOUT: 5 * 60 * 1000,
    PACKAGE_JSON_PATTERN: '**/package.json',
    DEFAULT_CODE_LENS_ENABLED: true,
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
