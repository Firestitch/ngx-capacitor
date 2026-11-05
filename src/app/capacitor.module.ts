import { APP_INITIALIZER, ModuleWithProviders, NgModule } from '@angular/core';

import { FsApi } from '@firestitch/api';

import { of } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';

import { HTTP_INTERCEPTORS } from '@angular/common/http';

import { FS_CAPACITOR_CONFIG } from './consts';
import { CapacitorHttpInterceptor } from './interceptors';
import { FsCapacitorConfig } from '@firestitch/capacitor/config';
import { FsCapacitor, FsCapacitorApi, FsCapacitorHttp, FsCapacitorUpdate } from './services';


@NgModule({})
export class FsCapacitorModule {
  public static forRoot(config: FsCapacitorConfig = {}): ModuleWithProviders<FsCapacitorModule> {
    return {
      ngModule: FsCapacitorModule,
      providers:[
        { provide: FS_CAPACITOR_CONFIG, useValue: config },
        {
          provide: HTTP_INTERCEPTORS,
          useClass: CapacitorHttpInterceptor,
          multi: true,
          deps: [FsCapacitor, FsCapacitorHttp],
        },
        { provide: FsApi, useClass: FsCapacitorApi },
        {
          provide: APP_INITIALIZER,
          useFactory: (
            capacitor: FsCapacitor,
            update: FsCapacitorUpdate,
          ) => {
            return () => of(null)
              .pipe(
                // Started first and not waited on: a downloaded bundle must report
                // itself started before anything slow, or the plugin rolls it back
                tap(() => update.init(config.update)),
                switchMap(() => capacitor.init()),
              );
          },
          multi: true,
          deps: [FsCapacitor, FsCapacitorUpdate],
        },
      ],
    };
  }
}
