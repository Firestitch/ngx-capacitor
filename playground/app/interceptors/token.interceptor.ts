import { makeInterceptorFactory } from '@firestitch/api';

import { Observable } from 'rxjs';

import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';


class TokenInterceptor implements HttpInterceptor {
  
  constructor(
    protected _config, 
    protected _data,
  ) {
  }

  public intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    console.log('begin');

    const headers = req.headers.append('X-api-key', '34095td98yvhs9w8dg6yd78yg0sd76gas98d67');

    return next.handle(req.clone({ headers }));
  }
}

export const TokenInterceptorFactory = makeInterceptorFactory(TokenInterceptor);
