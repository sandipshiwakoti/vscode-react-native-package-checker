import { BrowserService } from '../services/browserService';

export async function openUpgradeHelper(
    browserService: BrowserService,
    fromRNVersion: string,
    toRnVersion?: string
): Promise<void> {
    browserService.openUpgradeHelper(fromRNVersion, toRnVersion);
}
