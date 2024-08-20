import { Injectable } from '@angular/core';

import { from, Observable, of, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';

import { Capacitor } from '@capacitor/core';
import { Platform } from '@ionic/angular';

import { CordovaState } from '../enums';
import { getCordova } from '../helpers';

import { FsCapacitorCookie } from './capacitor-cookie.service';

const NativeFile = window.File;
const NativeFileReader = window.FileReader;


@Injectable({
  providedIn: 'root',
})
export class FsCapacitor {

  public CordovaFile;
  public CordovaFileReader;

  constructor(
    private _platform: Platform,
    private _capacitorCookie: FsCapacitorCookie,
  ) {}

  public get ready$(): Observable<any> {
    return of(true);
  }

  public get resume$(): Observable<void> {
    return this._platform.resume;
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

  public getAppVersion(): Observable<string> {
    if(!getCordova()?.getAppVersion) {
      return of(null);
    }

    return from<string>(getCordova().getAppVersion.getVersionNumber());
  }

  public init(): Observable<void> {
    return this.ready$
      .pipe(
        tap(() => {
          console.log('Cordova Service init() ready');
        }),
        tap(() => this._initFile()),
        tap(() => this._capacitorCookie.init()),
      );
  }

  /**
   * Restored the File/FileReader object from cordova-plugin-file overriding it
   */
  private _initFile(): void {
    this.CordovaFile = this.window.File;
    this.CordovaFileReader = this.window.FileReader;
    this.window.File = NativeFile;
    this.window.FileReader = NativeFileReader;
    this.window.CordovaFile = this.CordovaFile;
    this.window.CordovaFileReader = this.CordovaFileReader;
  }

}

