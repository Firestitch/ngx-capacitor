import { Injectable } from '@angular/core';

import { CapacitorHttp, HttpOptions } from '@capacitor/core';
import { from, Observable, of, throwError } from 'rxjs';

import { HttpErrorResponse, HttpHeaders, HttpRequest, HttpResponse, HttpResponseBase } from '@angular/common/http';

import { CapFormDataEntry } from '@capacitor/core/types/definitions-internal';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { RequestOptions } from '../interfaces';


@Injectable({
  providedIn: 'root',
})
export class FsCapacitorHttp {

  public sendRequest(request: HttpRequest<any>): any {
    return of(null)
      .pipe(
        switchMap(() => {
          return request.body instanceof FormData ?
            from(this._convertFormData(request.body))
            .pipe(
              tap((body) => {
                request = request.clone({ body })
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

          if(typeof data === 'object') {
            headers['Content-Type'] = 'application/json';
          }

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
          })
        }) 
      );
  }

  private async _convertFormData(formData: any): Promise<any> {
    const newFormData: CapFormDataEntry[] = [];
    for (const pair of formData.entries()) {
      const [key, value] = pair;
      if (value instanceof File) {
        const base64File = await this._readFileAsBase64(value);
        newFormData.push({
          key,
          value: base64File,
          type: 'base64File',
          contentType: value.type,
          fileName: value.name,
        });
      } else {
        newFormData.push({ key, value, type: 'string' });
      }
    }
  
    return newFormData;
  }

  private _readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const data = reader.result as string;
        resolve(btoa(data));
      };
      reader.onerror = reject;
  
      reader.readAsBinaryString(file);
    });
  }  

  private _sendRequest(url: string, options: RequestOptions): Observable<HttpResponse<any>> {
    const httpOptions: HttpOptions = {
      method: options.method,
      url,
      data: options.data,
      params: options.params,
      headers: options.headers,
    }

    return from(CapacitorHttp.request(httpOptions))
      .pipe(
        map((response) => {
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
    const log = [`${options.method.toUpperCase()} ${status}`, _url.toString(), options.data || ''];

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
