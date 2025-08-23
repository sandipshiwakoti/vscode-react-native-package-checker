import { EXTENSION_CONFIG } from '../constants';
import { PackageJsonKeys } from '../types';

export function extractPackagesFromPackageJson(content: string): Array<{ name: string; version: string }> {
    try {
        const packageJson = JSON.parse(content);
        const dependencies = packageJson[PackageJsonKeys.DEPENDENCIES] || {};

        return Object.entries(dependencies).map(([name, version]) => ({
            name,
            version: (version as string).replace(EXTENSION_CONFIG.VERSION_CLEAN_REGEX, ''),
        }));
    } catch {
        return [];
    }
}

export function extractAllPackages(content: string): Record<string, string> {
    try {
        const packageJson = JSON.parse(content);
        const dependencies = packageJson[PackageJsonKeys.DEPENDENCIES] || {};
        const devDependencies = packageJson[PackageJsonKeys.DEV_DEPENDENCIES] || {};

        return { ...dependencies, ...devDependencies };
    } catch {
        return {};
    }
}

export function extractPackageNames(content: string): string[] {
    try {
        const packageJson = JSON.parse(content);
        const dependencies = packageJson[PackageJsonKeys.DEPENDENCIES] || {};
        const devDependencies = packageJson[PackageJsonKeys.DEV_DEPENDENCIES] || {};

        const allDependencies = { ...dependencies, ...devDependencies };

        return Object.entries(allDependencies).map(([name, version]) => {
            const cleanVersion = (version as string).replace(EXTENSION_CONFIG.VERSION_CLEAN_REGEX, '');
            return `${name}@${cleanVersion}`;
        });
    } catch {
        return [];
    }
}

export function isDevDependency(content: string, packageName: string): boolean {
    try {
        const packageJson = JSON.parse(content);
        const dependencies = packageJson[PackageJsonKeys.DEPENDENCIES] || {};
        const devDependencies = packageJson[PackageJsonKeys.DEV_DEPENDENCIES] || {};

        return devDependencies[packageName] !== undefined && dependencies[packageName] === undefined;
    } catch {
        return false;
    }
}
