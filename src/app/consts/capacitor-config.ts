import { InjectionToken } from '@angular/core';

import { FsCapacitorConfig } from '@firestitch/capacitor/config';

export const FS_CAPACITOR_CONFIG = new InjectionToken<FsCapacitorConfig>('fs-capacitor-config');
