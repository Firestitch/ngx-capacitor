import { ChangeDetectionStrategy, Component, Inject, OnInit } from '@angular/core';

import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { Browser } from '@capacitor/browser';


@Component({
  templateUrl: './update.component.html',
  styleUrls: ['./update.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateComponent implements OnInit {

  constructor(
    @Inject(MAT_DIALOG_DATA) private _data: {
      installUrl: string;
    },
  ) { }

  public ngOnInit(): void {
  }

  public update(): void {
    Browser.open({ url: this._data.installUrl });    
  }

}
