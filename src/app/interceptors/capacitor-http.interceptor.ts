import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';


import {
  HttpEvent, HttpHandler, HttpInterceptor, HttpRequest,
} from '@angular/common/http';

import { FsCapacitor, FsCapacitorHttp } from '../services';


@Injectable()
export class CapacitorHttpInterceptor implements HttpInterceptor {
  constructor(
    private _capacitor: FsCapacitor,
    private _capacitorHttp: FsCapacitorHttp,
  ) {}

  public intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return this._capacitor.supported ?
      this._capacitorHttp.sendRequest(request) :
      next.handle(request);
  }
}
