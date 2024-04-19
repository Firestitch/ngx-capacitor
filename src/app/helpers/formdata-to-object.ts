import { from, Observable, of } from "rxjs";


// export function formDataToObject<TModel>(formData: FormData): Observable<TModel> {
//     return from(
//      formData.entries()
//     )
//     .pipe(
//       switchMap(([name, value]) => {
//         return convertValue(value)
//          .pipe(
//             map((value) => ({ value, name }))
//          )
//       }),
//       toArray(),
//       map((items) => {
//         const object: any = {};
//         items.forEach((item) => {
//           const names = item.name.split(".");
//           buildProperty(object, names, item.value);
//         });

//         return object;
//       })
//     );
// }

function _readFileAsBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const data = reader.result as string;
      resolve(btoa(data));
    };
    reader.onerror = reject;

    reader.readAsBinaryString(file);
  });
}  

function convertValue(value: any): Observable<number | boolean | string> {
    if (value === "true") return of(true);

    if (value === "false") return of(false);

    if (value === "") return of("");
    
    if (value instanceof Blob) return from(_readFileAsBase64(value));

    if (!isNaN(+value)) return of(+value);

    return of(value);
}


const isPrimitiveArray = (name: string) => name.indexOf("[]") > 0;


function buildProperty(model: any, names: string[], value: unknown) {
  const firstPropertyName = names[0];

  if (isPrimitiveArray(firstPropertyName)) {
      const arrayPropertyName = getArrayPropertyName(firstPropertyName);

      // If the array exists, push the value.
      if (Array.isArray(model[arrayPropertyName])) {
          model[arrayPropertyName].push(value);
      }
      // Else, create the new array on the property with the passed value.
      else {
          model[arrayPropertyName] = [value]
      }

      return;
  }

  // if (isComplexArray(firstPropertyName)) {
  //     const arrayPropertyName = getArrayPropertyName(firstPropertyName);
  //     const indexNumber = getComplexArrayIndex(firstPropertyName);

  //     // If the array does not yet exist on the property, assign an empty
  //     // array
  //     if (!Array.isArray(model[arrayPropertyName])) {
  //         model[arrayPropertyName] = [];
  //     }

  //     // If the object being assigned values to does not yet exist in the
  //     // array, push an empty object to assign values to.
  //     if (model[arrayPropertyName].length === indexNumber) {
  //         model[arrayPropertyName].push({});
  //     }

  //     // Recursively build the complex object using the same method and only
  //     // passing in the necessary names and value.
  //     buildProperty(model[arrayPropertyName][indexNumber], names.slice(1), value);

  //     return;
  // }

  // If the property is a primitive type, assign the value and return.
  if (names.length === 1) {
      model[firstPropertyName] = value;

      return;
  }

  // If the object has not yet been created for the property, assign an empty
  // object to assign values to.
  if (!model[firstPropertyName]) model[firstPropertyName] = {};

  // Recursively build the complex object using the same method and only
  // passing in the necessary names and value.
  buildProperty(model[firstPropertyName], names.slice(1), value);
}

function  getComplexArrayIndex(name: string) {
  const firstBraceIndex = name.indexOf("[");
  const lastBraceIndex = name.indexOf("]");

  // There isn't at least one letter for the property name before the first brace,
  // or, if there isn't an index number between the first and last brace
  if (firstBraceIndex < 1 || lastBraceIndex - firstBraceIndex < 2) {
      throw new Error(name);
  }

  return +name.slice(firstBraceIndex + 1, lastBraceIndex);
}

function getArrayPropertyName(name: string) {
  const arrayFirstBraceIndex = name.indexOf("[");

  if (arrayFirstBraceIndex < 1) {
      throw new Error(name);
  }

  return name.substring(0, arrayFirstBraceIndex);
}