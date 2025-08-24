import { EXTENSION_CONFIG } from '../constants';
import { PackageJsonKeys } from '../types';

export function parsePackageJson(content: string): any {
    try {
        return JSON.parse(content);
    } catch {
        return null;
    }
}

export function updatePackageJsonSection(
    packageJson: any,
    sectionName: 'dependencies' | 'devDependencies',
    packageName: string,
    version: string
): void {
    if (!packageJson[sectionName]) {
        packageJson[sectionName] = {};
    }

    packageJson[sectionName][packageName] = version;

    // Sort alphabetically
    const sortedDeps = Object.keys(packageJson[sectionName])
        .sort()
        .reduce((result: Record<string, string>, key: string) => {
            result[key] = packageJson[sectionName][key];
            return result;
        }, {});

    packageJson[sectionName] = sortedDeps;
}

export function removePackageFromJson(packageJson: any, packageName: string): boolean {
    let removed = false;

    if (packageJson.dependencies && packageJson.dependencies[packageName]) {
        delete packageJson.dependencies[packageName];
        removed = true;
    }

    if (packageJson.devDependencies && packageJson.devDependencies[packageName]) {
        delete packageJson.devDependencies[packageName];
        removed = true;
    }

    return removed;
}

export function extractPackagesFromPackageJson(content: string): Array<{ name: string; version: string }> {
    const packageJson = parsePackageJson(content);
    if (!packageJson) {
        return [];
    }

    const dependencies = packageJson[PackageJsonKeys.DEPENDENCIES] || {};

    return Object.entries(dependencies).map(([name, version]) => ({
        name,
        version: (version as string).replace(EXTENSION_CONFIG.VERSION_CLEAN_REGEX, ''),
    }));
}

export function extractAllPackages(content: string): Record<string, string> {
    const packageJson = parsePackageJson(content);
    if (!packageJson) {
        return {};
    }

    const dependencies = packageJson[PackageJsonKeys.DEPENDENCIES] || {};
    const devDependencies = packageJson[PackageJsonKeys.DEV_DEPENDENCIES] || {};

    return { ...dependencies, ...devDependencies };
}

export function extractPackageNames(content: string): string[] {
    const packageJson = parsePackageJson(content);
    if (!packageJson) {
        return [];
    }

    const dependencies = packageJson[PackageJsonKeys.DEPENDENCIES] || {};
    const devDependencies = packageJson[PackageJsonKeys.DEV_DEPENDENCIES] || {};

    const allDependencies = { ...dependencies, ...devDependencies };

    return Object.entries(allDependencies).map(([name, version]) => {
        const cleanVersion = (version as string).replace(EXTENSION_CONFIG.VERSION_CLEAN_REGEX, '');
        return `${name}@${cleanVersion}`;
    });
}

export function isDevDependency(content: string, packageName: string): boolean {
    const packageJson = parsePackageJson(content);
    if (!packageJson) {
        return false;
    }

    const dependencies = packageJson[PackageJsonKeys.DEPENDENCIES] || {};
    const devDependencies = packageJson[PackageJsonKeys.DEV_DEPENDENCIES] || {};

    return devDependencies[packageName] !== undefined && dependencies[packageName] === undefined;
}

export function extractDependenciesOnly(content: string): string[] {
    const packageJson = parsePackageJson(content);
    if (!packageJson) {
        return [];
    }

    const dependencies = packageJson[PackageJsonKeys.DEPENDENCIES] || {};

    return Object.entries(dependencies).map(([name, version]) => {
        const cleanVersion = (version as string).replace(EXTENSION_CONFIG.VERSION_CLEAN_REGEX, '');
        return `${name}@${cleanVersion}`;
    });
}
