import { ChangeDetectionStrategy, Component } from '@angular/core';

import { FsExampleModule } from '@firestitch/example';

import { environment } from '@env';

import { UpdateComponent } from '../update/update.component';


@Component({
  templateUrl: './examples.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [FsExampleModule, UpdateComponent],
})
export class ExamplesComponent {
  public config = environment;
}
