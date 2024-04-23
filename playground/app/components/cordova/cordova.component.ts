import { ChangeDetectionStrategy, Component, ElementRef, ViewChild } from '@angular/core';
import { FsApi } from '@firestitch/api';
import { formDataToMultipartObject } from '@firestitch/capacitor';


@Component({
  selector: 'app-cordova',
  templateUrl: './cordova.component.html',
  styleUrls: ['./cordova.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CordovaComponent {

  @ViewChild('form')
  public form: ElementRef;

  public config = {};

  constructor(
    private _api: FsApi
  ) {}

  public download() {
    this._api.download('test', 'post', 'https://specify.firestitch.dev');
  }

  public submit() {
    const formData: FormData = new FormData(this.form.nativeElement);

    const x = Object.fromEntries(formData);
    console.log(x);

    formDataToMultipartObject(formData)
    .subscribe((object) => {
      console.log(object);
    });
  }

}
