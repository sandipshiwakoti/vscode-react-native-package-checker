import * as vscode from 'vscode';
import * as path from 'path';
import { PackageInfo, NewArchSupportStatus } from '../types';
import { getStatusClass } from '../utils/statusUtils';
import { STATUS_LABELS } from '../constants';
import {
    getNewArchIssueSearchUrl,
    getNewArchPRSearchUrl,
    getNewArchMergedPRSearchUrl,
    getMaintenanceIssuesUrl,
    getMaintenancePRSearchUrl,
    getContributorsActivityUrl,
    getActiveForksUrl,
    getReadmeUrl,
    getBundlePhobiaUrl
} from '../utils/urlUtils';

const openPanels = new Map<string, vscode.WebviewPanel>();

export function createPackageDetailsPanel(packageName: string, packageInfo: PackageInfo, context?: vscode.ExtensionContext): vscode.WebviewPanel {
    const existingPanel = openPanels.get(packageName);
    if (existingPanel) {
        existingPanel.reveal(vscode.ViewColumn.Beside);
        return existingPanel;
    }

    const panel = vscode.window.createWebviewPanel(
        'packageDetails',
        `${packageName} - Package Details`,
        vscode.ViewColumn.Beside,
        {
            enableScripts: false,
            retainContextWhenHidden: true
        }
    );
    if (context) {
        panel.iconPath = vscode.Uri.file(path.join(context.extensionPath, 'assets', 'logo.svg'));
    }

    panel.webview.html = generateWebviewContent(packageName, packageInfo);

    openPanels.set(packageName, panel);
    panel.onDidDispose(() => {
        openPanels.delete(packageName);
    });

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
                    background-color: var(--vscode-editor-background);
                    font-size: 13px;
                }
                .header {
                    background: var(--vscode-titleBar-activeBackground);
                    padding: 16px 20px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    flex-shrink: 0;
                }
                .header h1 { 
                    margin: 0;
                    color: var(--vscode-titleBar-activeForeground);
                    font-size: 20px;
                    font-weight: 600;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .version {
                    font-size: 14px;
                    font-weight: 400;
                    opacity: 0.8;
                }
                .container {
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                }
                .content {
                    flex: 1;
                    padding: 16px;
                    overflow-y: auto;
                    overflow-x: hidden;
                }
                .single-column {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    max-width: 800px;
                    margin: 0 auto;
                }
                .card {
                    background: var(--vscode-textBlockQuote-background);
                    border-radius: 6px;
                    border-left: 3px solid var(--vscode-textLink-foreground);
                    padding: 12px;
                }
                .card-content {
                    color: var(--vscode-foreground);
                    font-size: 13px;
                    line-height: 1.4;
                }
                .card-title {
                    font-weight: 600;
                    color: var(--vscode-textPreformat-foreground);
                    margin-bottom: 6px;
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .status-supported { border-left-color: #10b981; }
                .status-unsupported { border-left-color: #ef4444; }
                .status-untested { border-left-color: #f59e0b; }
                .status-unknown { border-left-color: #6b7280; }
                .links-container {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                .link-item {
                    background: var(--vscode-button-secondaryBackground);
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    white-space: nowrap;
                }
                .link-item a {
                    color: var(--vscode-textLink-foreground);
                    text-decoration: none;
                    font-weight: 500;
                }
                .link-item:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
                }
                .description {
                    word-wrap: break-word;
                    white-space: pre-wrap;
                    color: var(--vscode-descriptionForeground);
                    opacity: 0.9;
                }
                .platforms, .support-info, .platforms-support {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    row-gap: 6px;
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
                    gap: 4px;
                    padding: 4px 8px;
                    border-radius: 6px;
                    font-size: 11px;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                .tag-icon {
                    width: 12px;
                    height: 12px;
                    flex-shrink: 0;
                }
                .tag-green {
                    background: rgba(16, 185, 129, 0.15);
                    color: #059669;
                    border: 1px solid rgba(16, 185, 129, 0.3);
                }
                .tag-red {
                    background: rgba(239, 68, 68, 0.15);
                    color: #dc2626;
                    border: 1px solid rgba(239, 68, 68, 0.3);
                }
                .tag-yellow {
                    background: rgba(245, 158, 11, 0.15);
                    color: #d97706;
                    border: 1px solid rgba(245, 158, 11, 0.3);
                }
                .tag-amber {
                    background: rgba(245, 158, 11, 0.15);
                    color: #d97706;
                    border: 1px solid rgba(245, 158, 11, 0.3);
                }
                .tag-blue {
                    background: rgba(59, 130, 246, 0.15);
                    color: #2563eb;
                    border: 1px solid rgba(59, 130, 246, 0.3);
                }
                .tag-purple {
                    background: rgba(147, 51, 234, 0.15);
                    color: #7c3aed;
                    border: 1px solid rgba(147, 51, 234, 0.3);
                }
                .tag-slate {
                    background: rgba(100, 116, 139, 0.15);
                    color: #475569;
                    border: 1px solid rgba(100, 116, 139, 0.3);
                }
                
                /* Dark theme overrides */
                body.vscode-dark .tag-green,
                body.vscode-high-contrast .tag-green {
                    background: #064e3b;
                    color: #6ee7b7;
                    border: 1px solid #065f46;
                    box-shadow: 0 0 8px rgba(110, 231, 183, 0.2);
                }
                body.vscode-dark .tag-red,
                body.vscode-high-contrast .tag-red {
                    background: #7f1d1d;
                    color: #fca5a5;
                    border: 1px solid #991b1b;
                    box-shadow: 0 0 8px rgba(252, 165, 165, 0.2);
                }
                body.vscode-dark .tag-yellow,
                body.vscode-high-contrast .tag-yellow {
                    background: #78350f;
                    color: #fcd34d;
                    border: 1px solid #92400e;
                    box-shadow: 0 0 8px rgba(252, 211, 77, 0.2);
                }
                body.vscode-dark .tag-amber,
                body.vscode-high-contrast .tag-amber {
                    background: #78350f;
                    color: #fcd34d;
                    border: 1px solid #92400e;
                    box-shadow: 0 0 8px rgba(252, 211, 77, 0.2);
                }
                body.vscode-dark .tag-blue,
                body.vscode-high-contrast .tag-blue {
                    background: #1e3a8a;
                    color: #93c5fd;
                    border: 1px solid #1d4ed8;
                    box-shadow: 0 0 8px rgba(147, 197, 253, 0.2);
                }
                body.vscode-dark .tag-purple,
                body.vscode-high-contrast .tag-purple {
                    background: #581c87;
                    color: #c4b5fd;
                    border: 1px solid #6b21a8;
                    box-shadow: 0 0 8px rgba(196, 181, 253, 0.2);
                }
                body.vscode-dark .tag-slate,
                body.vscode-high-contrast .tag-slate {
                    background: #334155;
                    color: #e2e8f0;
                    border: 1px solid #475569;
                    box-shadow: 0 0 8px rgba(226, 232, 240, 0.15);
                }
                .tag-link {
                    color: inherit;
                    text-decoration: none;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .tag-link:hover {
                    text-decoration: none;
                }
                @media (prefers-color-scheme: dark) {
                    .tag-green {
                        background: rgba(6, 78, 59, 0.3);
                        color: #34d399;
                        border: 1px solid rgba(6, 78, 59, 0.5);
                    }
                    .tag-red {
                        background: rgba(127, 29, 29, 0.3);
                        color: #f87171;
                        border: 1px solid rgba(127, 29, 29, 0.5);
                    }
                    .tag-yellow {
                        background: rgba(120, 53, 15, 0.3);
                        color: #fbbf24;
                        border: 1px solid rgba(120, 53, 15, 0.5);
                    }
                    .tag-amber {
                        background: rgba(120, 53, 15, 0.3);
                        color: #fbbf24;
                        border: 1px solid rgba(120, 53, 15, 0.5);
                    }
                    .tag-blue {
                        background: rgba(30, 58, 138, 0.3);
                        color: #60a5fa;
                        border: 1px solid rgba(30, 58, 138, 0.5);
                    }
                    .tag-purple {
                        background: rgba(88, 28, 135, 0.3);
                        color: #a78bfa;
                        border: 1px solid rgba(88, 28, 135, 0.5);
                    }
                    .tag-slate {
                        background: rgba(30, 41, 59, 0.5);
                        color: #cbd5e1;
                        border: 1px solid rgba(30, 41, 59, 0.7);
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
            return STATUS_LABELS.UNKNOWN;
    }
}

function createStatusBadge(status?: NewArchSupportStatus, text?: string): string {
    let iconSvg = '';
    let variant = 'slate';
    
    switch (status) {
        case NewArchSupportStatus.Supported:
            iconSvg = '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><path d="m9 11 3 3L22 4"></path></svg>';
            variant = 'green';
            break;
        case NewArchSupportStatus.Unsupported:
            iconSvg = '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path></svg>';
            variant = 'red';
            break;
        case NewArchSupportStatus.Untested:
            iconSvg = '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
            variant = 'yellow';
            break;
        case NewArchSupportStatus.Unlisted:
        default:
            iconSvg = '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
            variant = 'slate';
            break;
    }
    
    return `<span class="tag tag-${variant}">${iconSvg}${text || 'Unknown'}</span>`;
}

function createMaintenanceBadge(unmaintained?: boolean): string {
    if (unmaintained) {
        const iconSvg = '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"></rect><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"></path><path d="M10 12h4"></path></svg>';
        return `<span class="tag tag-amber">${iconSvg}Unmaintained</span>`;
    } else {
        const iconSvg = '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><path d="m9 11 3 3L22 4"></path></svg>';
        return `<span class="tag tag-green">${iconSvg}Actively maintained</span>`;
    }
}

function createPlatformBadge(platform: string): string {
    let iconSvg = '';
    let variant = 'slate';
    
    switch (platform.toLowerCase()) {
        case 'ios':
            iconSvg = '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>';
            variant = 'blue';
            break;
        case 'android':
            iconSvg = '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>';
            variant = 'green';
            break;
        case 'web':
            iconSvg = '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';
            variant = 'purple';
            break;
        case 'windows':
            iconSvg = '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8"></path><path d="M10 19v-3.96 3.15"></path><path d="M7 19h5"></path><rect width="6" height="10" x="16" y="12" rx="2"></rect></svg>';
            variant = 'slate';
            break;
        case 'macos':
            iconSvg = '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"></path></svg>';
            variant = 'slate';
            break;
        case 'fire os':
            iconSvg = '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"></path></svg>';
            variant = 'amber';
            break;
        case 'typescript':
            iconSvg = '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"></path></svg>';
            variant = 'blue';
            break;
        case 'expo go':
            iconSvg = '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>';
            variant = 'slate';
            break;
        case 'development only':
            iconSvg = '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>';
            variant = 'slate';
            break;
        default:
            iconSvg = '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 11c0 2.5-2.5 5-5 5s-5-2.5-5-5 2.5-5 5-5 5 2.5 5 5Z"></path><path d="m15.2 13.9 3 3 3-3"></path><path d="m2.8 10.1-3-3 3-3"></path><path d="m20.7 7-3 3 3 3"></path><path d="m6.3 17 3-3-3-3"></path></svg>';
            variant = 'slate';
            break;
    }
    
    return `<span class="tag tag-${variant}">${iconSvg}${platform}</span>`;
}

function buildPlatformsAndSupportSection(packageInfo: PackageInfo): string | null {
    const badges = [];
    
    if (packageInfo.platforms) {
        if (packageInfo.platforms.ios) { badges.push(createPlatformBadge('iOS')); }
        if (packageInfo.platforms.android) { badges.push(createPlatformBadge('Android')); }
        if (packageInfo.platforms.web) { badges.push(createPlatformBadge('Web')); }
        if (packageInfo.platforms.windows) { badges.push(createPlatformBadge('Windows')); }
        if (packageInfo.platforms.macos) { badges.push(createPlatformBadge('macOS')); }
        if (packageInfo.platforms.fireos) { badges.push(createPlatformBadge('Fire OS')); }
    }
    
    if (packageInfo.support) {
        if (packageInfo.support.hasTypes) { badges.push(createPlatformBadge('TypeScript')); }
        if (packageInfo.support.expoGo) { badges.push(createPlatformBadge('Expo Go')); }
        if (packageInfo.support.dev) { badges.push(createPlatformBadge('Development Only')); }
        if (packageInfo.support.license) { badges.push(createPlatformBadge(packageInfo.support.license)); }
    }
    
    if (badges.length === 0) {
        return null;
    }
    
    return `
        <div class="card">
            <div class="card-title">Platforms & Support</div>
            <div class="card-content platforms-support">${badges.join('')}</div>
        </div>
    `;
}

function buildSingleColumnContent(packageName: string, packageInfo: PackageInfo): string {
    let content = '';

    if (packageInfo.github?.description) {
        content += `
            <div class="card">
                <div class="card-title">Description</div>
                <div class="card-content description">${packageInfo.github.description}</div>
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
    
    content += `
        <div class="card ${statusClass}">
            <div class="card-title">Status</div>
            <div class="card-content">${statusContent}</div>
        </div>
    `;

    const platformsAndSupport = buildPlatformsAndSupportSection(packageInfo);
    if (platformsAndSupport) {
        content += platformsAndSupport;
    }

    if (packageInfo.alternatives && packageInfo.alternatives.length > 0) {
        content += `
            <div class="card">
                <div class="card-title">Alternatives</div>
                <div class="card-content">${packageInfo.alternatives.join(', ')}</div>
            </div>
        `;
    }

    const basicLinks = [];
    if (packageInfo.npmUrl) {
        const npmIcon = '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 5" fill="currentColor"><path d="M0,0v5h5V1h1v4h1V0H0z M10,0v5h2V1h1v4h1V1h1v4h1V0H10z"/></svg>';
        basicLinks.push(`<span class="tag tag-slate"><a href="${packageInfo.npmUrl}" target="_blank" class="tag-link">${npmIcon}NPM</a></span>`);
    }
    if (packageInfo.githubUrl) {
        const githubIcon = '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>';
        basicLinks.push(`<span class="tag tag-slate"><a href="${packageInfo.githubUrl}" target="_blank" class="tag-link">${githubIcon}GitHub</a></span>`);
    }
    if (packageInfo.support?.licenseUrl) {
        const licenseIcon = '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14,2 14,8 20,8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10,9 9,9 8,9"></polyline></svg>';
        basicLinks.push(`<span class="tag tag-slate"><a href="${packageInfo.support.licenseUrl}" target="_blank" class="tag-link">${licenseIcon}License</a></span>`);
    }
    
    if (basicLinks.length > 0) {
        content += `
            <div class="card">
                <div class="card-title">Links</div>
                <div class="card-content platforms-support">${basicLinks.join('')}</div>
            </div>
        `;
    }

    const exploreLinks = generateExploreLinks(packageName, packageInfo);
    if (exploreLinks.length > 0) {
        content += `
            <div class="card">
                <div class="card-title">Explore More</div>
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

    const circleDotIcon = '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="1"></circle></svg>';
    const gitPullRequestIcon = '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M13 6h3a2 2 0 0 1 2 2v7"></path><line x1="6" y1="9" x2="6" y2="21"></line></svg>';
    const usersIcon = '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>';
    const gitForkIcon = '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><circle cx="18" cy="6" r="3"></circle><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"></path><path d="M12 12v3"></path></svg>';
    const packageIcon = '<svg class="tag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 9.4 7.55 4.24"></path><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.29,7 12,12 20.71,7"></polyline><line x1="12" y1="22" x2="12" y2="12"></line></svg>';

    if (packageInfo.unmaintained) {
        links.push(`<span class="tag tag-slate"><a href="${getMaintenanceIssuesUrl(packageInfo.githubUrl)}" target="_blank" class="tag-link">${circleDotIcon}Maintenance Open Issues</a></span>`);
        links.push(`<span class="tag tag-slate"><a href="${getMaintenancePRSearchUrl(packageInfo.githubUrl)}" target="_blank" class="tag-link">${gitPullRequestIcon}Stale PRs</a></span>`);
        links.push(`<span class="tag tag-slate"><a href="${getContributorsActivityUrl(packageInfo.githubUrl)}" target="_blank" class="tag-link">${usersIcon}Contributors Activity</a></span>`);
        links.push(`<span class="tag tag-slate"><a href="${getActiveForksUrl(packageInfo.githubUrl)}" target="_blank" class="tag-link">${gitForkIcon}Most Active Forks</a></span>`);
    }

    if (packageInfo.newArchitecture === NewArchSupportStatus.Supported) {
        links.push(`<span class="tag tag-slate"><a href="${getNewArchMergedPRSearchUrl(packageInfo.githubUrl)}" target="_blank" class="tag-link">${gitPullRequestIcon}New Arch Merged PRs</a></span>`);
    }

    if (packageInfo.newArchitecture === NewArchSupportStatus.Untested || packageInfo.newArchitecture === NewArchSupportStatus.Unsupported) {
        links.push(`<span class="tag tag-slate"><a href="${getNewArchIssueSearchUrl(packageInfo.githubUrl)}" target="_blank" class="tag-link">${circleDotIcon}New Arch Open Issues</a></span>`);
        links.push(`<span class="tag tag-slate"><a href="${getNewArchPRSearchUrl(packageInfo.githubUrl)}" target="_blank" class="tag-link">${gitPullRequestIcon}New Arch Open PRs</a></span>`);
    }

    links.push(`<span class="tag tag-slate"><a href="${getBundlePhobiaUrl(packageName, packageInfo.version)}" target="_blank" class="tag-link">${packageIcon}Bundle Size Analysis</a></span>`);
    links.push(`<span class="tag tag-slate"><a href="${getReadmeUrl(packageInfo.githubUrl)}" target="_blank" class="tag-link">${circleDotIcon}Documentation</a></span>`);

    return links;
}
