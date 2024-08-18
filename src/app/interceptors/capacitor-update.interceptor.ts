import { Injectable, Injector } from '@angular/core';

import { Observable } from 'rxjs';


import {
  HttpEvent, HttpHandler, HttpInterceptor, HttpRequest,
} from '@angular/common/http';

import { CapacitorUpdateToken } from '../consts';
import { FsCapacitorUpdate } from '../services';


@Injectable()
export class CapacitorUpdateInterceptor implements HttpInterceptor {
  constructor(
    private _injector: Injector,
  ) {}

  public intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const capacitorUpdate = this._injector.get(FsCapacitorUpdate);

    if(capacitorUpdate.previewApiUrl && !request.context.get(CapacitorUpdateToken)) {
      try {
        const previewUrl = new URL(capacitorUpdate.previewApiUrl);
        const url = new URL(request.url);
        url.host = previewUrl.host;

        request = request.clone({ url: url.toString() });
      } catch(e) {}
    }

    return next.handle(request);
  }
}
