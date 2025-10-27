import { ChangeDetectionStrategy, Component } from '@angular/core';

import { environment } from '@env';
import { FsExampleModule } from '@firestitch/example';
import { CordovaComponent } from '../cordova/cordova.component';


@Component({
    templateUrl: './examples.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [FsExampleModule, CordovaComponent],
})
export class ExamplesComponent {
  public config = environment;
}
