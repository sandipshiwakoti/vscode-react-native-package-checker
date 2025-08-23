import { CodeLensProviderService } from '../services/codeLensProviderService';

export function refreshPackages(codeLensProviderService: CodeLensProviderService): void {
    codeLensProviderService.refreshPackages();
}
