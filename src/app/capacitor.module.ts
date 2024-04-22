import { APP_INITIALIZER, ModuleWithProviders, NgModule } from '@angular/core';

import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { FsApi } from '@firestitch/api';
import { of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { FS_CAPACITOR_CONFIG } from './consts';
import { CapacitorHttpInterceptor } from './interceptors';
import { FsCapacitorConfig } from './interfaces';
import { FsCapacitor, FsCapacitorApi, FsCapacitorHttp } from './services';


@NgModule()
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
          ) => {
            return () => of(null)
              .pipe(
                tap(() => {
                  if(capacitor.supported) {
                    capacitor.init();
                  }
                }),
              );
          },
          multi: true,
          deps: [FsCapacitor],
        }, 
      ],
    };
  }
}


