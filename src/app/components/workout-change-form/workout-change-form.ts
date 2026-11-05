import { HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  DAYS_OF_WEEK,
  DAY_LABELS,
  DayOfWeek,
  FieldChangeInput,
  WorkoutChange,
  WorkoutChangeInput,
} from '../../models';
import { WorkoutChangeService } from '../../services/workout-change.service';
import { apiErrorMessage } from '../../utils/api-error';

// Campos que se pueden registrar a mano desde el formulario
type ManualField = 'name' | 'description' | 'dayOfWeek';

// Formulario del historial de cambios. Tiene dos usos según los inputs que reciba:
//   - con workoutId: registra a mano un cambio nuevo sobre esa rutina (POST /workout-changes)
//   - con change:    edita el motivo de una entrada existente (PUT /workout-changes/:id)
// El autor nunca se envía: lo pone la API a partir del token.
@Component({
  selector: 'app-workout-change-form',
  imports: [ReactiveFormsModule],
  templateUrl: './workout-change-form.html',
  styles: `
    :host {
      display: block;
      max-width: 560px;
      margin-bottom: 1rem;
    }
  `,
})
export class WorkoutChangeForm {
  private fb = inject(NonNullableFormBuilder);
  private changeService = inject(WorkoutChangeService);

  // Rutina sobre la que se registra el cambio (modo crear)
  workoutId = input<string>();
  // Entrada cuyo motivo se edita (modo editar)
  change = input<WorkoutChange | null>(null);

  saved = output<void>();
  cancelled = output<void>();

  readonly days = DAYS_OF_WEEK;
  readonly dayLabels = DAY_LABELS;

  saving = signal(false);
  error = signal('');

  form = this.fb.group({
    reason: ['', [Validators.maxLength(200)]],
    field: ['name' as ManualField],
    oldText: [''],
    newText: [''],
    oldDay: ['MONDAY' as DayOfWeek],
    newDay: ['TUESDAY' as DayOfWeek],
  });

  constructor() {
    // Al editar, el formulario arranca con el motivo actual de la entrada
    effect(() => {
      const change = this.change();
      if (change) {
        this.form.patchValue({ reason: change.reason ?? '' });
      }
    });
  }

  get isEditing(): boolean {
    return this.change() !== null;
  }

  save(): void {
    const change = this.change();
    const reason = this.form.controls.reason.value.trim();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (change) {
      this.send(this.changeService.updateReason(change._id, reason));
      return;
    }

    const workout = this.workoutId();
    const changes = this.buildChanges();
    if (!workout || !changes) {
      return;
    }

    const payload: WorkoutChangeInput = { workout, changes };
    // El motivo es opcional: solo se envía si hay texto
    if (reason) {
      payload.reason = reason;
    }
    this.send(this.changeService.createChange(payload));
  }

  // Convierte lo escrito en el formulario en el cambio que espera la API.
  // Devuelve null (y marca el error) si los datos no tienen sentido
  private buildChanges(): FieldChangeInput[] | null {
    const { field, oldText, newText, oldDay, newDay } = this.form.getRawValue();

    const oldValue = field === 'dayOfWeek' ? oldDay : oldText.trim();
    const newValue = field === 'dayOfWeek' ? newDay : newText.trim();

    // El nombre es obligatorio en la rutina: no puede quedar vacío
    if (field === 'name' && (!oldValue || !newValue)) {
      this.error.set('El nombre anterior y el nuevo son obligatorios');
      return null;
    }

    if (oldValue === newValue) {
      this.error.set('El valor anterior y el nuevo no pueden ser iguales');
      return null;
    }

    this.error.set('');
    return [{ field, oldValue, newValue }];
  }

  private send(request: ReturnType<WorkoutChangeService['updateReason']>): void {
    this.saving.set(true);
    this.error.set('');
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.form.reset({ field: 'name', oldDay: 'MONDAY', newDay: 'TUESDAY' });
        this.saved.emit();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(apiErrorMessage(err));
        this.saving.set(false);
      },
    });
  }
}
