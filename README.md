# Installation

1. Call initCapacitor() in main.ts. This has to be revisited
```
import { initCapacitor } from '@firestitch/capacitor';

initCapacitor();
```

2. Provide the HTTP_INTERCEPTORS in the main module 
```
{
  provide: HTTP_INTERCEPTORS,
  useClass: CordovaHttpInterceptor,
  multi: true,
  deps: [Platform, FsCapacitorHttp],
},
```

3. Call FsCapacitor.init() 
```
{
  provide: APP_INITIALIZER,
  useFactory: (cordova: FsCapacitor) => () => {
    return of(null)
      .pipe(
        switchMap(() => cordova.init()),
      )
      .toPromise();
  },
  multi: true,
  deps: [FsCapacitor],
}, 
```