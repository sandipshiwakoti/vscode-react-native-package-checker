module.exports = {
    '*.ts': ['prettier --write', 'eslint --fix'],
    '*.js': ['prettier --write', 'eslint --fix'],
    '*.{json,jsonc}': ['prettier --write'],
    '*.{md,markdown}': ['prettier --write'],
    '*.{yml,yaml}': ['prettier --write'],
};
