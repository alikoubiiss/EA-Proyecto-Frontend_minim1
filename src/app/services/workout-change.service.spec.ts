import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../environments/environment';
import { WorkoutChangeService } from './workout-change.service';

describe('WorkoutChangeService', () => {
  let service: WorkoutChangeService;
  let httpMock: HttpTestingController;
  const url = `${environment.apiUrl}/workout-changes`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WorkoutChangeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getChanges() sends pagination, search and the combined filters, omitting the empty ones', () => {
    service
      .getChanges({ page: 2, limit: 10, search: 'name', action: 'UPDATE', reverted: 'false', from: '' })
      .subscribe();
    const req = httpMock.expectOne(`${url}?page=2&limit=10&search=name&action=UPDATE&reverted=false`);
    expect(req.request.method).toBe('GET');
    req.flush({ changes: [], pagination: {} });
  });

  it('getWorkoutHistory() asks for the history of one workout', () => {
    service.getWorkoutHistory('w1', { page: 1, limit: 5 }).subscribe();
    const req = httpMock.expectOne(`${url}/workout/w1?page=1&limit=5`);
    expect(req.request.method).toBe('GET');
    req.flush({ changes: [], pagination: {} });
  });

  it('createChange() posts the change without any author', () => {
    service
      .createChange({
        workout: 'w1',
        reason: 'nota',
        changes: [{ field: 'dayOfWeek', oldValue: 'MONDAY', newValue: 'TUESDAY' }],
      })
      .subscribe();
    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect('author' in req.request.body).toBe(false);
    req.flush({ change: {} });
  });

  it('updateReason() puts only the reason', () => {
    service.updateReason('c1', 'nuevo motivo').subscribe();
    const req = httpMock.expectOne(`${url}/c1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ reason: 'nuevo motivo' });
    req.flush({ change: {} });
  });

  it('revertChange() posts to the revert url', () => {
    service.revertChange('c1').subscribe();
    const req = httpMock.expectOne(`${url}/c1/revert`);
    expect(req.request.method).toBe('POST');
    req.flush({ change: {}, revertEntry: {}, workout: {} });
  });

  it('softDeleteChange() sends DELETE to the id url', () => {
    service.softDeleteChange('c1').subscribe();
    const req = httpMock.expectOne(`${url}/c1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('hardDeleteChange() sends DELETE to the /hard url', () => {
    service.hardDeleteChange('c1').subscribe();
    const req = httpMock.expectOne(`${url}/c1/hard`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
