import { Injectable } from '@angular/core';

import { parse } from '@firestitch/date';
import { FsStore } from '@firestitch/store';

import { isAfter, isBefore } from 'date-fns';
import { cookieParse } from '../helpers';

@Injectable({
  providedIn: 'root',
})
export class FsCapacitorCookie {

  private _cookies = [];

  constructor(
    private _store: FsStore,
  ) {}

  public init(): void {
    this._cookies = (this._store.get('cookie') || [])
      .map((cookie) => ({
        ...cookie,
        expires: parse(cookie.expires),
      }));

    this.polyfillCookie();
  }

  public parseCookies(cookieStr: string): {
    name?: string;
    expires?: Date;
    path?: string;
    value?: string;
  }[] {
    return (cookieParse.splitCookiesString(cookieStr));
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
