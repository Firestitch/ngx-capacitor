import { Injectable } from '@angular/core';
import { DisplayApiError, FsApi } from '@firestitch/api';

import { App } from '@capacitor/app';
import { Device } from '@capacitor/device';

import { HttpContext } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject, from, Observable, of, throwError, timer } from 'rxjs';
import { catchError, filter, map, switchMap, tap } from 'rxjs/operators';
import { UpdateComponent } from '../components';
import { CapacitorUpdateAppData, CapacitorUpdateConfig } from '../interfaces';


@Injectable({
  providedIn: 'root',
})
export class FsCapacitorUpdate {

  private _pendingUpdate = false;
  private _appData$ = new BehaviorSubject<CapacitorUpdateAppData>({});

  constructor(
    private _api: FsApi,
    private _dialog: MatDialog,
  ) {}

  public listen(config?: CapacitorUpdateConfig) {
    const interval = (config?.interval || 60) * 1000;
    const delay = (config?.delay || 0) * 1000;
    const updateUrl = (config?.updateUrl);

    from(Device.getInfo())
    .pipe(
      switchMap((deviceInfo) => {
        return deviceInfo.platform === 'web' ?
          throwError('Web platform detected: skipping app update') : of(deviceInfo);        
      }), 
      switchMap((deviceInfo) => from(App.getInfo())
        .pipe(
          map((appInfo) => ({
            deviceInfo,
            appInfo,
          })
          )
        )
      ),
      // catchError(() => of({ 
      //   appInfo: {
      //     version: '',
      //     id: 'com.firestitch.stg.tasteadvisor',
      //     build: '100',
      //     name: '',
      //   },
      //   deviceInfo: { platform: 'ios' }
      // })),
      catchError((e) => 
        of(null)
          .pipe(
            tap(() => console.error(e)),
            filter((data) => !!data)
          )
      ),
      tap(({ appInfo, deviceInfo }) => {
        this.appData = {
          version: Number(appInfo.version),
          bundleIdentifier: appInfo.id,
          buildNumber: appInfo.build,
          name: appInfo.name,
          platform: deviceInfo.platform,
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
              context: new HttpContext().set(DisplayApiError, false)  
            })
            .pipe(
              catchError(() => 
                of(null)
                  .pipe(
                    filter((data) => !!data)
                  )
              ),
            )
          ),
          switchMap(({ action, installUrl }) => {
            return this._checkUpdate(action, installUrl);
          }),
        )
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

  private _checkUpdate(action: string, installUrl: string): Observable<any> {
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
              installUrl
            },
            disableClose: true,
          })
          .afterClosed()

        })   
      );
  }

}
