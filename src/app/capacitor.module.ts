import { ModuleWithProviders, NgModule } from '@angular/core';

import { FS_CORDOVA_CONFIG } from './consts';
import { FsCapacitorConfig } from './interfaces';


@NgModule()
export class FsCapacitorModule {
  public static forRoot(config: FsCapacitorConfig = {}): ModuleWithProviders<FsCapacitorModule> {
    return {
      ngModule: FsCapacitorModule,
      providers:[
        { provide: FS_CORDOVA_CONFIG, useValue: config },
      ],
    };
  }
}


