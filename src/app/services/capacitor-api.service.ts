import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

import { Directory, Filesystem, WriteFileResult } from '@capacitor/filesystem';
import { FileOpener } from '@capawesome-team/capacitor-file-opener';
import { blobToBase64, FsApi } from '@firestitch/api';
import { from } from 'rxjs';
import { switchMap } from 'rxjs/operators';


@Injectable({
  providedIn: 'root',
})
export class FsCapacitorApi extends FsApi {

  public download(name: string, method: any, url: string, data?: any): void {
    if (Capacitor.isNativePlatform()) {
      this.file(method, url, data)
        .pipe(
          switchMap((file: File) =>{
            return blobToBase64(file)
            .pipe(
              switchMap((data) => {
                return from(Filesystem.writeFile({
                  path: file.name,
                  data,
                  directory: Directory.Data,
                }));
              }),
              switchMap((saveFile: WriteFileResult) => {
                return from(FileOpener.openFile({
                  path: saveFile.uri,
                  mimeType: file.type
                }));
              })
            )
          }),
        );
    }

    super.download(name, method, url, data);
  }
}

