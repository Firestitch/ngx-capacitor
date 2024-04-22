
export interface RequestOptions {
  method: string;
  data: any;
  params: { [key: string]: string };
  headers: { [key: string]: string };
  dataType?: 'formData',
  responseType?: 'arraybuffer' | 'blob' | 'json' | 'text' | 'document'
}
