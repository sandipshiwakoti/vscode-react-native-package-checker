import * as vscode from 'vscode';
import { formatDependency } from './urlUtils';
import { BASE_URL, EXTENSION_CONFIG } from '../constants';

export function getCheckUrl(packages: Array<{ name: string; version: string }>, isBrowser: boolean = false): string {
    const formattedPackages = packages.map(pkg => formatDependency(pkg.name, pkg.version));
    const packagesParam = formattedPackages.join(',');

    if (isBrowser) {
        return `${BASE_URL}/check?packages=${encodeURIComponent(packagesParam)}`;
    }

    const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
    const theme = isDark ? 'dark' : 'light';

    return `${BASE_URL}/check?packages=${encodeURIComponent(packagesParam)}&vscode=true&theme=${theme}&directory_view=grid`;
}

export function extractPackagesFromPackageJson(content: string): Array<{ name: string; version: string }> {
    try {
        const packageJson = JSON.parse(content);
        const dependencies = packageJson[EXTENSION_CONFIG.DEPENDENCIES_KEY] || {};

        return Object.entries(dependencies).map(([name, version]) => ({
            name,
            version: (version as string).replace(EXTENSION_CONFIG.VERSION_CLEAN_REGEX, '')
        }));
    } catch (error) {
        return [];
    }
}