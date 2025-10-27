import { enableProdMode, APP_INITIALIZER, Injector, importProvidersFrom } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { initCordova, FsCapacitorUpdate, FsCapacitorModule } from '@firestitch/capacitor';


import { environment } from './environments/environment';
import { of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { FS_API_REQUEST_INTERCEPTOR } from '@firestitch/api';
import { TokenInterceptorFactory } from './app/interceptors';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { FsLabelModule } from '@firestitch/label';
import { FsStoreModule } from '@firestitch/store';
import { FsExampleModule } from '@firestitch/example';
import { FsMessageModule } from '@firestitch/message';
import { provideRouter, Routes } from '@angular/router';
import { ExamplesComponent } from './app/components';
import { AppComponent } from './app/app.component';

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
        importProvidersFrom(BrowserModule, FormsModule, FsLabelModule, FsStoreModule.forRoot(), FsExampleModule.forRoot(), FsMessageModule.forRoot(), FsCapacitorModule.forRoot()),
        {
            provide: APP_INITIALIZER,
            useFactory: (injector: Injector) => {
                return () => of(null)
                    .pipe(tap(() => {
                    injector.get(FsCapacitorUpdate).listen({
                        updateUrl: 'http://[::1]:5300/api/app/update',
                        interval: 5,
                    });
                }));
            },
            multi: true,
            deps: [Injector],
        },
        {
            provide: FS_API_REQUEST_INTERCEPTOR,
            useFactory: TokenInterceptorFactory,
            multi: true,
        },
        provideAnimations(),
        provideRouter(routes),
    ]
})
  .catch(err => console.error(err));

initCordova();