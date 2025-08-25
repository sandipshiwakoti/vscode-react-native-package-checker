import * as vscode from 'vscode';

import { DependencyCheckService } from '../services/dependencyCheckService';

export async function enableDependencyCheck(service: DependencyCheckService): Promise<void> {
    if (service.isEnabled()) {
        vscode.window.showWarningMessage(
            'Dependency check is already enabled. Use "Reset dependency check" to change the target version.'
        );
        return;
    }
    await service.enable();
}

export async function disableDependencyCheck(service: DependencyCheckService): Promise<void> {
    await service.disable();
}

export async function updateToExpectedVersion(
    packageName: string,
    expectedVersion: string,
    service: DependencyCheckService
): Promise<void> {
    await service.updateToExpectedVersion(packageName, expectedVersion);
}

export async function bulkUpdateToExpectedVersions(service: DependencyCheckService): Promise<void> {
    await service.bulkUpdateToExpectedVersions();
}

export async function addPackage(
    packageName: string,
    version: string,
    dependencyType: 'dependencies' | 'devDependencies' | undefined,
    service: DependencyCheckService
): Promise<void> {
    await service.addPackage(packageName, version, dependencyType);
}

export async function removePackage(packageName: string, service: DependencyCheckService): Promise<void> {
    await service.removePackage(packageName);
}
