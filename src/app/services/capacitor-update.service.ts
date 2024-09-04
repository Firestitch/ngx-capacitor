import { Injectable } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';

import { FsApi, ProcessApiError } from '@firestitch/api';

import { BehaviorSubject, from, Observable, of, throwError, timer } from 'rxjs';
import { catchError, filter, switchMap, tap } from 'rxjs/operators';

import { HttpContext } from '@angular/common/http';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

import { UpdateComponent } from '../components';
import { CapacitorUpdateToken } from '../consts';
import { CapacitorUpdateAppData, CapacitorUpdateConfig } from '../interfaces';


@Injectable({
  providedIn: 'root',
})
export class FsCapacitorUpdate {

  private _pendingUpdate = false;
  private _previewApiUrl: string;
  private _appData$ = new BehaviorSubject<CapacitorUpdateAppData>({});

  constructor(
    private _api: FsApi,
    private _dialog: MatDialog,
  ) {}

  public listen(config?: CapacitorUpdateConfig): void {
    const interval = (config?.interval || 60) * 1000;
    const delay = (config?.delay || 0) * 1000;
    const updateUrl = (config?.updateUrl);

    if (
      Capacitor.getPlatform() !== 'ios' &&
      Capacitor.getPlatform() !== 'android'
    ) {
      console.log(`Skipping update service platform ${Capacitor.getPlatform()} not supported`);

      return;
    }

    from(App.getInfo())
      .pipe(
        catchError((e) => {
          console.error(e);

          return throwError(e);
        }),
        tap((appInfo) => {
          this.appData = {
            version: Number(appInfo.version),
            bundleIdentifier: appInfo.id,
            buildNumber: appInfo.build,
            name: appInfo.name,
            platform: Capacitor.getPlatform(),
          };
        }),
        switchMap(() => {
          return timer(delay, interval)
            .pipe(
              filter(() => !this._pendingUpdate),
              switchMap(() =>
                this._api.get(updateUrl, {
                  version: this._appData$.getValue().version,
                  buildNumber: this._appData$.getValue().buildNumber,
                  bundleIdentifier: this._appData$.getValue().bundleIdentifier,
                  platform: this._appData$.getValue().platform,
                },
                {
                  mapHttpResponseBodyData: false,
                  context: new HttpContext()
                    .set(ProcessApiError, false)
                    .set(CapacitorUpdateToken, true),
                })
                  .pipe(
                    catchError(() =>
                      of(null)
                        .pipe(
                          filter((data) => !!data),
                        ),
                    ),
                  ),
              ),
              switchMap(({ action, installUrl, previewApiUrl }) => {
                return this._checkUpdate(action, installUrl, previewApiUrl);
              }),
            );
        }),
      )
      .subscribe();
  }

  public get appData(): CapacitorUpdateAppData {
    return this._appData$.getValue();
  }

  public set appData(appData: CapacitorUpdateAppData) {
    this._appData$.next(appData);
  }

  public get appVersion() {
    return (this._appData$.getValue() || {}).version;
  }

  public get previewApiUrl() {
    return this._previewApiUrl;
  }

  private _checkUpdate(action: string, installUrl: string, previewApiUrl: string): Observable<any> {
    this._previewApiUrl = previewApiUrl;

    return of(null)
      .pipe(
        filter(() => {
          return action === 'update';
        }),
        switchMap(() => {
          this._pendingUpdate = true;

          return this._dialog
            .open(UpdateComponent, {
              data: {
                installUrl,
              },
              disableClose: true,
            })
            .afterClosed();

        }),
      );
  }

}
