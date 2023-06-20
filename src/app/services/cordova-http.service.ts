import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';

import { HttpErrorResponse, HttpHeaders, HttpRequest, HttpResponse } from '@angular/common/http';
import { CookieService } from 'ngx-cookie-service';

import { RequestOptions } from '../interfaces';


@Injectable({
  providedIn: 'root',
})
export class FsCordovaHttp {

  constructor(
    private _cookieService: CookieService,
  ) {}

  public get http(): any {
    const cordova = (window as any).cordova;

    if(!cordova?.plugin?.http) {
      throw new Error('Plugin cordova-plugin-advanced-http not installed');
    }

    return cordova.plugin.http;
  }

  public sendRequest(request: HttpRequest<any>): any {
    const headers = request.headers.keys()
      .filter((name) => typeof request.headers.get(name) === 'string')
      .reduce((accum, name) => {
        return {
          ...accum,
          [name]: request.headers.get(name),
        };
      }, {});

    const cookie = Object.keys(this._cookieService.getAll())
      .map((name: string) => `${name}=${this._cookieService.get(name)}`)
      .join('; ');

    const params = request.params.keys()
      .reduce((accum, name: string) => {
        return {
          ...accum,
          [name]: request.params.get(name),
        };
      }, {});

    const serializer = this._getSerializer(request);

    if(request.body instanceof FormData) {
      const formData = new this.http.ponyfills.FormData();

      request.body
        .forEach((value, name) => {
          formData.append(name, value);
        });

      request = request.clone({ body: formData });
    }

    let data = request.body || '';
    if(serializer === 'json') {
      data = data || {};
    }

    return this._sendRequest(request.url, {
      method: request.method.toLowerCase(),
      data,
      params,
      headers: {
        ...headers,
        ['Cookie']: cookie,
      },
      serializer,
    });
  }

  private _sendRequest(url: string, options: RequestOptions): Observable<HttpResponse<any>> {
    return new Observable((observer) => {
      this.http.sendRequest(url, options,
        (response) => {
          let body;

          try {
            body = JSON.parse(response.data);
          } catch (error) {
            body = response.data;
          }

          const httpResponse = new HttpResponse({
            body,
            status: response.status,
            headers: new HttpHeaders(response.headers),
            url: response.url,
          });

          this._log(url, options, httpResponse);
          document.cookie = response.headers['set-cookie'];

          observer.next(httpResponse);
          observer.complete();
        },
        (error) => {
          if (!error.status) {
            this._log(url, options);

            return observer.error(error);
          }

          let body = error.error;
          try {
            body = JSON.parse(error.error);
          } catch(e) {}

          const httpResponse = new HttpResponse({
            body,
            status: error.status,
            headers: new HttpHeaders(error.headers),
            url: error.url,
          });

          if(!httpResponse.status || httpResponse.status >= 400) {
            const errorResponse = new HttpErrorResponse({
              error: httpResponse.body,
              headers: httpResponse.headers,
              status: httpResponse.status,
              statusText: httpResponse.statusText,
              url: httpResponse.url,
            });

            return observer.error(errorResponse);
          }

          this._log(url, options, httpResponse);

          observer.next(httpResponse);
          observer.complete();
        });
    });
  }

  private _log(url, options: RequestOptions, httpResponse?: HttpResponse<any>) {
    const _url = new URL(url);

    Object.keys(options.params)
      .forEach((name) => {
        _url.searchParams.set(name, options.params[name]);
      });

    const status: number = httpResponse?.status || 0;
    const log = [`${options.method.toUpperCase()} ${status}`, _url.toString(), options.data || ''];

    if(httpResponse) {
      log.push(...[
        status,
        httpResponse.body || '',
        httpResponse.headers.keys()
          .filter((name) => typeof httpResponse.headers.get(name) === 'string')
          .reduce((accum, name: string) => {
            return {
              ...accum,
              [name]: httpResponse.headers.get(name),
            };
          }, {}),
      ]);
    }

    if(!status || status >= 400) {
      console.error(...log);
    } else {
      console.log(...log);
    }
  }

  private _getSerializer(request: HttpRequest<any>) {
    if(request.body instanceof FormData) {
      return 'multipart';
    }

    if(typeof(request.body) === 'object') {
      return 'json';
    }

    return 'utf8';
  }
}
