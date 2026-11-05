import type { ListParams, PageInfo } from './page.model';
import type { DayOfWeek, Workout } from './workout.model';

// Los mismos valores que acepta el modelo WorkoutChange del backend

// Campos de una rutina que quedan registrados en el historial
export const AUDITED_FIELDS = ['name', 'description', 'dayOfWeek', 'exercises', 'isDeleted'] as const;
export type AuditedField = (typeof AUDITED_FIELDS)[number];

export const AUDITED_FIELD_LABELS: Record<AuditedField, string> = {
  name: 'Nombre',
  description: 'Descripción',
  dayOfWeek: 'Día',
  exercises: 'Ejercicios',
  isDeleted: 'Borrada',
};

// UPDATE: se modificaron datos. DELETE: borrado lógico. REVERT: un admin revirtió otro cambio
export const CHANGE_ACTIONS = ['UPDATE', 'DELETE', 'REVERT'] as const;
export type ChangeAction = (typeof CHANGE_ACTIONS)[number];

export const CHANGE_ACTION_LABELS: Record<ChangeAction, string> = {
  UPDATE: 'Modificación',
  DELETE: 'Borrado',
  REVERT: 'Reversión',
};

// Subdocumento del vector "changes": un campo tocado con su valor anterior y el nuevo.
// oldValue y newValue pueden ser texto, booleano o lista de ids según el campo
export interface FieldChange {
  field: AuditedField;
  order: number;
  oldValue: string | boolean | string[] | null;
  newValue: string | boolean | string[] | null;
  changedAt: string;
}

// Datos que la API resuelve con populate
export interface ChangeWorkoutRef {
  _id: string;
  name: string;
  dayOfWeek: DayOfWeek;
  isDeleted?: boolean;
}

export interface ChangeUserRef {
  _id: string;
  name: string;
  email: string;
  role?: string;
}

// Una entrada del historial de cambios, tal como la devuelve la API
export interface WorkoutChange {
  _id: string;
  // null si la rutina se eliminó definitivamente de la base de datos
  workout: ChangeWorkoutRef | null;
  author: ChangeUserRef | null;
  action: ChangeAction;
  reason?: string;
  changes: FieldChange[];
  reverted: boolean;
  revertedAt?: string | null;
  revertedBy?: ChangeUserRef | null;
  // En las entradas REVERT, el id de la entrada que se revirtió
  revertOf?: string | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

// Respuesta paginada de GET /workout-changes
export interface WorkoutChangesPage {
  changes: WorkoutChange[];
  pagination: PageInfo;
}

// Parámetros del listado: los comunes (page, limit, search) más los filtros del historial.
// reverted va como texto ('true' | 'false') porque así sale del <select>
export interface WorkoutChangeListParams extends ListParams {
  workout?: string;
  author?: string;
  action?: ChangeAction | '';
  reverted?: 'true' | 'false' | '';
  from?: string;
  to?: string;
}

// Un cambio que se envía al registrar una entrada a mano
export interface FieldChangeInput {
  field: AuditedField;
  oldValue: string | boolean | string[];
  newValue: string | boolean | string[];
}

// POST /workout-changes. El autor no se envía: lo pone la API a partir del token
export interface WorkoutChangeInput {
  workout: string;
  reason?: string;
  changes: FieldChangeInput[];
}

// POST /workout-changes/:id/revert
export interface RevertResponse {
  change: WorkoutChange;
  revertEntry: WorkoutChange;
  workout: Workout;
}
