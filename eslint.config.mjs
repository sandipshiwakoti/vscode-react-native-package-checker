import prettier from 'eslint-plugin-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
    {
        files: ['**/*.ts'],
    },
    {
        plugins: {
            '@typescript-eslint': typescriptEslint,
            prettier,
            'simple-import-sort': simpleImportSort,
            'unused-imports': unusedImports,
        },
        languageOptions: {
            parser: tsParser,
            ecmaVersion: 2022,
            sourceType: 'module',
        },
        rules: {
            '@typescript-eslint/naming-convention': [
                'warn',
                {
                    selector: 'import',
                    format: ['camelCase', 'PascalCase'],
                },
            ],
            curly: 'warn',
            eqeqeq: 'warn',
            'no-throw-literal': 'warn',
            semi: 'warn',
            'prettier/prettier': [
                'warn',
                {},
                {
                    usePrettierrc: true,
                },
            ],
            'simple-import-sort/imports': [
                'error',
                {
                    groups: [
                        ['^vscode', '^fs', '^path'], // VS Code and Node.js built-ins (e.g., vscode, fs, path)
                        ['^\\w', '^@?\\w'], // Third-party npm dependencies (e.g., eslint, @commitlint/cli)
                        ['^src/'], // Third level: Absolute src/ imports (e.g., src/utils, src/providers)
                        ['^\\.\\.'], // Fourth level: All parent directory imports (e.g., ../types, ../../utils)
                        ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'], // Sixth level: Sibling and relative imports (e.g., ./services, .)
                    ],
                },
            ],
            'simple-import-sort/exports': 'error',
            'unused-imports/no-unused-imports': 'warn',
            'unused-imports/no-unused-vars': [
                'warn',
                {
                    vars: 'all',
                    args: 'after-used',
                    ignoreRestSiblings: true,
                    caughtErrors: 'all',
                    varsIgnorePattern: '^_',
                    argsIgnorePattern: '^token$',
                },
            ],
        },
    },
];
