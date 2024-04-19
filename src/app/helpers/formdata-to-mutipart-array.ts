import { forkJoin, Observable, of } from "rxjs";


export function formDataToMultipartArray<TModel>(formData: FormData): Observable<any> {

  return forkJoin(
    Object.keys(Object.fromEntries(formData))
      .map((name) => {
        const value = formData.get(name);

        return of(
          value instanceof Blob ?
          {
            key: name,
            fileName: value.name,
            contentType: value.type,
            type: 'base64File',
            value: _readFileAsBase64(value)
          } :
          {
            key: name,
            type: 'string',
            value,
          }
        );
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
