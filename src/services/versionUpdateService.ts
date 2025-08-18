import * as vscode from 'vscode';

import { REGEX_PATTERNS } from '../constants';

export class VersionUpdateService {
    async updatePackageVersion(document: vscode.TextDocument, packageName: string, newVersion: string): Promise<void> {
        const content = document.getText();

        const packagePattern = `"${packageName}"`;
        const lines = content.split('\n');
        let wasUpdated = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.includes(packagePattern) && line.includes(':')) {
                const versionMatch = line.match(new RegExp(`"${this.escapeRegExp(packageName)}"\\s*:\\s*"([^"]+)"`));

                if (versionMatch) {
                    const currentVersionString = versionMatch[1];
                    const versionPrefix = this.extractVersionPrefix(currentVersionString);
                    const newVersionString = `${versionPrefix}${newVersion}`;

                    const updatedLine = line.replace(
                        new RegExp(`("${this.escapeRegExp(packageName)}"\\s*:\\s*)"[^"]+"`),
                        `$1"${newVersionString}"`
                    );

                    lines[i] = updatedLine;
                    wasUpdated = true;
                    break;
                }
            }
        }

        if (wasUpdated) {
            const updatedContent = lines.join('\n');
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(content.length));

            edit.replace(document.uri, fullRange, updatedContent);
            await vscode.workspace.applyEdit(edit);
        }
    }

    canUpdateVersion(packageName: string, currentVersion: string, latestVersion: string): boolean {
        if (!packageName || !currentVersion || !latestVersion) {
            return false;
        }

        const cleanCurrentVersion = this.cleanVersion(currentVersion);
        const cleanLatestVersion = this.cleanVersion(latestVersion);

        return this.compareVersions(cleanLatestVersion, cleanCurrentVersion) > 0;
    }

    private extractVersionPrefix(versionString: string): string {
        const match = versionString.match(/^[\^~]/);
        return match ? match[0] : '';
    }

    private cleanVersion(version: string): string {
        return version.replace(REGEX_PATTERNS.VERSION_PREFIX_CLEAN, '');
    }

    private compareVersions(version1: string, version2: string): number {
        const v1Parts = version1.split(REGEX_PATTERNS.DOT_SEPARATOR).map(Number);
        const v2Parts = version2.split(REGEX_PATTERNS.DOT_SEPARATOR).map(Number);

        const maxLength = Math.max(v1Parts.length, v2Parts.length);

        for (let i = 0; i < maxLength; i++) {
            const v1Part = v1Parts[i] || 0;
            const v2Part = v2Parts[i] || 0;

            if (v1Part > v2Part) {
                return 1;
            }
            if (v1Part < v2Part) {
                return -1;
            }
        }

        return 0;
    }

    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
