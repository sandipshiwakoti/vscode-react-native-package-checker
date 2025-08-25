import { BulkUpdateService } from '../services/bulkUpdateService';

export async function performBulkUpdate(service: BulkUpdateService): Promise<void> {
    await service.performBulkUpdate();
}
