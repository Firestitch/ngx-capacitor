import { APP_INITIALIZER, NgModule, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule, Routes } from '@angular/router';

import { FsExampleModule } from '@firestitch/example';
import { FsLabelModule } from '@firestitch/label';
import { FsMessageModule } from '@firestitch/message';
import { FsStoreModule } from '@firestitch/store';


import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { CapacitorHttpInterceptor, CordovaFileClickInterceptor, FsCapacitor, FsCapacitorHttp } from '@firestitch/capacitor';
import { FS_FILE_CLICK_INTERCEPTOR } from '@firestitch/file';
import { of } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { AppComponent } from './app.component';
import {
  CordovaComponent,
  ExamplesComponent
} from './components';
import { AppMaterialModule } from './material.module';


const routes: Routes = [
  { path: '', component: ExamplesComponent },
];

@NgModule({
  bootstrap: [ AppComponent ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppMaterialModule,
    FormsModule,
    FsLabelModule,
    FsStoreModule.forRoot(),
    FsExampleModule.forRoot(),
    FsMessageModule.forRoot(),
    RouterModule.forRoot(routes),
  ],
  declarations: [
    AppComponent,
    ExamplesComponent,
    CordovaComponent,
  ],
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: (
        capacitor: FsCapacitor,
      ) => () => {
        return of(null)
          .pipe(
            switchMap(() => capacitor.getAppVersion()),
            tap((version: string) => {
              console.log('Cordova Version', version);
            }),
            //switchMap(() => capacitor.init()),
          );
      },
      multi: true,
      deps: [FsCapacitor],
    },    
    {
      provide: HTTP_INTERCEPTORS,
      useClass: CapacitorHttpInterceptor,
      multi: true,
      deps: [FsCapacitor, FsCapacitorHttp],
    },
    {
      provide: FS_FILE_CLICK_INTERCEPTOR,
      multi: true,
      useFactory: (ngZone: NgZone) => {
        return new CordovaFileClickInterceptor(ngZone);
      },
      deps: [NgZone],
    },
  ]
})
export class PlaygroundModule {
}
