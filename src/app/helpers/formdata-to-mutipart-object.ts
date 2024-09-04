import { forkJoin, Observable, of } from 'rxjs';


export function formDataToMultipartObject<TModel>(formData: FormData): Observable<any> {
  return forkJoin(
    Object.keys(Object.fromEntries(formData))
      .reduce((accum, name) => {
        return {
          ...accum,
          [name]: (
            formData.get(name) instanceof Blob ?
              _readFileAsBase64(formData.get(name) as Blob)
              : of(formData.get(name))
          ),
        };
      }, {}),
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
