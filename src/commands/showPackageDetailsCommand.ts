import * as vscode from 'vscode';

import { PackageDetailsService } from '../services/packageDetailsService';
import { PackageInfo } from '../types';

export function showPackageDetails(
    packageDetailsService: PackageDetailsService,
    packageName: string,
    packageInfo: PackageInfo,
    context?: vscode.ExtensionContext
): void {
    packageDetailsService.showPackageDetails(packageName, packageInfo, context);
}
