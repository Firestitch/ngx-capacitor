import { Injectable } from '@angular/core';

import { CapacitorHttp, HttpOptions } from '@capacitor/core';
import { from, Observable, of, throwError } from 'rxjs';

import { HttpErrorResponse, HttpHeaders, HttpRequest, HttpResponse, HttpResponseBase } from '@angular/common/http';

import { guid } from '@firestitch/common';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { formDataToMultipartArray } from '../helpers';
import { RequestOptions } from '../interfaces';


@Injectable({
  providedIn: 'root',
})
export class FsCapacitorHttp {

  public sendRequest(request: HttpRequest<any>): any {
    const dataType = request.body instanceof FormData ? 'formData' : null;

    return of(null)
      .pipe(
        tap(() => {
          if(request.body instanceof FormData) {
            const headers = request.headers.set('Content-Type', `multipart/form-data; boundary=-----------------------------${guid()}`);
            request = request.clone({ headers });
             
          } else if(request.headers.get('Content-Type') === 'text/json') {
            const headers = request.headers.set('Content-Type', 'application/json');
            request = request.clone({ headers });
          }
        }),
        switchMap(() => {
          return request.body instanceof FormData ?
            formDataToMultipartArray(request.body)
              .pipe(
                tap((body) => {
                  request = request.clone({ body });
                })
              ) : 
              of(null);
        }),
        switchMap(() => {
          const data = request.body || '';
          const headers = request.headers.keys()
            .filter((name) => typeof request.headers.get(name) === 'string')
            .reduce((accum, name) => {
              const names = name.split('-')
                .map((item) => {
                  return item.charAt(0).toUpperCase() + item.slice(1);
                });

              return {
                ...accum,
                [names.join('-')]: request.headers.get(name),
              };
            }, {});

          const params = request.params.keys()
            .reduce((accum, name: string) => {
              return {
                ...accum,
                [name]: request.params.get(name),
              };
            }, {});

          return this._sendRequest(request.url, {
            method: request.method.toUpperCase(),
            data,
            params,
            headers: {
              ...headers,
              ['Cookie']: document.cookie,
            },
            dataType,
            responseType: request.responseType,
          })
        }) 
      );
  }

  private _base64toBlob(b64Data, contentType) {
    const sliceSize = 512;

    var byteCharacters = atob(b64Data);
    var byteArrays = [];

    for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      var slice = byteCharacters.slice(offset, offset + sliceSize);

      var byteNumbers = new Array(slice.length);
      for (var i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
  
      var byteArray = new Uint8Array(byteNumbers);
  
      byteArrays.push(byteArray);
    }
  
    var blob = new Blob(byteArrays, { type: contentType });
    return blob;
  };

  private _sendRequest(url: string, options: RequestOptions): Observable<HttpResponse<any>> {
    const httpOptions: HttpOptions = {
      method: options.method,
      url,
      data: options.data,
      params: options.params,
      headers: options.headers,
      dataType: options.dataType,
      responseType: options.responseType,
    }

    return from(CapacitorHttp.request(httpOptions))
      .pipe(
        map((response) => {
          let body = response.data;

          const contentType = (response.headers['Content-Type'] || '').split(';')[0];
          if(contentType.match(/\/json/)) {
            try {
              body = JSON.parse(response.data);
            } catch (error) {
            }
  
          } else if(options.responseType === 'blob') {
            body = this._base64toBlob(body, contentType);
          }

          const httpResponse = new HttpResponse({
            body,
            status: response.status,
            headers: new HttpHeaders(response.headers),
            url: response.url,
          });

          this._log(options, body, httpResponse);
          document.cookie = response.headers['Set-Cookie'] || response.headers['set-cookie'];

          return httpResponse;
        }),
        catchError((error) => {
          if (error.status <= 0) {
            const errorResponse = new HttpErrorResponse({
              ...error,
              url,
            });

            this._log(options, '', errorResponse);
          } else {
            let body = error.error;
            try {
              body = JSON.parse(error.error);
            } catch (e) { }

            const httpResponse = new HttpResponse({
              body,
              status: error.status,
              headers: new HttpHeaders(error.headers),
              url: error.url,
            });

            if (!httpResponse.status || httpResponse.status >= 400) {
              const errorResponse = new HttpErrorResponse({
                error: httpResponse.body,
                headers: httpResponse.headers,
                status: httpResponse.status,
                statusText: httpResponse.statusText,
                url: httpResponse.url,
              });

              this._log(options, httpResponse.body, errorResponse);
            }
            this._log(options, httpResponse.body, httpResponse);
          }

          return throwError(error);
        }),
      );
  }

  private _log(options: RequestOptions, body?, httpResponse?: HttpResponseBase) {
    const _url = new URL(httpResponse.url);

    Object.keys(options.params)
      .forEach((name) => {
        _url.searchParams.set(name, options.params[name]);
      });

    const status: number = httpResponse?.status || 0;
    const log = [options.method.toUpperCase() + ' ' + status, _url.toString(), options.data || ''];

    if (httpResponse) {
      log.push(...[
        status,
        options.headers,
        body || '',
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

    if (!status || status >= 400) {
      console.error(...log);
    } else {
      console.log(...log);
    }
  }

  private _getSerializer(request: HttpRequest<any>) {
    if (request.body instanceof FormData) {
      return 'multipart';
    }

    if (typeof (request.body) === 'object') {
      return 'json';
    }

    return 'utf8';
  }
}
