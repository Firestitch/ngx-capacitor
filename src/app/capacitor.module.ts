import { APP_INITIALIZER, ModuleWithProviders, NgModule } from '@angular/core';

import { FsApi } from '@firestitch/api';

import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { HTTP_INTERCEPTORS } from '@angular/common/http';

import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';

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
            // The update first: a downloaded bundle must report itself started
            // before anything slow, or the plugin rolls it back
            return () => forkJoin([update.init(config.update), capacitor.init()])
              .pipe(
                // The splash comes down here, not in the app: once the launch's update check
                // is through or has run out of time, so a new version can go in unseen behind it
                finalize(() => {
                  if (Capacitor.isPluginAvailable('SplashScreen')) {
                    SplashScreen.hide();
                  }
                }),
              );
          },
          multi: true,
          deps: [FsCapacitor, FsCapacitorUpdate],
        },
      ],
    };
  }
}
