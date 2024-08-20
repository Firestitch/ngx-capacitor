import { Injectable } from '@angular/core';

import { parse } from '@firestitch/date';
import { FsStore } from '@firestitch/store';

import { isAfter, isBefore } from 'date-fns';
import * as cookieParser from 'set-cookie-parser';


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
    /**
     * cookie name
     */
    name: string;
    /**
     * cookie value
     */
    value: string;
    /**
     * cookie path
     */
    path?: string | undefined;
    /**
     * absolute expiration date for the cookie
     */
    expires?: Date | undefined;
    /**
     * relative max age of the cookie in seconds from when the client receives it (integer or undefined)
     * Note: when using with express's res.cookie() method, multiply maxAge by 1000 to convert to milliseconds
     */
    maxAge?: number | undefined;
    /**
     * domain for the cookie,
     * may begin with "." to indicate the named domain or any subdomain of it
     */
    domain?: string | undefined;
    /**
     * indicates that this cookie should only be sent over HTTPs
     */
    secure?: boolean | undefined;
    /**
     * indicates that this cookie should not be accessible to client-side JavaScript
     */
    httpOnly?: boolean | undefined;
    /**
     * indicates a cookie ought not to be sent along with cross-site requests
     */
    sameSite?: string | undefined;
  }[] {
    const cookies = cookieStr.split(/, (?=[^\s]+=)/s);

    return cookies
      .map((cookie) => cookieParser.parse(cookie))
      .filter((items) => !!items.length)
      .map((items) => items[0]);
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
