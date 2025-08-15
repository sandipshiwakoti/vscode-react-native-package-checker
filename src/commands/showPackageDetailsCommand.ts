import * as vscode from 'vscode';
import { PackageInfo } from '../types';
import { PackageDetailsService } from '../services/packageDetailsService';

export function showPackageDetails(packageDetailsService: PackageDetailsService, packageName: string, packageInfo: PackageInfo, context?: vscode.ExtensionContext): void {
    packageDetailsService.showPackageDetails(packageName, packageInfo, context);
}