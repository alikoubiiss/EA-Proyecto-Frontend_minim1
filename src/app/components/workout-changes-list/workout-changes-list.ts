import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EMPTY, Observable, Subject, catchError, finalize, switchMap, tap } from 'rxjs';

import {
  AUDITED_FIELD_LABELS,
  AuditedField,
  CHANGE_ACTIONS,
  CHANGE_ACTION_LABELS,
  ChangeAction,
  DAY_LABELS,
  DayOfWeek,
  FieldChange,
  WorkoutChange,
} from '../../models';
import { AuthService } from '../../services/auth.service';
import { WorkoutChangeService } from '../../services/workout-change.service';
import { apiErrorMessage } from '../../utils/api-error';
import { ConfirmModal } from '../confirm-modal/confirm-modal';
import { DeleteModal } from '../delete-modal/delete-modal';
import { Pagination } from '../pagination/pagination';
import { WorkoutChangeForm } from '../workout-change-form/workout-change-form';

const PAGE_SIZE = 5;

// Historial de cambios (auditoría) de las rutinas, con paginación y búsqueda en el servidor.
// Se usa de dos maneras:
//   - integrado en las vistas de rutinas, con workoutId: muestra el historial de esa rutina
//   - como página propia (/workout-changes): muestra el historial de todas las rutinas
// Qué botones se ven depende del rol: revertir es solo de ADMIN; editar y borrar, del autor o un ADMIN.
// Es solo comodidad visual: la API vuelve a comprobarlo todo (401, 403).
@Component({
  selector: 'app-workout-changes-list',
  imports: [FormsModule, DatePipe, RouterLink, Pagination, ConfirmModal, DeleteModal, WorkoutChangeForm],
  templateUrl: './workout-changes-list.html',
  styles: `
    .toolbar {
      flex-wrap: wrap;
      justify-content: flex-start;
    }
    .toolbar .search {
      flex: 1 1 220px;
    }
    .inline-date {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 0.4rem;
    }
  `,
})
export class WorkoutChangesList {
  private changeService = inject(WorkoutChangeService);
  private pageRequests = new Subject<number>();
  auth = inject(AuthService);

  // Rutina cuyo historial se enseña. Sin valor, se enseñan todos. En la página /workout-changes
  // llega de la URL (?workoutId=...) porque el router pasa los parámetros como inputs
  workoutId = input<string>();
  // Dentro de otra vista no se pinta el título grande
  embedded = input(false);
  // Avisa al padre cuando se ha revertido un cambio, para que recargue la rutina
  workoutReverted = output<void>();

  readonly actions = CHANGE_ACTIONS;
  readonly actionLabels = CHANGE_ACTION_LABELS;
  readonly fieldLabels = AUDITED_FIELD_LABELS;

  changes = signal<WorkoutChange[]>([]);
  totalPages = signal(1);
  page = signal(1);
  loading = signal(true);
  error = signal('');
  notice = signal('');

  // Buscador (motivo o campo modificado) y filtros, todos combinables entre sí
  search = signal('');
  action = signal<ChangeAction | ''>('');
  reverted = signal<'true' | 'false' | ''>('');
  from = signal('');
  to = signal('');

  // Revertir: entrada pendiente de confirmar
  changeToRevert = signal<WorkoutChange | null>(null);
  reverting = signal(false);

  // Editar el motivo y registrar a mano: formularios integrados encima de la tabla
  changeToEdit = signal<WorkoutChange | null>(null);
  creating = signal(false);

  // Borrar: entrada pendiente de elegir borrado lógico o definitivo
  changeToDelete = signal<WorkoutChange | null>(null);
  deleting = signal(false);
  modalAllowSoft = computed(() => !this.changeToDelete()?.isDeleted);

  constructor() {
    this.pageRequests
      .pipe(
        switchMap((page) => {
          this.loading.set(true);
          this.error.set('');
          return this.request(page).pipe(
            tap((response) => {
              this.changes.set(response.changes);
              this.totalPages.set(Math.max(response.pagination.totalPages, 1));
              this.page.set(response.pagination.page);
            }),
            catchError((err: HttpErrorResponse) => {
              this.changes.set([]);
              this.error.set(apiErrorMessage(err));
              return EMPTY;
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    // Carga la primera página al empezar y cada vez que cambia la rutina
    effect(() => {
      this.workoutId();
      untracked(() => this.loadPage(1));
    });
  }

  // Pide la página al servidor. Con workoutId usa el historial de esa rutina; si no, el general
  private request(page: number) {
    const params = {
      page,
      limit: PAGE_SIZE,
      search: this.search(),
      action: this.action(),
      reverted: this.reverted(),
      // Los <input type="date"> dan 2026-11-05: la API espera una fecha ISO. "Hasta" incluye todo ese día
      from: this.from() ? new Date(`${this.from()}T00:00:00`).toISOString() : '',
      to: this.to() ? new Date(`${this.to()}T23:59:59.999`).toISOString() : '',
    };

    const workoutId = this.workoutId();
    return workoutId
      ? this.changeService.getWorkoutHistory(workoutId, params)
      : this.changeService.getChanges(params);
  }

  loadPage(page: number): void {
    this.page.set(page);
    this.pageRequests.next(page);
  }

  // ----- Qué puede hacer el usuario con la sesión actual -----

  /** Revertir: solo ADMIN, y solo entradas activas, sin revertir y con la rutina todavía existente */
  canRevert(change: WorkoutChange): boolean {
    return this.auth.isAdmin() && !change.reverted && !change.isDeleted && change.workout !== null;
  }

  /** Editar o borrar: el autor de la entrada o un ADMIN */
  canManage(change: WorkoutChange): boolean {
    return this.auth.isAdmin() || change.author?._id === this.auth.user()?._id;
  }

  // ----- Cómo se pintan los valores -----

  /** Convierte el valor de un campo en un texto legible (la lista de ejercicios son ids: se cuenta) */
  formatValue(item: FieldChange, which: 'oldValue' | 'newValue'): string {
    const value = item[which];
    const field: AuditedField = item.field;

    if (value === null || value === undefined) {
      return '—';
    }
    if (typeof value === 'boolean') {
      return value ? 'Sí' : 'No';
    }
    if (Array.isArray(value)) {
      return value.length === 1 ? '1 ejercicio' : `${value.length} ejercicios`;
    }
    if (field === 'dayOfWeek') {
      return DAY_LABELS[value as DayOfWeek] ?? value;
    }
    return value === '' ? '(vacío)' : value;
  }

  // ----- Revertir -----

  askRevert(change: WorkoutChange): void {
    this.changeToRevert.set(change);
  }

  cancelRevert(): void {
    this.changeToRevert.set(null);
  }

  /** POST /workout-changes/:id/revert. Un 409 (ya revertido, rutina cambiada después...) se enseña tal cual */
  confirmRevert(): void {
    const change = this.changeToRevert();
    if (!change) {
      return;
    }

    this.reverting.set(true);
    this.error.set('');
    this.notice.set('');
    this.changeService.revertChange(change._id).subscribe({
      next: () => {
        this.changeToRevert.set(null);
        this.reverting.set(false);
        this.notice.set('Cambio revertido: la rutina ha vuelto a su valor anterior.');
        this.loadPage(this.page());
        this.workoutReverted.emit();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(apiErrorMessage(err));
        this.changeToRevert.set(null);
        this.reverting.set(false);
      },
    });
  }

  // ----- Formularios (registrar a mano / editar el motivo) -----

  openCreate(): void {
    this.changeToEdit.set(null);
    this.creating.set(true);
  }

  openEdit(change: WorkoutChange): void {
    this.creating.set(false);
    this.changeToEdit.set(change);
  }

  closeForms(): void {
    this.creating.set(false);
    this.changeToEdit.set(null);
  }

  onSaved(): void {
    this.closeForms();
    this.loadPage(this.page());
  }

  // ----- Borrar -----

  askDelete(change: WorkoutChange): void {
    this.changeToDelete.set(change);
  }

  cancelDelete(): void {
    this.changeToDelete.set(null);
  }

  /** Borrado lógico: DELETE /workout-changes/:id */
  softDelete(): void {
    this.runDelete((id) => this.changeService.softDeleteChange(id));
  }

  /** Borrado definitivo: DELETE /workout-changes/:id/hard */
  hardDelete(): void {
    this.runDelete((id) => this.changeService.hardDeleteChange(id));
  }

  private runDelete(request: (id: string) => Observable<void>): void {
    const change = this.changeToDelete();
    if (!change) {
      return;
    }

    this.deleting.set(true);
    this.error.set('');
    this.notice.set('');
    request(change._id).subscribe({
      next: () => {
        // Si era la última entrada de la página, vuelvo a la anterior para no quedarme en una página vacía
        const wasLast = this.changes().length === 1 && this.page() > 1;
        this.changeToDelete.set(null);
        this.deleting.set(false);
        this.loadPage(wasLast ? this.page() - 1 : this.page());
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(apiErrorMessage(err));
        this.changeToDelete.set(null);
        this.deleting.set(false);
      },
    });
  }
}
