import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject } from '@angular/core';

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
  private _api = inject(FsApi);


  @ViewChild('form')
  public form: ElementRef;

  public config = {};

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
