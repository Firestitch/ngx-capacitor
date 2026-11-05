import { enableProdMode, importProvidersFrom } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, Routes } from '@angular/router';

import { FS_API_REQUEST_INTERCEPTOR } from '@firestitch/api';
import { FsCapacitorModule, initCordova } from '@firestitch/capacitor';
import { FsExampleModule } from '@firestitch/example';
import { FsLabelModule } from '@firestitch/label';
import { FsMessageModule } from '@firestitch/message';
import { FsStoreModule } from '@firestitch/store';

import { provideAnimations } from '@angular/platform-browser/animations';

import { AppComponent } from './app/app.component';
import { ExamplesComponent } from './app/components';
import { TokenInterceptorFactory } from './app/interceptors';
import { environment } from './environments/environment';


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

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(
      BrowserModule,
      FormsModule,
      FsLabelModule,
      FsStoreModule.forRoot(),
      FsExampleModule.forRoot(),
      FsMessageModule.forRoot(),
      FsCapacitorModule.forRoot({
        update: { manifestUrl: environment.appUpdateManifestUrl },
      }),
    ),
    {
      provide: FS_API_REQUEST_INTERCEPTOR,
      useFactory: TokenInterceptorFactory,
      multi: true,
    },
    provideAnimations(),
    provideRouter(routes),
  ],
})
  .catch((err: unknown) => console.error(err));

initCordova();
