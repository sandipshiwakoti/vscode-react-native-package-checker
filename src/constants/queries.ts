export const GITHUB_QUERIES = {
    NEW_ARCH_ISSUE:
        'is:issue is:open "new arch" OR "new architecture" OR "fabric" OR "turbomodule" OR "JSI" OR "codegen"',
    NEW_ARCH_PR: 'is:pr is:open "new arch" OR "new architecture" OR "fabric" OR "turbomodule" OR "JSI" OR "codegen"',
    NEW_ARCH_MERGED_PR:
        'is:pr is:merged "new arch" OR "new architecture" OR "fabric" OR "turbomodule" OR "JSI" OR "codegen"',
    NEW_ARCH_RELEASE_NOTES: 'new+arch',
    MAINTENANCE_ISSUE:
        'is:issue is:open "unmaintained" OR "deprecated" OR "abandoned" OR "maintainer" OR "maintenance" OR "not maintained"',
    MAINTENANCE_PR: 'is:pr is:open sort:updated-asc',
} as const;
