import { Observable } from 'rxjs';

import { FileClickHandler, FileClickInterceptor, InputProcessorService } from '@firestitch/file';

import { NgZone } from '@angular/core';
import { tap } from 'rxjs/operators';
import { hasCordovaCameraSupport } from '../helpers';
import { CordovaCameraFileService } from '../services';


export class CordovaFileClickInterceptor extends FileClickInterceptor {

  public constructor(
    private _ngZone: NgZone,
  ) {
    super();
  }

  public intercept(event: PointerEvent, inputProcessorService: InputProcessorService, next: FileClickHandler): Observable<any> {
    if (hasCordovaCameraSupport()) {

      // if(inputProcessorService.capture === 'library') {
      //   this._cordovaCameraFileService.selectCordovaCameraLibrary();  
        
      //   return of(null);      
      // } 
      
      if (inputProcessorService.capture === 'camera' && inputProcessorService.isAcceptImage()) {
        return (new CordovaCameraFileService())
          .selectCordovaCameraPicture()
          .pipe(
            tap((file: File) => {
              this._ngZone.run(() => {
                inputProcessorService.selectFiles([file]);
              });
            }),
          );  
      }
    }
  
    return next.handle(event, inputProcessorService);
  }

}

