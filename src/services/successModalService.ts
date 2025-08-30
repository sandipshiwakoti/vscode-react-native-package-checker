import * as vscode from 'vscode';

export class SuccessModalService {
    private static isModalShowing = false;

    static async showRequirementsFulfilledModal(targetVersion: string): Promise<void> {
        // Prevent multiple modals from showing simultaneously
        if (this.isModalShowing) {
            return;
        }

        this.isModalShowing = true;

        try {
            const message = `All dependencies meet React Native ${targetVersion} requirements!`;

            await vscode.window.showInformationMessage(
                message,
                {
                    modal: true,
                    detail: `🎉 Congratulations! All package requirements have been fulfilled for React Native ${targetVersion}. Your project is ready to go.`,
                },
                'OK'
            );
        } finally {
            this.isModalShowing = false;
        }
    }

    static async showRequirementsAppliedModal(appliedCount: number, targetVersion: string): Promise<void> {
        // Prevent multiple modals from showing simultaneously
        if (this.isModalShowing) {
            return;
        }

        this.isModalShowing = true;

        try {
            const message = `Successfully applied ${appliedCount} requirement${appliedCount === 1 ? '' : 's'}!`;
            const detail =
                appliedCount === 1
                    ? `🎉 1 package has been updated for React Native ${targetVersion}.`
                    : `🎉 ${appliedCount} packages have been updated for React Native ${targetVersion}.`;

            await vscode.window.showInformationMessage(
                message,
                {
                    modal: true,
                    detail,
                },
                'OK'
            );
        } finally {
            this.isModalShowing = false;
        }
    }

    static dispose(): void {
        // No cleanup needed for native modals
    }
}
