import * as vscode from 'vscode';
import { PackageInfo } from '../types';
import { createPackageDetailsPanel } from '../ui/packageDetailsPanel';

export class PackageDetailsService {
    showPackageDetails(packageName: string, packageInfo: PackageInfo, context?: vscode.ExtensionContext): void {
        createPackageDetailsPanel(packageName, packageInfo, context);
    }
}