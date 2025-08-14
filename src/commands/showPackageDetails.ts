import * as vscode from 'vscode';
import { PackageInfo } from '../types';
import { createPackageDetailsPanel } from '../ui/packageDetailsPanel';

export async function showPackageDetails(packageName: string, packageInfo: PackageInfo, context?: vscode.ExtensionContext): Promise<void> {
    createPackageDetailsPanel(packageName, packageInfo, context);
}