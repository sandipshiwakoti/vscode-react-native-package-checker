import { NewArchSupportStatus } from '../types';
import { STATUS_CLASSES } from '../constants';

export function getStatusClass(status?: NewArchSupportStatus | string): string {
    switch (status) {
        case NewArchSupportStatus.Supported:
            return STATUS_CLASSES.SUPPORTED;
        case NewArchSupportStatus.Unsupported:
            return STATUS_CLASSES.UNSUPPORTED;
        case NewArchSupportStatus.Untested:
            return STATUS_CLASSES.UNTESTED;
        case NewArchSupportStatus.Unlisted:
        default:
            return STATUS_CLASSES.UNKNOWN;
    }
}