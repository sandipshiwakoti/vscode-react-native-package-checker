import * as vscode from 'vscode';

export class LoadingNotificationService {
    private activeNotifications = new Map<string, { dispose: () => void }>();

    showLoading(message: string, _id?: string): { dispose: () => void } {
        const notificationId = _id || this.generateId();

        if (this.activeNotifications.has(notificationId)) {
            this.hideLoading(notificationId);
        }

        let resolveProgress: (() => void) | null = null;

        vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: message,
                cancellable: false,
            },
            async () => {
                return new Promise<void>((resolve) => {
                    resolveProgress = resolve;
                });
            }
        );

        const disposable = {
            dispose: () => {
                if (resolveProgress) {
                    resolveProgress();
                    resolveProgress = null;
                }
                this.activeNotifications.delete(notificationId);
            },
        };

        this.activeNotifications.set(notificationId, disposable);
        return disposable;
    }

    hideLoading(disposableOrId: { dispose: () => void } | string): void {
        if (typeof disposableOrId === 'string') {
            const disposable = this.activeNotifications.get(disposableOrId);
            if (disposable) {
                this.disposeNotification(disposable);
                this.activeNotifications.delete(disposableOrId);
            }
        } else {
            this.disposeNotification(disposableOrId);
            for (const [_id, notification] of this.activeNotifications.entries()) {
                if (notification === disposableOrId) {
                    this.activeNotifications.delete(_id);
                    break;
                }
            }
        }
    }

    showLoadingForPackages(packageNames: string[]): { dispose: () => void } {
        const packageCount = packageNames.length;
        const message =
            packageCount === 1
                ? `Checking version for ${packageNames[0]}...`
                : `Checking versions for ${packageCount} packages...`;

        return this.showLoading(message, 'package-version-check');
    }

    hideAllLoading(): void {
        for (const [_id, disposable] of this.activeNotifications.entries()) {
            this.disposeNotification(disposable);
        }
        this.activeNotifications.clear();
    }

    private disposeNotification(disposable: { dispose: () => void }): void {
        try {
            disposable.dispose();
        } catch (error) {
            console.error('Error disposing notification:', error);
        }
    }

    private generateId(): string {
        return `loading-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }

    dispose(): void {
        this.hideAllLoading();
    }
}
