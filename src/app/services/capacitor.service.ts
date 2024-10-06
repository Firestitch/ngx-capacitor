import { Injectable } from '@angular/core';
import { ActivationEnd, Router } from '@angular/router';

import { from, Observable, of, throwError } from 'rxjs';
import { filter, map, switchMap, tap } from 'rxjs/operators';

import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';

import { CordovaState } from '../enums';
import { CapacitorStatusBarConfig } from '../interfaces';

import { FsCapacitorCookie } from './capacitor-cookie.service';

const nativeFile = window.File;
const nativeFileReader = window.FileReader;


@Injectable({
  providedIn: 'root',
})
export class FsCapacitor {

  public CordovaFile;
  public CordovaFileReader;

  constructor(
    private _capacitorCookie: FsCapacitorCookie,
    private _router: Router,
  ) {}

  public get ready$(): Observable<any> {
    return of(true);
  }
  
  public get window(): any {
    return window as any;
  }

  public get state(): CordovaState {
    return this.window.cordovaState || CordovaState.Unsupported;
  }

  public set state(value: CordovaState) {
    this.window.cordovaState = value;
  }

  public get cordova(): any {
    return this.window.cordova;
  }

  public get ready(): boolean {
    return this.state === CordovaState.Ready;
  }

  public get supported(): boolean {
    return Capacitor.isNativePlatform();
  }

  public get unsupported(): boolean {
    return this.state === CordovaState.Unsupported;
  }

  public _cordovaReady(): Observable<void> {
    if(this.state === CordovaState.Unsupported) {
      return throwError('Cordova not supported');
    }

    if(this.state === CordovaState.Ready) {
      return of(null);
    }

    return new Observable<any>((observer) => {
      if(this.cordova) {
        observer.next(this.cordova);
        observer.complete();

        return;
      }

      this.window.addEventListener('cordovaLoaded', () => {
        observer.next(this.cordova);
        observer.complete();
      });
    })
      .pipe(
        tap(() => {
          this.state = CordovaState.Ready;
        }),
      );
  }

  public init(): Observable<void> {
    if (
      Capacitor.getPlatform() !== 'ios' &&
      Capacitor.getPlatform() !== 'android'
    ) {
      console.log(`Skipping capacitor service init() platform ${Capacitor.getPlatform()} not supported`);

      return of(null);
    }

    return this.ready$
      .pipe(
        tap(() => {
          console.log('Capacitor service init() ready');
        }),
        tap(() => this._initFile()),
        tap(() => this._capacitorCookie.init()),
      );
  }

  private _initStatusBar(): void {
    this._router.events
      .pipe(
        filter((event) => event instanceof ActivationEnd),
        switchMap((event: ActivationEnd) => from(StatusBar.getInfo())
          .pipe(
            map((info) => ({ event, info })),
          )),
      )
      .subscribe(({ event, info }) => {
        let fsCapacitorStatusBar: CapacitorStatusBarConfig = {
          visible: info.visible,
        };

        let activatedRoute = event.snapshot;
        do {
          fsCapacitorStatusBar = {
            ...activatedRoute.data?.fsCapacitorStatusBar || {},
            ...fsCapacitorStatusBar,
          };

          activatedRoute = activatedRoute.parent;
        } while(activatedRoute);

        if(fsCapacitorStatusBar.visible) {
          StatusBar.show();
        } else {
          StatusBar.hide();
        }

        if(fsCapacitorStatusBar.backgroundColor) {
          StatusBar.setBackgroundColor({ color: fsCapacitorStatusBar.backgroundColor });
        }

        if(fsCapacitorStatusBar.style) {
          StatusBar.setStyle({ style: fsCapacitorStatusBar.style });
        }
      });
  }

  /**
   * Restored the File/FileReader object from cordova-plugin-file overriding it
   */
  private _initFile(): void {
    this.CordovaFile = this.window.File;
    this.CordovaFileReader = this.window.FileReader;
    this.window.File = nativeFile;
    this.window.FileReader = nativeFileReader;
    this.window.CordovaFile = this.CordovaFile;
    this.window.CordovaFileReader = this.CordovaFileReader;
  }

}

