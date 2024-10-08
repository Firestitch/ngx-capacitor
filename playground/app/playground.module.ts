import { APP_INITIALIZER, Injector, NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule, Routes } from '@angular/router';

import { FS_API_REQUEST_INTERCEPTOR } from '@firestitch/api';
import { FsCapacitorModule, FsCapacitorUpdate } from '@firestitch/capacitor';
import { FsExampleModule } from '@firestitch/example';
import { FsLabelModule } from '@firestitch/label';
import { FsMessageModule } from '@firestitch/message';
import { FsStoreModule } from '@firestitch/store';

import { of } from 'rxjs';
import { tap } from 'rxjs/operators';

import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AppComponent } from './app.component';
import {
  CordovaComponent,
  ExamplesComponent,
} from './components';
import { TokenInterceptorFactory } from './interceptors';
import { AppMaterialModule } from './material.module';


const routes: Routes = [
  { path: '',
    data: { fsCapacitorStatusBar: { visible: false, backgroundColor: '#fff' } },
    children: [
      {
        path: '', component: ExamplesComponent,
        data: { fsCapacitorStatusBar: { visible: true } },
      },
    ],
  },
];

@NgModule({
  bootstrap: [AppComponent],
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
    FsCapacitorModule.forRoot(),
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
        injector: Injector,
      ) => {
        return () => of(null)
          .pipe(
            tap(() => {
              injector.get(FsCapacitorUpdate).listen({
                updateUrl: 'http://[::1]:5300/api/app/update',
                interval: 5,
              });
            }),
          );
      },
      multi: true,
      deps: [Injector],
    },
    {
      provide: FS_API_REQUEST_INTERCEPTOR,
      useFactory: TokenInterceptorFactory,
      multi: true,
    },
  ],

})
export class PlaygroundModule {
}
