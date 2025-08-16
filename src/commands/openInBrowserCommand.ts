import { BrowserService } from '../services/browserService';

export function openInBrowser(browserService: BrowserService): void {
    browserService.openPackageChecker();
}
