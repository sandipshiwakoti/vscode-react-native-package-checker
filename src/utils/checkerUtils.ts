import * as vscode from 'vscode';

import { BASE_URL } from '../constants';

import { formatDependency } from './urlUtils';

export function getCheckUrl(packages: Array<{ name: string; version: string }>, isBrowser: boolean = false): string {
    const formattedPackages = packages.map((pkg) => formatDependency(pkg.name, pkg.version));
    const packagesParam = formattedPackages.join(',');

    if (isBrowser) {
        return `${BASE_URL}/check?packages=${encodeURIComponent(packagesParam)}`;
    }

    const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
    const theme = isDark ? 'dark' : 'light';

    return `${BASE_URL}/check?packages=${encodeURIComponent(packagesParam)}&vscode=true&theme=${theme}&directory_view=grid`;
}
