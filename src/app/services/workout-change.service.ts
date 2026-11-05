import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  RevertResponse,
  WorkoutChange,
  WorkoutChangeInput,
  WorkoutChangeListParams,
  WorkoutChangesPage,
} from '../models';
import { buildListParams } from '../utils/list-params';

export interface WorkoutChangeResponse {
  change: WorkoutChange;
}

// Concentra todas las peticiones del historial de cambios (auditoría) de las rutinas.
// El token lo añade el interceptor, así que aquí no hay que ocuparse de él.
@Injectable({ providedIn: 'root' })
export class WorkoutChangeService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/workout-changes`;

  /** GET /workout-changes. Listado paginado en el servidor, con buscador y filtros combinables */
  getChanges(params: WorkoutChangeListParams = {}): Observable<WorkoutChangesPage> {
    return this.http.get<WorkoutChangesPage>(this.baseUrl, { params: buildListParams(params) });
  }

  /** GET /workout-changes/workout/:workoutId. Historial de una rutina (mismos parámetros) */
  getWorkoutHistory(
    workoutId: string,
    params: WorkoutChangeListParams = {},
  ): Observable<WorkoutChangesPage> {
    return this.http.get<WorkoutChangesPage>(`${this.baseUrl}/workout/${workoutId}`, {
      params: buildListParams(params),
    });
  }

  /** GET /workout-changes/:id */
  getChange(id: string): Observable<WorkoutChangeResponse> {
    return this.http.get<WorkoutChangeResponse>(`${this.baseUrl}/${id}`);
  }

  /** POST /workout-changes. Registra a mano un cambio; el autor sale del token */
  createChange(payload: WorkoutChangeInput): Observable<WorkoutChangeResponse> {
    return this.http.post<WorkoutChangeResponse>(this.baseUrl, payload);
  }

  /** PUT /workout-changes/:id. Solo se puede editar el motivo (es un registro de auditoría) */
  updateReason(id: string, reason: string): Observable<WorkoutChangeResponse> {
    return this.http.put<WorkoutChangeResponse>(`${this.baseUrl}/${id}`, { reason });
  }

  /** POST /workout-changes/:id/revert. Solo ADMIN: devuelve la rutina a su valor anterior */
  revertChange(id: string): Observable<RevertResponse> {
    return this.http.post<RevertResponse>(`${this.baseUrl}/${id}/revert`, {});
  }

  /** DELETE /workout-changes/:id. Borrado lógico de la entrada */
  softDeleteChange(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /** DELETE /workout-changes/:id/hard. Borrado definitivo de la entrada */
  hardDeleteChange(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}/hard`);
  }
}
