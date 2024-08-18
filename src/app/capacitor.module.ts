import { APP_INITIALIZER, ModuleWithProviders, NgModule } from '@angular/core';

import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { Capacitor } from '@capacitor/core';
import { FsApi } from '@firestitch/api';
import { FsDialogModule } from '@firestitch/dialog';
import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { UpdateComponent } from './components';
import { FS_CAPACITOR_CONFIG } from './consts';
import { CapacitorHttpInterceptor } from './interceptors';
import { FsCapacitorConfig } from './interfaces';
import { FsCapacitor, FsCapacitorApi, FsCapacitorHttp } from './services';


@NgModule({
  imports: [
    MatButtonModule,
    MatDialogModule,

    FsDialogModule,
  ],
  declarations: [
    UpdateComponent,
  ],
})
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
                switchMap(() => {
                  return Capacitor.getPlatform() === 'ios' ?
                    capacitor.init() : of(null);
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


