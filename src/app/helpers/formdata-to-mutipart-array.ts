import { forkJoin, Observable, of } from "rxjs";
import { map } from "rxjs/operators";


export function formDataToMultipartArray<TModel>(formData: FormData): Observable<any> {

  return forkJoin(
    Object.keys(Object.fromEntries(formData))
      .map((name) => {
        const value = formData.get(name);
      
        return value instanceof Blob ?
          _readFileAsBase64(value)
            .pipe(
                map((data) => ({
                  key: name,
                  fileName: value.name,
                  contentType: value.type,
                  type: 'base64File',
                  value: data,
                })),
              )
        : of({
            key: name,
            type: 'string',
            value,
          });
      })
    );
}

function _readFileAsBase64(file: Blob): Observable<string> {
  return new Observable((observer) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function () {
      observer.next(reader.result as string);
      observer.complete();
    };
    
    reader.onerror = function (error) {
      observer.error(error);
    };
  });
}  
