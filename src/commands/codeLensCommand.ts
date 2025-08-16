import { CodeLensService } from '../services/codeLensService';

export async function enableCodeLens(codeLensService: CodeLensService): Promise<void> {
    await codeLensService.enable();
}

export async function disableCodeLens(codeLensService: CodeLensService): Promise<void> {
    await codeLensService.disable();
}

export function initializeCodeLens(codeLensService: CodeLensService): void {
    codeLensService.initialize();
}
