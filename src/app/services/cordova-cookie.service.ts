import { Injectable } from '@angular/core';

import { FsStore } from '@firestitch/store';
import { parse } from '@firestitch/date';

import { Observable, of } from 'rxjs';

import { Platform } from '@ionic/angular';
import { isAfter, isBefore } from 'date-fns';
import setCookie from 'set-cookie-parser';


@Injectable({
  providedIn: 'root',
})
export class FsCordovaCookie {

  private _cookies = [];

  constructor(
    private _platform: Platform,
    private _store: FsStore,
  ) {}

  public init(): Observable<void> {
    if(!this._platform.is('ios') && !this._platform.is('android')) {
      return of(null);
    }

    this._cookies = (this._store.get('cookie') || [])
      .map((cookie) => ({
        ...cookie,
        expires: parse(cookie.expires),
      }));

    this.polyfillCookie();

    return of(null);
  }

  public parseCookies(cookieStr: string): {
    name?: string;
    expires?: Date;
    path?: string;
    value?: string;
  }[] {
    return setCookie.parse(setCookie.splitCookiesString(cookieStr));
  }

  public polyfillCookie() {
    Object.defineProperty(document, 'cookie', {
      get: () => {
        return this._cookies
          .filter((cookie) => {
            return isAfter(cookie.expires, new Date());
          })
          .map((cookie) => {
            return `${cookie.name}=${cookie.value}`;
          })
          .join('; ');
      },
      set: (cookieStr) => {
        const cookies = this.parseCookies(cookieStr);

        cookies.forEach((cookie) => {
          const expired = isBefore(cookie.expires || 0, new Date());

          this._cookies = this._cookies
            .filter((item) => {
              return item.name !== cookie.name;
            });

          if(!expired) {
            this._cookies.push(cookie);
          }
        });

        this._store.set('cookie', this._cookies);
      },
    });
  }

}
