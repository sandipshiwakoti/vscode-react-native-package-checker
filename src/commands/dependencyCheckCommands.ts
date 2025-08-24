import * as vscode from 'vscode';

import { DependencyCheckService } from '../services/dependencyCheckService';
import { LoggerService } from '../services/loggerService';

async function executeCommand<T extends any[]>(
    commandName: string,
    logger: LoggerService,
    operation: (...args: T) => Promise<void>,
    ...args: T
): Promise<void> {
    try {
        await operation(...args);
        logger.info(`${commandName} command executed`);
    } catch (error) {
        logger.error(`Failed to execute ${commandName} command`, { error });
    }
}

export async function enableDependencyCheck(service: DependencyCheckService, logger: LoggerService): Promise<void> {
    if (service.isEnabled()) {
        vscode.window.showWarningMessage(
            'Dependency check is already enabled. Use "Reset dependency check" to change the target version.'
        );
        return;
    }
    return executeCommand('Enable dependency check', logger, () => service.enable());
}

export async function disableDependencyCheck(service: DependencyCheckService, logger: LoggerService): Promise<void> {
    return executeCommand('Disable dependency check', logger, () => service.disable());
}

export async function updateToExpectedVersion(
    packageName: string,
    expectedVersion: string,
    service: DependencyCheckService,
    logger: LoggerService
): Promise<void> {
    return executeCommand(
        'Update package version',
        logger,
        (name: string, version: string) => service.updateToExpectedVersion(name, version),
        packageName,
        expectedVersion
    );
}

export async function bulkUpdateToExpectedVersions(
    service: DependencyCheckService,
    logger: LoggerService
): Promise<void> {
    return executeCommand('Bulk update to expected versions', logger, () => service.bulkUpdateToExpectedVersions());
}

export async function addPackage(
    packageName: string,
    version: string,
    dependencyType: 'dependencies' | 'devDependencies' | undefined,
    service: DependencyCheckService,
    logger: LoggerService
): Promise<void> {
    return executeCommand(
        'Add package',
        logger,
        (name: string, ver: string, type: 'dependencies' | 'devDependencies' | undefined) =>
            service.addPackage(name, ver, type),
        packageName,
        version,
        dependencyType
    );
}

export async function removePackage(
    packageName: string,
    service: DependencyCheckService,
    logger: LoggerService
): Promise<void> {
    return executeCommand('Remove package', logger, (name: string) => service.removePackage(name), packageName);
}
