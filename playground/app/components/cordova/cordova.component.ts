import { Component, ElementRef, ViewChild } from '@angular/core';


@Component({
  selector: 'app-cordova',
  templateUrl: './cordova.component.html',
  styleUrls: ['./cordova.component.scss']
})
export class CordovaComponent {

  @ViewChild('form')
  public form: ElementRef;



  public config = {};

  public submit() {
    const formData: FormData = new FormData(this.form.nativeElement);

    const x = Object.fromEntries(formData);
    debugger;

    formData.forEach((value, key) => {
     
    });

    //  formDataToObject(formData)
    // .subscribe((object) => {
    //   console.log(object);
    // });    
  }


}
