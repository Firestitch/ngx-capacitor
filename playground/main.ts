import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { initCordova } from '@firestitch/cordova';

import { PlaygroundModule } from './app/playground.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(PlaygroundModule)
  .catch(err => console.error(err));

initCordova();