import { ChangeDetectionStrategy, Component, ElementRef, ViewChild } from '@angular/core';

import { FsApi } from '@firestitch/api';
import { FormsModule } from '@angular/forms';


@Component({
    selector: 'app-cordova',
    templateUrl: './cordova.component.html',
    styleUrls: ['./cordova.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [FormsModule],
})
export class CordovaComponent {

  @ViewChild('form')
  public form: ElementRef;

  public config = {};

  constructor(
    private _api: FsApi,
  ) {
    // const cookieStr = 'Token-Expiry=2025-02-22T21%3A04%3A44%2B00%3A00; expires=Sat, 22 Feb 2025 21:04:44 GMT; Max-Age=16070400; path=/; secure, Token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhY2NvdW50SWQiOjY4NTY4LCJleHBpcnlEYXRlIjoiMjAyNS0wMi0yMlQyMTowNDo0NCswMDowMCIsImtleSI6InliNjg1N2FhMjZkMDU1YmY4MDg1Njg0MWZkMmJmYjQ5YiJ9.8IuSLMZav_q_icaTcT7URjionFOn5hYrpxXWMJEr9fQ; expires=Sat, 22 Feb 2025 21:04:44 GMT; Max-Age=16070400; path=/; secure; HttpOnly, Token-XSRF=w9f82bb52e7e96428a51; expires=Sat, 22 Feb 2025 21:04:44 GMT; Max-Age=16070400; path=/; secure, Token-Expiry=2025-02-22T21%3A04%3A44%2B00%3A00; expires=Sat, 22 Feb 2025 21:04:44 GMT; Max-Age=16070400; path=/; secure, Token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhY2NvdW50SWQiOjY4NTY4LCJleHBpcnlEYXRlIjoiMjAyNS0wMi0yMlQyMTowNDo0NCswMDowMCIsImtleSI6InliNjg1N2FhMjZkMDU1YmY4MDg1Njg0MWZkMmJmYjQ5YiJ9.8IuSLMZav_q_icaTcT7URjionFOn5hYrpxXWMJEr9fQ; expires=Sat, 22 Feb 2025 21:04:44 GMT; Max-Age=16070400; path=/; secure; HttpOnly, Token-XSRF=w9f82bb52e7e96428a51; expires=Sat, 22 Feb 2025 21:04:44 GMT; Max-Age=16070400; path=/; secure';

    // const x = cookieStr.split(/, (?=[^\s]+=)/s);


    // //const c = cookieParser.parse(cookieStr);

    // debugger;
  }

  public download() {
    this._api.download('test', 'post', 'https://specify.firestitch.dev/download');
  }

  public submit() {
    const formData: FormData = new FormData(this.form.nativeElement);

    // const x = Object.fromEntries(formData);
    // console.log(x);

    // formDataToMultipartObject(formData)
    //   .subscribe((object) => {
    //     console.log(object);
    //   });
  }

}
