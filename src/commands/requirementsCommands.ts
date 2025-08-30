import * as vscode from 'vscode';

import { ApplyRequirementsService } from '../services/applyRequirementsService';
import { RequirementsService } from '../services/requirementsService';

export async function enableRequirements(service: RequirementsService): Promise<void> {
    if (service.isEnabled()) {
        vscode.window.showWarningMessage(
            'Requirements are already enabled. Use "Hide requirements" to change the target version.'
        );
        return;
    }
    await service.enable();
}

export async function disableRequirements(service: RequirementsService): Promise<void> {
    await service.disable();
}

export async function applyRequirements(service: ApplyRequirementsService): Promise<void> {
    await service.applyRequirements();
}

export async function updateToRequiredVersion(
    packageName: string,
    requiredVersion: string,
    service: RequirementsService
): Promise<void> {
    await service.updateToRequiredVersion(packageName, requiredVersion);
}

export async function addPackage(
    packageName: string,
    version: string,
    dependencyType: 'dependencies' | 'devDependencies' | undefined,
    service: RequirementsService
): Promise<void> {
    await service.addPackage(packageName, version, dependencyType);
}

export async function removePackage(packageName: string, service: RequirementsService): Promise<void> {
    await service.removePackage(packageName);
}
