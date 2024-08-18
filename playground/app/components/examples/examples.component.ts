import { ChangeDetectionStrategy, Component } from '@angular/core';

import { environment } from '@env';


@Component({
  templateUrl: './examples.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExamplesComponent {
  public config = environment;
}
