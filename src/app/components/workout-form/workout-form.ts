import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import {
  DAYS_OF_WEEK,
  DAY_LABELS,
  DayOfWeek,
  EXERCISE_CATEGORY_LABELS,
  Exercise,
  Workout,
  WorkoutInput,
} from '../../models';
import { ExerciseService } from '../../services/exercise.service';
import { WorkoutService } from '../../services/workout.service';
import { apiErrorMessage } from '../../utils/api-error';
import { ConfirmModal } from '../confirm-modal/confirm-modal';
import { WorkoutChangesList } from '../workout-changes-list/workout-changes-list';

@Component({
  selector: 'app-workout-form',
  imports: [ReactiveFormsModule, RouterLink, ConfirmModal, WorkoutChangesList],
  templateUrl: './workout-form.html',
  styles: `
    :host {
      display: block;
      max-width: 860px;
    }
    form {
      max-width: 560px;
    }
    .history {
      margin-top: 2rem;
    }
  `,
})
export class WorkoutForm implements OnInit {
  private fb = inject(NonNullableFormBuilder);
  private workoutService = inject(WorkoutService);
  private exerciseService = inject(ExerciseService);
  private router = inject(Router);

  // Viene del :id de la ruta. En workouts/new no hay id y el formulario sirve para crear
  id = input<string>();

  // Opciones del selector de ejercicios (la API permite pedir hasta 100 de golpe)
  exercises = signal<Exercise[]>([]);
  readonly days = DAYS_OF_WEEK;
  readonly dayLabels = DAY_LABELS;
  readonly categoryLabels = EXERCISE_CATEGORY_LABELS;

  loading = signal(false);
  loadFailed = signal(false);
  saving = signal(false);
  // Aviso de confirmación que se enseña antes de enviar el formulario
  confirmOpen = signal(false);
  error = signal('');

  form = this.fb.group({
    name: ['', [Validators.required, Validators.pattern(/\S/)]],
    dayOfWeek: ['MONDAY' as DayOfWeek, Validators.required],
    description: [''],
    exercises: [[] as string[]],
  });

  ngOnInit(): void {
    this.exerciseService.getExercises({ limit: 100 }).subscribe({
      // Un ADMIN recibe también los ejercicios borrados lógicamente: no se pueden elegir
      next: (response) => this.exercises.set(response.exercises.filter((exercise) => !exercise.isDeleted)),
      error: (err: HttpErrorResponse) => this.error.set(apiErrorMessage(err)),
    });

    const id = this.id();
    if (!id) {
      return;
    }

    this.loading.set(true);
    this.workoutService.getWorkout(id).subscribe({
      next: (response) => {
        this.fillForm(response.workout);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(apiErrorMessage(err));
        this.loadFailed.set(true);
        this.loading.set(false);
      },
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // No se guarda hasta que el usuario confirma en el aviso
    this.confirmOpen.set(true);
  }

  cancelSave(): void {
    this.confirmOpen.set(false);
  }

  confirmSave(): void {
    this.confirmOpen.set(false);

    const id = this.id();
    // La API reemplaza la rutina entera al editar. La descripción puede ir vacía
    // (Joi la acepta), así que si la borras en el formulario también se borra en la API
    const workout: WorkoutInput = this.form.getRawValue();
    const request = id
      ? this.workoutService.updateWorkout(id, workout)
      : this.workoutService.createWorkout(workout);

    this.saving.set(true);
    this.error.set('');
    request.subscribe({
      next: () => this.router.navigate(['/workouts'], { replaceUrl: true }),
      error: (err: HttpErrorResponse) => {
        this.error.set(apiErrorMessage(err));
        this.saving.set(false);
      },
    });
  }

  /** Un admin ha revertido un cambio en el historial: vuelvo a leer la rutina para que el formulario
   *  enseñe los valores restaurados */
  reloadWorkout(): void {
    const id = this.id();
    if (!id) {
      return;
    }

    this.workoutService.getWorkout(id).subscribe({
      next: (response) => this.fillForm(response.workout),
      error: (err: HttpErrorResponse) => this.error.set(apiErrorMessage(err)),
    });
  }

  private fillForm(workout: Workout): void {
    this.form.patchValue({
      name: workout.name,
      dayOfWeek: workout.dayOfWeek,
      description: workout.description ?? '',
      // La API manda los ejercicios enteros (populate), pero el select trabaja con sus ids
      exercises: workout.exercises.map((exercise) => exercise._id),
    });
  }
}
