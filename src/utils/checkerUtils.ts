import * as vscode from 'vscode';
import { formatDependency } from './urlUtils';
import { BASE_URL, EXTENSION_CONFIG } from '../constants';

export function generateCheckUrl(packages: Array<{ name: string; version: string }>): string {
    const formattedPackages = packages.map(pkg => formatDependency(pkg.name, pkg.version));
    const packagesParam = formattedPackages.join(',');

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