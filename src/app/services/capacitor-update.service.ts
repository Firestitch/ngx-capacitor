import { Injectable } from '@angular/core';
import { FsApi } from '@firestitch/api';

import { App, AppInfo } from '@capacitor/app';
import { FsPrompt } from '@firestitch/prompt';

import { BehaviorSubject, from, Observable, of, timer } from 'rxjs';
import { catchError, filter, finalize, switchMap, tap } from 'rxjs/operators';
import { CapacitorUpdateAppData, CapacitorUpdateConfig } from '../interfaces';


@Injectable({
  providedIn: 'root',
})
export class FsCapacitorUpdate {

  private _pendingUpdate = false;
  private _appData$ = new BehaviorSubject<CapacitorUpdateAppData>({});

  constructor(
    private _prompt: FsPrompt,
    private _api: FsApi,
  ) {}

  public listen(config?: CapacitorUpdateConfig) {
    const interval = (config?.interval || 60) * 1000;
    const delay = (config?.delay || 0) * 1000;

    from(App.getInfo())
    .pipe(
      catchError(() => of(null)),
      filter((data) => !!data),
      tap((appInfo: AppInfo) => {
        this.appData = {
          version: Number(appInfo.version),
          identifier: appInfo.id,
          build: appInfo.build,
          name: appInfo.name,
        };
      }),
      switchMap(() => {
        return timer(delay, interval)
        .pipe(
          filter(() => !this._pendingUpdate),
          switchMap(() =>
            this._api.get(config.url, {
              version: this._appData$.getValue().version,
              identifier: this._appData$.getValue().identifier,
            }, 
            { mapHttpResponseBodyData: false })
              .pipe(
                catchError(() => of(null)),
              )
          ),
          filter((data) => !!data),
          switchMap(({ minVersion, installUrl }) => {
            return this._checkVersion(minVersion, installUrl);
          }),
          finalize(() => {
            this._pendingUpdate = false;
          }),
        )
      })
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

  private _checkVersion(minVersion: number, installUrl: string): Observable<any> {
    return of(null)
    .pipe(
      filter(() => {
        return minVersion > this.appVersion;
      }),
      switchMap(() => {
        this._pendingUpdate = true;

        return this._prompt
          .confirm({
            title: 'New Version Available',
            template: `There a newer version of this app available`,
            buttons: [
              {
                label: 'Update',
                value: 'update',
              }
            ],
          })
        })   
      );
  }

}
