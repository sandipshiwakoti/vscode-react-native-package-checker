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

export async function applyRequirements(
    service: ApplyRequirementsService,
    requirementsService?: RequirementsService
): Promise<void> {
    await service.applyRequirements();

    // Auto-hide requirements after successful application
    if (requirementsService && requirementsService.isEnabled()) {
        setTimeout(async () => {
            await requirementsService.disable();
        }, 1000);
    }
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

export async function addAllMissingPackages(
    dependencyType: 'dependencies' | 'devDependencies',
    service: RequirementsService
): Promise<void> {
    await service.addAllMissingPackages(dependencyType);
}
