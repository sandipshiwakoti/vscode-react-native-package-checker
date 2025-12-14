import * as vscode from 'vscode';
import * as path from 'path';

import { EXTERNAL_URLS, INTERNAL_PACKAGES, UI_CONFIG } from '../constants';
import { STATUS_LABELS } from '../types';
import { NewArchSupportStatus, PackageInfo } from '../types';
import { getStatusClass } from '../utils/urlUtils';
import {
    getActiveForksUrl,
    getBundlePhobiaUrl,
    getContributorsActivityUrl,
    getMaintenanceIssuesUrl,
    getMaintenancePRSearchUrl,
    getNewArchIssueSearchUrl,
    getNewArchMergedPRSearchUrl,
    getNewArchPRSearchUrl,
    getReadmeUrl,
} from '../utils/urlUtils';

const openPanels = new Map<string, vscode.WebviewPanel>();
const panelPackageInfo = new Map<string, { packageName: string; packageInfo: PackageInfo }>();

export function createPackageDetailsPanel(
    packageName: string,
    packageInfo: PackageInfo,
    context?: vscode.ExtensionContext
): vscode.WebviewPanel {
    const existingPanel = openPanels.get(packageName);
    if (existingPanel) {
        existingPanel.reveal(vscode.ViewColumn.Beside);
        return existingPanel;
    }

    const panel = vscode.window.createWebviewPanel(
        UI_CONFIG.PACKAGE_DETAILS_PANEL_ID,
        `${packageName} - Package Details`,
        vscode.ViewColumn.Beside,
        {
            enableScripts: false,
            retainContextWhenHidden: true,
        }
    );
    if (context) {
        panel.iconPath = vscode.Uri.file(path.join(context.extensionPath, 'assets', 'logo.svg'));
    }

    panel.webview.html = generateWebviewContent(packageName, packageInfo);

    openPanels.set(packageName, panel);
    panelPackageInfo.set(packageName, { packageName, packageInfo });

    panel.onDidDispose(() => {
        openPanels.delete(packageName);
        panelPackageInfo.delete(packageName);
    });

    if (context) {
        const themeChangeDisposable = vscode.window.onDidChangeActiveColorTheme(() => {
            const storedInfo = panelPackageInfo.get(packageName);
            if (panel && storedInfo) {
                panel.webview.html = generateWebviewContent(storedInfo.packageName, storedInfo.packageInfo);
            }
        });

        context.subscriptions.push(themeChangeDisposable);
    }

    return panel;
}

function generateWebviewContent(packageName: string, packageInfo: PackageInfo): string {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${packageName}</title>
            <style>
                * { box-sizing: border-box; }
                body { 
                    font-family: var(--vscode-font-family); 
                    padding: 0;
                    margin: 0;
                    height: 100vh;
                    overflow: hidden;
                    color: var(--vscode-foreground);
                    background: linear-gradient(135deg, var(--vscode-editor-background) 0%, var(--vscode-sideBar-background) 100%);
                    font-size: 13px;
                    line-height: 1.5;
                    animation: fadeIn 0.3s ease-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .header {
                    background: linear-gradient(135deg, var(--vscode-titleBar-activeBackground) 0%, var(--vscode-sideBar-background) 100%);
                    padding: 20px 24px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    flex-shrink: 0;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }
                .header h1 { 
                    margin: 0;
                    color: var(--vscode-titleBar-activeForeground);
                    font-size: 22px;
                    font-weight: 700;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                }
                .version {
                    font-size: 15px;
                    font-weight: 500;
                    opacity: 0.85;
                    background: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-family: var(--vscode-editor-font-family);
                }
                .container {
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                }
                .content {
                    flex: 1;
                    padding: 20px 24px 40px;
                    overflow-y: auto;
                    overflow-x: hidden;
                    background: transparent;
                    position: relative;
                }
                .content::-webkit-scrollbar {
                    width: 8px;
                }
                .content::-webkit-scrollbar-track {
                    background: transparent;
                }
                .content::-webkit-scrollbar-thumb {
                    background: var(--vscode-scrollbarSlider-background);
                    border-radius: 4px;
                }
                .content::-webkit-scrollbar-thumb:hover {
                    background: var(--vscode-scrollbarSlider-hoverBackground);
                }
                .single-column {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    max-width: 900px;
                    margin: 0 auto;
                }
                .card {
                    background: var(--vscode-sideBar-background);
                    border-radius: 8px;
                    border: 1px solid var(--vscode-panel-border);
                    padding: 16px 20px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                    transition: all 0.2s ease;
                    position: relative;
                    overflow: hidden;
                }
                .card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 4px;
                    height: 100%;
                    background: var(--vscode-textLink-foreground);
                    transition: all 0.2s ease;
                }
                .card:hover {
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
                }
                .card-content {
                    color: var(--vscode-foreground);
                    font-size: 14px;
                    line-height: 1.6;
                }
                .card-title {
                    font-weight: 600;
                    color: var(--vscode-textPreformat-foreground);
                    margin-bottom: 12px;
                    font-size: 13px;
                    text-transform: uppercase;
                    letter-spacing: 0.8px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .card-title .tag-icon {
                    opacity: 0.7;
                    margin-right: 4px;
                }

                .status-supported::before { background: #10b981; }
                .status-unsupported::before { background: #ef4444; }
                .status-untested::before { background: #f59e0b; }
                .status-unlisted::before { background: #6b7280; }
                
                .description {
                    word-wrap: break-word;
                    white-space: pre-wrap;
                    color: var(--vscode-descriptionForeground);
                    opacity: 0.95;
                    font-size: 14px;
                    line-height: 1.6;
                }
                .platforms, .support-info, .platforms-support {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    row-gap: 8px;
                }
                .status-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;
                    align-items: center;
                }
                .status-item {
                    display: inline-block;
                }
                .tag {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    border-radius: 8px;
                    font-size: 12px;
                    font-weight: 600;
                    transition: all 0.2s ease;
                    text-decoration: none;
                    border: 1px solid transparent;
                    cursor: default;
                }
                .tag-icon {
                    width: 14px;
                    height: 14px;
                    flex-shrink: 0;
                }
                .tag-green {
                    background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.08) 100%);
                    color: #059669;
                    border: 1px solid rgba(16, 185, 129, 0.25);
                }
                .tag-red {
                    background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.08) 100%);
                    color: #dc2626;
                    border: 1px solid rgba(239, 68, 68, 0.25);
                }
                .tag-yellow {
                    background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.08) 100%);
                    color: #d97706;
                    border: 1px solid rgba(245, 158, 11, 0.25);
                }
                .tag-amber {
                    background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.08) 100%);
                    color: #d97706;
                    border: 1px solid rgba(245, 158, 11, 0.25);
                }
                .tag-blue {
                    background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.08) 100%);
                    color: #2563eb;
                    border: 1px solid rgba(59, 130, 246, 0.25);
                }
                .tag-purple {
                    background: linear-gradient(135deg, rgba(147, 51, 234, 0.15) 0%, rgba(147, 51, 234, 0.08) 100%);
                    color: #7c3aed;
                    border: 1px solid rgba(147, 51, 234, 0.25);
                }
                .tag-slate {
                    background: linear-gradient(135deg, rgba(100, 116, 139, 0.15) 0%, rgba(100, 116, 139, 0.08) 100%);
                    color: #475569;
                    border: 1px solid rgba(100, 116, 139, 0.25);
                }
                .tag-link {
                    color: inherit !important;
                    text-decoration: none !important;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    transition: none !important;
                    cursor: pointer;
                    outline: none !important;
                    -webkit-tap-highlight-color: transparent !important;
                }
                .tag-link:hover {
                    text-decoration: none !important;
                    color: inherit !important;
                }
                .tag-link:active {
                    color: inherit !important;
                    text-decoration: none !important;
                }
                .tag-link:focus {
                    outline: none !important;
                    color: inherit !important;
                    text-decoration: none !important;
                }
                .tag:has(.tag-link) {
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .tag:has(.tag-link):hover {
                    transform: translateY(-1px);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }
                .tag:has(.tag-link):active {
                    transform: translateY(0px);
                    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
                }
                /* Dark theme overrides */
                body.vscode-dark .tag-green,
                body.vscode-high-contrast .tag-green {
                    background: linear-gradient(135deg, rgba(6, 78, 59, 0.4) 0%, rgba(6, 78, 59, 0.2) 100%);
                    color: #6ee7b7;
                    border: 1px solid rgba(6, 78, 59, 0.6);
                }
                body.vscode-dark .tag-red,
                body.vscode-high-contrast .tag-red {
                    background: linear-gradient(135deg, rgba(127, 29, 29, 0.4) 0%, rgba(127, 29, 29, 0.2) 100%);
                    color: #fca5a5;
                    border: 1px solid rgba(127, 29, 29, 0.6);
                }
                body.vscode-dark .tag-yellow,
                body.vscode-high-contrast .tag-yellow {
                    background: linear-gradient(135deg, rgba(120, 53, 15, 0.4) 0%, rgba(120, 53, 15, 0.2) 100%);
                    color: #fcd34d;
                    border: 1px solid rgba(120, 53, 15, 0.6);
                }
                body.vscode-dark .tag-amber,
                body.vscode-high-contrast .tag-amber {
                    background: linear-gradient(135deg, rgba(120, 53, 15, 0.4) 0%, rgba(120, 53, 15, 0.2) 100%);
                    color: #fcd34d;
                    border: 1px solid rgba(120, 53, 15, 0.6);
                }
                body.vscode-dark .tag-blue,
                body.vscode-high-contrast .tag-blue {
                    background: linear-gradient(135deg, rgba(30, 58, 138, 0.4) 0%, rgba(30, 58, 138, 0.2) 100%);
                    color: #93c5fd;
                    border: 1px solid rgba(30, 58, 138, 0.6);
                }
                body.vscode-dark .tag-purple,
                body.vscode-high-contrast .tag-purple {
                    background: linear-gradient(135deg, rgba(88, 28, 135, 0.4) 0%, rgba(88, 28, 135, 0.2) 100%);
                    color: #c4b5fd;
                    border: 1px solid rgba(88, 28, 135, 0.6);
                }
                body.vscode-dark .tag-slate,
                body.vscode-high-contrast .tag-slate {
                    background: linear-gradient(135deg, rgba(30, 41, 59, 0.5) 0%, rgba(30, 41, 59, 0.3) 100%);
                    color: #e2e8f0;
                    border: 1px solid rgba(30, 41, 59, 0.7);
                }
                @media (prefers-color-scheme: dark) {
                    .tag-green {
                        background: linear-gradient(135deg, rgba(6, 78, 59, 0.4) 0%, rgba(6, 78, 59, 0.2) 100%);
                        color: #34d399;
                        border: 1px solid rgba(6, 78, 59, 0.6);
                    }
                    .tag-red {
                        background: linear-gradient(135deg, rgba(127, 29, 29, 0.4) 0%, rgba(127, 29, 29, 0.2) 100%);
                        color: #f87171;
                        border: 1px solid rgba(127, 29, 29, 0.6);
                    }
                    .tag-yellow {
                        background: linear-gradient(135deg, rgba(120, 53, 15, 0.4) 0%, rgba(120, 53, 15, 0.2) 100%);
                        color: #fbbf24;
                        border: 1px solid rgba(120, 53, 15, 0.6);
                    }
                    .tag-amber {
                        background: linear-gradient(135deg, rgba(120, 53, 15, 0.4) 0%, rgba(120, 53, 15, 0.2) 100%);
                        color: #fbbf24;
                        border: 1px solid rgba(120, 53, 15, 0.6);
                    }
                    .tag-blue {
                        background: linear-gradient(135deg, rgba(30, 58, 138, 0.4) 0%, rgba(30, 58, 138, 0.2) 100%);
                        color: #60a5fa;
                        border: 1px solid rgba(30, 58, 138, 0.6);
                    }
                    .tag-purple {
                        background: linear-gradient(135deg, rgba(88, 28, 135, 0.4) 0%, rgba(88, 28, 135, 0.2) 100%);
                        color: #a78bfa;
                        border: 1px solid rgba(88, 28, 135, 0.6);
                    }
                    .tag-slate {
                        background: linear-gradient(135deg, rgba(30, 41, 59, 0.5) 0%, rgba(30, 41, 59, 0.3) 100%);
                        color: #cbd5e1;
                        border: 1px solid rgba(30, 41, 59, 0.7);
                    }
                }
                @media (max-width: 600px) {
                    .header {
                        padding: 16px 20px;
                    }
                    .header h1 {
                        font-size: 18px;
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 8px;
                    }
                    .content {
                        padding: 16px 20px;
                    }
                    .single-column {
                        gap: 12px;
                    }
                    .card {
                        padding: 12px 16px;
                    }
                    .platforms-support {
                        gap: 6px;
                        row-gap: 6px;
                    }
                    .tag {
                        padding: 4px 8px;
                        font-size: 11px;
                    }
                    .tag-icon {
                        width: 12px;
                        height: 12px;
                    }
                }
                .full-width {
                    grid-column: 1 / -1;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📦 ${packageName} ${packageInfo.version ? `<span class="version">v${packageInfo.version}</span>` : ''}</h1>
                </div>
                <div class="content">
                    <div class="single-column">
                        ${buildSingleColumnContent(packageName, packageInfo)}
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
}

function getCodeLensStatusText(status?: NewArchSupportStatus): string {
    switch (status) {
        case NewArchSupportStatus.Supported:
            return STATUS_LABELS.SUPPORTED;
        case NewArchSupportStatus.Unsupported:
            return STATUS_LABELS.UNSUPPORTED;
        case NewArchSupportStatus.Untested:
            return STATUS_LABELS.UNTESTED;
        case NewArchSupportStatus.Unlisted:
        default:
            return STATUS_LABELS.UNLISTED;
    }
}

function createStatusBadge(status?: NewArchSupportStatus, text?: string): string {
    let iconSvg = '';
    let variant = 'slate';

    switch (status) {
        case NewArchSupportStatus.Supported:
            iconSvg =
                '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><path d="m9 11 3 3L22 4"></path></svg>';
            variant = 'green';
            break;
        case NewArchSupportStatus.Unsupported:
            iconSvg =
                '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path></svg>';
            variant = 'red';
            break;
        case NewArchSupportStatus.Untested:
            iconSvg =
                '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
            variant = 'yellow';
            break;
        case NewArchSupportStatus.Unlisted:
        default:
            iconSvg =
                '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
            variant = 'slate';
            break;
    }

    return `<span class="tag tag-${variant}">${iconSvg}${text || 'Unlisted'}</span>`;
}

function createMaintenanceBadge(unmaintained?: boolean): string {
    if (unmaintained) {
        const iconSvg =
            '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"></rect><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"></path><path d="M10 12h4"></path></svg>';
        return `<span class="tag tag-amber">${iconSvg}Unmaintained</span>`;
    } else {
        const iconSvg =
            '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><path d="m9 11 3 3L22 4"></path></svg>';
        return `<span class="tag tag-green">${iconSvg}Actively maintained</span>`;
    }
}

function createPlatformBadge(platform: string, url?: string): string {
    let iconSvg = '';
    let variant = 'slate';

    switch (platform.toLowerCase()) {
        case 'ios':
            iconSvg =
                '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>';
            variant = 'blue';
            break;
        case 'android':
            iconSvg =
                '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>';
            variant = 'green';
            break;
        case 'web':
            iconSvg =
                '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';
            variant = 'purple';
            break;
        case 'windows':
            iconSvg =
                '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8"></path><path d="M10 19v-3.96 3.15"></path><path d="M7 19h5"></path><rect width="6" height="10" x="16" y="12" rx="2"></rect></svg>';
            variant = 'amber';
            break;
        case 'macos':
            iconSvg =
                '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"></path></svg>';
            variant = 'red';
            break;
        case 'fire os':
            iconSvg =
                '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"></path></svg>';
            variant = 'yellow';
            break;
        case 'meta horizon os':
            iconSvg =
                '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 12c0-8.5-6.5-8.5-6.5-8.5S4 3.5 4 12s6.5 8.5 6.5 8.5S17 20.5 17 12z"/><path d="M7 12c0-8.5 6.5-8.5 6.5-8.5S20 3.5 20 12s-6.5 8.5-6.5 8.5S7 20.5 7 12z"/></svg>';
            variant = 'blue';
            break;
        case 'vega os':
            iconSvg =
                '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><path d="M8 7v4a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7"/></svg>';
            variant = 'green';
            break;
        case 'typescript':
            iconSvg =
                '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"></path></svg>';
            variant = 'blue';
            break;
        case 'expo go':
            iconSvg =
                '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>';
            variant = 'green';
            break;
        case 'development only':
            iconSvg =
                '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>';
            variant = 'amber';
            break;
        case 'native code':
            iconSvg =
                '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-code-icon lucide-file-code"><path d="M10 12.5 8 15l2 2.5"/><path d="m14 12.5 2 2.5-2 2.5"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/></svg>';
            variant = 'purple';
            break;
        case 'config plugin':
            iconSvg =
                '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m10 13-2 2 2 2"/><path d="m14 17 2-2-2-2"/></svg>';
            variant = 'slate';
            break;
        default:
            iconSvg =
                '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 11c0 2.5-2.5 5-5 5s-5-2.5-5-5 2.5-5 5-5 5 2.5 5 5Z"></path><path d="m15.2 13.9 3 3 3-3"></path><path d="m2.8 10.1-3-3 3-3"></path><path d="m20.7 7-3 3 3 3"></path><path d="m6.3 17 3-3-3-3"></path></svg>';
            variant = 'slate';
            break;
    }

    if (url) {
        return `<span class="tag tag-${variant}"><a class="tag-link" href="${url}" target="_blank" rel="noopener noreferrer">${iconSvg}${platform}</a></span>`;
    }
    return `<span class="tag tag-${variant}">${iconSvg}${platform}</span>`;
}

function buildPlatformsAndSupportSection(packageInfo: PackageInfo): string | null {
    const badges = [];

    if (packageInfo.platforms) {
        if (packageInfo.platforms.ios) {
            badges.push(createPlatformBadge('iOS'));
        }
        if (packageInfo.platforms.android) {
            badges.push(createPlatformBadge('Android'));
        }
        if (packageInfo.platforms.web) {
            badges.push(createPlatformBadge('Web'));
        }
        if (packageInfo.platforms.windows) {
            badges.push(createPlatformBadge('Windows'));
        }
        if (packageInfo.platforms.macos) {
            badges.push(createPlatformBadge('macOS'));
        }
        if (packageInfo.platforms.fireos) {
            badges.push(createPlatformBadge('Fire OS'));
        }
        if (packageInfo.platforms.horizon) {
            badges.push(createPlatformBadge('Meta Horizon OS'));
        }
        if (packageInfo.platforms.vegaos) {
            const vegaosUrl =
                typeof packageInfo.platforms.vegaos === 'string'
                    ? `https://www.npmjs.com/package/${packageInfo.platforms.vegaos}`
                    : undefined;
            badges.push(createPlatformBadge('Vega OS', vegaosUrl));
        }
    }

    if (packageInfo.support) {
        if (packageInfo.support.hasTypes) {
            badges.push(createPlatformBadge('TypeScript'));
        }
        if (packageInfo.support.expoGo) {
            badges.push(createPlatformBadge('Expo Go'));
        }
        if (packageInfo.support.dev) {
            badges.push(createPlatformBadge('Development Only'));
        }
        if (packageInfo.support.hasNativeCode) {
            badges.push(createPlatformBadge('Native Code'));
        }
        if (packageInfo.support.configPlugin) {
            badges.push(createPlatformBadge('Config Plugin'));
        }
        // License is shown in Quick Links section instead
    }

    if (badges.length === 0) {
        return null;
    }

    const platformsIcon =
        '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>';
    return `
        <div class="card">
            <div class="card-title">${platformsIcon}Platforms & Support</div>
            <div class="card-content platforms-support">${badges.join('')}</div>
        </div>
    `;
}

function buildSingleColumnContent(packageName: string, packageInfo: PackageInfo): string {
    let content = '';

    const isInternalPackage = INTERNAL_PACKAGES.includes(packageName);
    const isUnlistedStatus = packageInfo.newArchitecture === NewArchSupportStatus.Unlisted;

    let descriptionContent = '';
    if (packageInfo.github?.description) {
        descriptionContent = packageInfo.github.description;
    }

    if (isInternalPackage && isUnlistedStatus) {
        if (descriptionContent) {
            descriptionContent += '<br><br>';
        }
        descriptionContent +=
            '<em>Core dependency required by React Native. Not listed in the directory but fully compatible with the New Architecture.</em>';
    }

    if (descriptionContent) {
        const descriptionIcon =
            '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14,2 14,8 20,8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10,9 9,9 8,9"></polyline></svg>';
        content += `
            <div class="card">
                <div class="card-title">${descriptionIcon}Description</div>
                <div class="card-content description">${descriptionContent}</div>
            </div>
        `;
    }

    const statusClass = getStatusClass(packageInfo.newArchitecture);
    const codeLensStatusText = getCodeLensStatusText(packageInfo.newArchitecture);

    const statusBadge = createStatusBadge(packageInfo.newArchitecture, codeLensStatusText);
    let statusContent = `<div class="status-row">${statusBadge}`;

    if (packageInfo.newArchitecture && packageInfo.newArchitecture !== NewArchSupportStatus.Unlisted) {
        const maintenanceBadge = createMaintenanceBadge(packageInfo.unmaintained);
        statusContent += maintenanceBadge;
    }

    statusContent += `</div>`;

    const statusIcon =
        '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><path d="m9 11 3 3L22 4"></path></svg>';
    content += `
        <div class="card ${statusClass}">
            <div class="card-title">${statusIcon}Status</div>
            <div class="card-content">${statusContent}</div>
        </div>
    `;

    const platformsAndSupport = buildPlatformsAndSupportSection(packageInfo);
    if (platformsAndSupport) {
        content += platformsAndSupport;
    }

    if (packageInfo.alternatives && packageInfo.alternatives.length > 0) {
        const alternativesIcon =
            '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 11c0 2.5-2.5 5-5 5s-5-2.5-5-5 2.5-5 5-5 5 2.5 5 5Z"></path><path d="m15.2 13.9 3 3 3-3"></path><path d="m2.8 10.1-3-3 3-3"></path><path d="m20.7 7-3 3 3 3"></path><path d="m6.3 17 3-3-3-3"></path></svg>';
        const npmIcon =
            '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 5" fill="currentColor"><path d="M0,0v5h5V1h1v4h1V0H0z M10,0v5h2V1h1v4h1V1h1v4h1V0H10z"/></svg>';
        const alternativesList = packageInfo.alternatives
            .map(
                (alt) =>
                    `<span class="tag tag-blue"><a href="https://www.npmjs.com/package/${alt}" target="_blank" class="tag-link">${npmIcon}${alt}</a></span>`
            )
            .join('');
        content += `
            <div class="card">
                <div class="card-title">${alternativesIcon}Alternatives</div>
                <div class="card-content platforms-support">${alternativesList}</div>
            </div>
        `;
    }

    const basicLinks = [];

    if (packageInfo.newArchitecture !== NewArchSupportStatus.Unlisted) {
        const directoryIcon =
            '<svg class="tag-icon" width="14" height="14" viewBox="0 0 25 22" fill="none"><path d="M12.029 13.03a2.334 2.334 0 002.343-2.325 2.334 2.334 0 00-2.343-2.326 2.334 2.334 0 00-2.343 2.325 2.334 2.334 0 002.343 2.326zM18.88 1.794c-.16-.74-.466-1.183-.851-1.404-.385-.22-.926-.262-1.65-.03-.725.234-1.571.723-2.485 1.46-.35.283-.708.6-1.068.947a27.206 27.206 0 012.225 2.743c1.246.114 2.424.298 3.505.54.123-.483.221-.948.293-1.391.186-1.154.19-2.125.03-2.865zM10.163 1.82c.351.283.708.6 1.068.947A27.215 27.215 0 009.007 5.51a27.564 27.564 0 00-3.506.54c-.123-.483-.22-.948-.292-1.391-.186-1.153-.19-2.125-.031-2.865.16-.74.466-1.183.85-1.403C6.415.17 6.955.128 7.68.36s1.57.722 2.484 1.459zM19.354 7.421a27.05 27.05 0 01-1.281 3.284 27.04 27.04 0 011.28 3.283c.484-.136.939-.284 1.361-.444 1.1-.417 1.95-.9 2.515-1.406.566-.507.8-.992.8-1.433 0-.442-.234-.927-.8-1.434-.565-.506-1.415-.988-2.515-1.405-.422-.16-.877-.309-1.36-.445zM15.05 15.9a27.207 27.207 0 01-2.224 2.742c.36.348.718.664 1.069.947.913.737 1.759 1.227 2.483 1.46.725.232 1.266.19 1.65-.03.386-.221.693-.665.852-1.404.16-.74.155-1.711-.031-2.864-.072-.444-.17-.909-.293-1.392a27.56 27.56 0 01-3.505.54zM9.007 15.9a27.21 27.21 0 002.224 2.742c-.36.348-.717.664-1.068.947-.913.737-1.759 1.227-2.484 1.46-.725.232-1.265.19-1.65-.03-.385-.221-.692-.665-.851-1.404-.16-.74-.155-1.711.031-2.864.071-.444.17-.909.292-1.392a27.56 27.56 0 003.506.54zM4.704 13.988c.329-1.05.758-2.155 1.28-3.283a27.043 27.043 0 01-1.28-3.284c-.483.136-.938.285-1.36.445-1.1.417-1.95.899-2.516 1.405-.565.507-.8.992-.8 1.434 0 .441.235.926.8 1.433.566.507 1.416.989 2.515 1.405.423.16.877.31 1.36.445z" fill="#61DAFB"></path></svg>';
        const directoryUrl = `${EXTERNAL_URLS.REACT_NATIVE_DIRECTORY_BASE}/package/${packageName}`;
        basicLinks.push(
            `<span class="tag tag-blue"><a href="${directoryUrl}" target="_blank" class="tag-link">${directoryIcon}Directory</a></span>`
        );
    }
    if (packageInfo.npmUrl) {
        const npmIcon =
            '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 5" fill="currentColor"><path d="M0,0v5h5V1h1v4h1V0H0z M10,0v5h2V1h1v4h1V1h1v4h1V0H10z"/></svg>';
        basicLinks.push(
            `<span class="tag tag-red"><a href="${packageInfo.npmUrl}" target="_blank" class="tag-link">${npmIcon}NPM Registry</a></span>`
        );
    }
    if (packageInfo.githubUrl) {
        const githubIcon =
            '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>';
        basicLinks.push(
            `<span class="tag tag-slate"><a href="${packageInfo.githubUrl}" target="_blank" class="tag-link">${githubIcon}Source Code</a></span>`
        );
    }
    if (packageInfo.support?.licenseUrl) {
        const licenseIcon =
            '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14,2 14,8 20,8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10,9 9,9 8,9"></polyline></svg>';
        basicLinks.push(
            `<span class="tag tag-purple"><a href="${packageInfo.support.licenseUrl}" target="_blank" class="tag-link">${licenseIcon}License</a></span>`
        );
    }

    if (basicLinks.length > 0) {
        const linksIcon =
            '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>';
        content += `
            <div class="card">
                <div class="card-title">${linksIcon}Quick Links</div>
                <div class="card-content platforms-support">${basicLinks.join('')}</div>
            </div>
        `;
    }

    const exploreLinks = generateExploreLinks(packageName, packageInfo);
    if (exploreLinks.length > 0) {
        const exploreIcon =
            '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>';
        content += `
            <div class="card">
                <div class="card-title">${exploreIcon}Explore & Research</div>
                <div class="card-content platforms-support">${exploreLinks.join('')}</div>
            </div>
        `;
    }

    return content;
}

function generateExploreLinks(packageName: string, packageInfo: PackageInfo): string[] {
    const links: string[] = [];

    if (!packageInfo.githubUrl) {
        return links;
    }

    const issueIcon =
        '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="1"></circle></svg>';
    const prIcon =
        '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M13 6h3a2 2 0 0 1 2 2v7"></path><line x1="6" y1="9" x2="6" y2="21"></line></svg>';
    const usersIcon =
        '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>';
    const forkIcon =
        '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><circle cx="18" cy="6" r="3"></circle><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"></path><path d="M12 12v3"></path></svg>';
    const packageIcon =
        '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 9.4 7.55 4.24"></path><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.29,7 12,12 20.71,7"></polyline><line x1="12" y1="22" x2="12" y2="12"></line></svg>';
    const docIcon =
        '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14,2 14,8 20,8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10,9 9,9 8,9"></polyline></svg>';

    if (packageInfo.unmaintained) {
        links.push(
            `<span class="tag tag-amber"><a href="${getMaintenanceIssuesUrl(packageInfo.githubUrl)}" target="_blank" class="tag-link">${issueIcon}Maintenance Issues</a></span>`
        );
        links.push(
            `<span class="tag tag-yellow"><a href="${getMaintenancePRSearchUrl(packageInfo.githubUrl)}" target="_blank" class="tag-link">${prIcon}Stale Pull Requests</a></span>`
        );
        links.push(
            `<span class="tag tag-blue"><a href="${getContributorsActivityUrl(packageInfo.githubUrl)}" target="_blank" class="tag-link">${usersIcon}Contributor Activity</a></span>`
        );
        links.push(
            `<span class="tag tag-purple"><a href="${getActiveForksUrl(packageInfo.githubUrl)}" target="_blank" class="tag-link">${forkIcon}Active Forks</a></span>`
        );
    }

    if (packageInfo.newArchitecture === NewArchSupportStatus.Supported) {
        links.push(
            `<span class="tag tag-green"><a href="${getNewArchMergedPRSearchUrl(packageInfo.githubUrl)}" target="_blank" class="tag-link">${prIcon}New Architecture PRs</a></span>`
        );
    }

    if (
        packageInfo.newArchitecture === NewArchSupportStatus.Untested ||
        packageInfo.newArchitecture === NewArchSupportStatus.Unsupported
    ) {
        links.push(
            `<span class="tag tag-yellow"><a href="${getNewArchIssueSearchUrl(packageInfo.githubUrl)}" target="_blank" class="tag-link">${issueIcon}New Architecture Issues</a></span>`
        );
        links.push(
            `<span class="tag tag-blue"><a href="${getNewArchPRSearchUrl(packageInfo.githubUrl)}" target="_blank" class="tag-link">${prIcon}New Architecture PRs</a></span>`
        );
    }

    links.push(
        `<span class="tag tag-purple"><a href="${getBundlePhobiaUrl(packageName, packageInfo.version)}" target="_blank" class="tag-link">${packageIcon}Bundle Analysis</a></span>`
    );
    links.push(
        `<span class="tag tag-blue"><a href="${getReadmeUrl(packageInfo.githubUrl)}" target="_blank" class="tag-link">${docIcon}Documentation</a></span>`
    );

    return links;
}
