import * as vscode from 'vscode';

import { DependencyCheckService } from '../services/dependencyCheckService';
import { LoggerService } from '../services/loggerService';

export async function enableDependencyCheck(service: DependencyCheckService, logger: LoggerService): Promise<void> {
    try {
        if (service.isEnabled()) {
            vscode.window.showWarningMessage(
                'Dependency check is already enabled. Use "Reset dependency check" to change the target version.'
            );
            return;
        }
        await service.enable();
        logger.info('Dependency check enabled');
    } catch (error) {
        logger.error('Failed to enable dependency check', { error });
    }
}

export async function disableDependencyCheck(service: DependencyCheckService, logger: LoggerService): Promise<void> {
    try {
        await service.disable();
        logger.info('Dependency check disabled');
    } catch (error) {
        logger.error('Failed to disable dependency check', { error });
    }
}

export async function updateToExpectedVersion(
    packageName: string,
    expectedVersion: string,
    service: DependencyCheckService,
    logger: LoggerService
): Promise<void> {
    try {
        await service.updateToExpectedVersion(packageName, expectedVersion);
        logger.info(`Updated ${packageName} to ${expectedVersion}`);
    } catch (error) {
        logger.error('Failed to update package version', { packageName, expectedVersion, error });
    }
}
