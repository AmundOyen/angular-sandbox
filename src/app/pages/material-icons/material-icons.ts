import { JsonPipe } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import {
  MaterialIconInput,
  MaterialIconList,
  MaterialIconValue,
  toNames,
} from '../../material-icon-picker';

@Component({
  imports: [
    JsonPipe,
    MatFormFieldModule,
    MatIconModule,
    MatSlideToggleModule,
    MaterialIconInput,
    MaterialIconList,
    ReactiveFormsModule,
  ],
  selector: 'app-material-icons',
  styleUrl: './material-icons.scss',
  templateUrl: './material-icons.html',
})
export class MaterialIcons {
  protected readonly listMultiple = signal(false);
  protected readonly listSelected = signal<readonly string[]>([]);

  protected readonly inputMultiple = signal(false);
  protected readonly control = new FormControl<MaterialIconValue>(null, Validators.required);

  protected setListMultiple(multiple: boolean): void {
    this.listMultiple.set(multiple);
    if (!multiple) {
      this.listSelected.update((names) => names.slice(0, 1));
    }
  }

  /** Converts the value between a name and a list of names, so it stays valid for the mode. */
  protected setInputMultiple(multiple: boolean): void {
    this.inputMultiple.set(multiple);
    const names = toNames(this.control.value);
    this.control.setValue(multiple ? names : (names[0] ?? null));
  }
}
