import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { MaterialIconInput } from '../material-icon-picker';

export interface NavEditDialogData {
  /** What is being edited, used in the title and labels, e.g. `group` or `menu`. */
  readonly kind: string;
  readonly label: string;
  readonly icon: string | null;
}

export interface NavEditDialogResult {
  readonly label: string;
  /** The chosen icon, or `null` for the default icon. */
  readonly icon: string | null;
}

/** Dialog for editing the label and icon of a navigator group or menu. */
@Component({
  selector: 'nav-edit-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MaterialIconInput,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title>Edit {{ data.kind }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content>
        <mat-form-field appearance="outline">
          <mat-label>Label</mat-label>
          <input matInput formControlName="label" required cdkFocusInitial autocomplete="off" />
          @if (form.controls.label.invalid) {
            <mat-error>Enter a label</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Icon</mat-label>
          <material-icon-input formControlName="icon" />
          <mat-hint>Leave empty to use the default icon</mat-hint>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancel</button>
        <button matButton="filled" type="submit">Save</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-dialog-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    mat-form-field {
      width: 100%;
    }
  `,
})
export class NavEditDialog {
  protected readonly data = inject<NavEditDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<NavEditDialog, NavEditDialogResult>>(MatDialogRef);

  /** @internal Exposed for tests. */
  readonly form = new FormGroup({
    label: new FormControl(this.data.label, {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/)],
    }),
    icon: new FormControl<string | null>(this.data.icon),
  });

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { label, icon } = this.form.getRawValue();
    this.dialogRef.close({ label: label.trim(), icon: icon || null });
  }
}
