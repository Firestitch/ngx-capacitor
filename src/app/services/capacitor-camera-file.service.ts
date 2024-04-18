import { Observable } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';

import { getCordovaCamera, getCordovaCapture, getCordovaResolveLocalFileSystemURL } from '../helpers';


export class CordovaCameraFileService {

  public cordova = {  
    camera: null,
    capture: null,
    resolveLocalFileSystemURL: null 
  };

  constructor() {
    this.cordova.camera = getCordovaCamera();
    this.cordova.capture = getCordovaCapture();
    this.cordova.resolveLocalFileSystemURL = getCordovaResolveLocalFileSystemURL();
  }

  public cordovaCameraCleanup() {
    this.cordova.camera.cleanup();
  }

  public selectCordovaCameraPicture(): Observable<File> {
    const options: any = {
      destinationType: this.cordova.camera.DestinationType.FILE_URI,
      encodingType: this.cordova.camera.EncodingType.JPEG,
      sourceType: this.cordova.camera.PictureSourceType.CAMERA,
      mediaType: this.cordova.camera.MediaType.PICTURE,
      quality: 100,
      correctOrientation: true,
    };

    return new Observable<string>((observer) => {
      this.cordova.camera.getPicture((data) => {
        observer.next(data);
        observer.complete();
      }, (error) => {
        observer.error(error);
      }, options);
    })
      .pipe(
        switchMap((path: string) => this._getFile(path)),
        finalize(() => this.cordovaCameraCleanup())
      );
  }

  private _getFile(path): Observable<File> {
    if (!path.match(/^file:/)) {
      path = 'file://'.concat(path);
    }

    return new Observable<File>((observer) => {
      this.cordova.resolveLocalFileSystemURL(path, (fileEntry) => {
        observer.next(fileEntry);
        observer.complete();        
      },(error) => {
        observer.error(error);
      });
    })
      .pipe(
        switchMap((fileEntry: any) => {
          return new Observable<File>((fileEntryObserver) => {
            fileEntry.file((file) => {
              const reader = new (window as any).CordovaFileReader();
              reader.onloadend = (encodedFile) => {
                const fileData = (<any>encodedFile.target).result.split('base64,').pop();
                const byteString = atob(fileData);
                let n = byteString.length;
                const u8arr = new Uint8Array(n);

                while (n--) {
                  u8arr[n] = byteString.charCodeAt(n);
                }

                const blob = new File([u8arr], file.name, { type: file.type });
                fileEntryObserver.next(blob);
                fileEntryObserver.complete();
              };

              reader.onerror = (error) => {
                fileEntryObserver.error(error);
              }

              reader.readAsDataURL(file);
            },
            (error) => {
              fileEntryObserver.error(error);
            });
          });
        }),
      );
  }

  // public selectCordovaCameraLibrary(): Observable<FsFile[]> {
  //   return this
  //     .selectCordovaCamera(this.cordova.camera.PictureSourceType.PHOTOLIBRARY, this.cordova.camera.MediaType.ALLMEDIA);
  // }

  // public selectCordovaCamera(sourceType, mediaType) {
  //   const options: any = {
  //     destinationType: this.cordova.camera.DestinationType.FILE_URI,
  //     encodingType: this.cordova.camera.DestinationType.JPEG,
  //     sourceType: sourceType,
  //     mediaType: mediaType,
  //     quality: 100,
  //     correctOrientation: false
  //   };

  //   // if (this._inputProcessorService.accept.length) {
  //   //   const video = this._inputProcessorService.isAcceptVideo();
  //   //   const image = this._inputProcessorService.isAcceptImage();

  //   //   if (video && !image) {
  //   //     options.mediaType = this.cordova.camera.MediaType.VIDEO;
  //   //   } else if (image && !video) {
  //   //     options.mediaType = this.cordova.camera.MediaType.PICTURE;
  //   //   }
  //   // }

  //   this.cordova.camera.getPicture((data) => {
  //     this.getCordovaFile(data)
  //     .then((file) => {
  //       this._ngZone.run(() => {
  //         //this._inputProcessorService.selectFiles([file]);
  //       });
  //       this.cordovaCameraCleanup();
  //     }).catch(error => {
  //       console.log(error);
  //       this.cordovaCameraCleanup();
  //     });

  //   }, () => {
  //     this.cordovaCameraCleanup();
  //   }, options);
  // }

  // public selectCordovaCaptureImage() {
  //   this.cordova.capture.captureImage((files) => {
  //     this.successCaptureFiles(files);
  //   },
  //   this.errorCaptureFiles, { limit: 1 });
  // }

  // public selectCordovaCaptureVideo() {
  //   this.cordova.capture.captureVideo((files) => {
  //     this.successCaptureFiles(files);
  //   },
  //   this.errorCaptureFiles, { limit: 1 });
  // }

  // public successCaptureFiles(files) {
  //   files.forEach((captureFile) => {
  //     this.getCordovaFile(captureFile.fullPath)
  //     .then((file) => {
  //       this._ngZone.run(() => {
  //         this._inputProcessorService.selectFiles([file]);
  //       });
  //     }).catch(error => {
  //       console.log(error);
  //     })
  //   });
  // }

  // public errorCaptureFiles(error) {
  //   console.log(error);
  // }


}
