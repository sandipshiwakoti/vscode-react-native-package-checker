import * as vscode from 'vscode';
import { generateCheckUrl, extractPackagesFromPackageJson } from '../utils/checkerUtils';
import { EXTENSION_CONFIG, UI_CONFIG } from '../constants';

let currentPanel: vscode.WebviewPanel | undefined;
let currentPackages: Array<{ name: string; version: string }> = [];

export function createCheckerPanel(context: vscode.ExtensionContext): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.endsWith(EXTENSION_CONFIG.PACKAGE_JSON_FILENAME)) {
        vscode.window.showErrorMessage('Please open a package.json file first');
        return;
    }

    const packages = extractPackagesFromPackageJson(editor.document.getText());
    if (packages.length === 0) {
        vscode.window.showErrorMessage('No dependencies found in package.json');
        return;
    }

    currentPackages = packages;
    const checkUrl = generateCheckUrl(packages);

    if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.Active);
        currentPanel.webview.html = getCheckerContent(checkUrl);
    } else {
        currentPanel = vscode.window.createWebviewPanel(
            UI_CONFIG.CHECKER_PANEL_ID,
            UI_CONFIG.EXTENSION_NAME,
            vscode.ViewColumn.Active,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                enableCommandUris: true
            }
        );

        currentPanel.iconPath = {
            light: vscode.Uri.joinPath(context.extensionUri, UI_CONFIG.LOGO_PATH),
            dark: vscode.Uri.joinPath(context.extensionUri, UI_CONFIG.LOGO_PATH)
        };

        currentPanel.webview.html = getCheckerContent(checkUrl);

        currentPanel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case UI_CONFIG.WEBVIEW_COMMAND_OPEN_EXTERNAL:
                        vscode.env.openExternal(vscode.Uri.parse(message.url));
                        return;
                }
            },
            undefined,
            context.subscriptions
        );

        currentPanel.onDidDispose(() => {
            currentPanel = undefined;
            currentPackages = [];
        }, null, context.subscriptions);

        const themeChangeDisposable = vscode.window.onDidChangeActiveColorTheme(() => {
            if (currentPanel && currentPackages.length > 0) {
                const newCheckUrl = generateCheckUrl(currentPackages);
                currentPanel.webview.html = getCheckerContent(newCheckUrl);
            }
        });

        context.subscriptions.push(themeChangeDisposable);
    }
}

function getCheckerContent(url: string): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${UI_CONFIG.EXTENSION_NAME}</title>
            <style>
                body, html {
                    margin: 0;
                    padding: 0;
                    height: 100vh;
                    overflow: hidden;
                    background-color: var(--vscode-editor-background);
                }
                iframe {
                    width: 100%;
                    height: 100vh;
                    border: none;
                    display: block;
                }
                .loading {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                }
            </style>
            <script>
                const vscode = acquireVsCodeApi();
                
                window.addEventListener('message', (event) => {
                    if (event.data.type === 'click' && event.data.url) {
                        if (event.data.url.startsWith('http')) {
                            vscode.postMessage({
                                command: '${UI_CONFIG.WEBVIEW_COMMAND_OPEN_EXTERNAL}',
                                url: event.data.url
                            });
                        }
                    }
                });
            </script>
        </head>
        <body>
            <div class="loading" id="loading">Loading React Native Package Checker...</div>
            <iframe 
                id="checker-iframe"
                src="${url}"
                style="display: none;"
                onload="
                    document.getElementById('loading').style.display='none'; 
                    this.style.display='block';
                "
            ></iframe>
        </body>
        </html>
    `;
}