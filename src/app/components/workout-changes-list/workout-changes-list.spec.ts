import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../environments/environment';
import { WorkoutChange } from '../../models';
import { WorkoutChangesList } from './workout-changes-list';

const base = `${environment.apiUrl}/workout-changes`;

const change = (overrides: Partial<WorkoutChange> = {}): WorkoutChange => ({
  _id: 'c1',
  workout: { _id: 'w1', name: 'Día de pecho', dayOfWeek: 'MONDAY' },
  author: { _id: 'u1', name: 'Admin', email: 'admin@example.com' },
  action: 'UPDATE',
  changes: [
    {
      field: 'dayOfWeek',
      order: 0,
      oldValue: 'MONDAY',
      newValue: 'TUESDAY',
      changedAt: '2026-11-05T10:00:00.000Z',
    },
  ],
  reverted: false,
  isDeleted: false,
  createdAt: '2026-11-05T10:00:00.000Z',
  ...overrides,
});

const page = (changes: WorkoutChange[], pageNumber = 1, totalPages = 3) => ({
  changes,
  pagination: {
    page: pageNumber,
    limit: 5,
    total: 12,
    totalPages,
    hasNextPage: pageNumber < totalPages,
    hasPrevPage: pageNumber > 1,
  },
});

describe('WorkoutChangesList', () => {
  let fixture: ComponentFixture<WorkoutChangesList>;
  let component: WorkoutChangesList;
  let httpMock: HttpTestingController;

  // El rol sale de la sesión guardada: la preparo antes de crear el componente
  async function setup(role: 'ADMIN' | 'USER', workoutId?: string) {
    localStorage.setItem(
      'user',
      JSON.stringify({ _id: 'u1', name: 'Alguien', email: 'a@b.c', role }),
    );

    await TestBed.configureTestingModule({
      imports: [WorkoutChangesList],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(WorkoutChangesList);
    component = fixture.componentInstance;
    if (workoutId) {
      fixture.componentRef.setInput('workoutId', workoutId);
    }
    fixture.detectChanges();
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('asks the server for the first page of the history of one workout', async () => {
    await setup('ADMIN', 'w1');
    httpMock.expectOne(`${base}/workout/w1?page=1&limit=5`).flush(page([change()], 1, 3));
    await fixture.whenStable();

    expect(component.changes().length).toBe(1);
    expect(component.totalPages()).toBe(3);
  });

  it('without a workout it asks for the whole history', async () => {
    await setup('ADMIN');
    httpMock.expectOne(`${base}?page=1&limit=5`).flush(page([]));
    await fixture.whenStable();

    expect(component.changes()).toEqual([]);
  });

  it('sends the search and the combined filters to the server', async () => {
    await setup('ADMIN');
    httpMock.expectOne(`${base}?page=1&limit=5`).flush(page([]));

    component.search.set('dayOfWeek');
    component.action.set('UPDATE');
    component.reverted.set('false');
    component.loadPage(1);
    httpMock
      .expectOne(`${base}?page=1&limit=5&search=dayOfWeek&action=UPDATE&reverted=false`)
      .flush(page([]));
    await fixture.whenStable();
  });

  it('requests the selected page', async () => {
    await setup('ADMIN');
    httpMock.expectOne(`${base}?page=1&limit=5`).flush(page([change()]));

    component.loadPage(2);
    httpMock.expectOne(`${base}?page=2&limit=5`).flush(page([change()], 2));
    await fixture.whenStable();

    expect(component.page()).toBe(2);
  });

  it('shows the API error message', async () => {
    await setup('ADMIN', 'w1');
    httpMock
      .expectOne(`${base}/workout/w1?page=1&limit=5`)
      .flush({ message: 'not found' }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    expect(component.error()).toBe('not found');
  });

  it('only an admin can revert, and only a change that is still active and not reverted', async () => {
    await setup('ADMIN');
    httpMock.expectOne(`${base}?page=1&limit=5`).flush(page([]));

    expect(component.canRevert(change())).toBe(true);
    expect(component.canRevert(change({ reverted: true }))).toBe(false);
    expect(component.canRevert(change({ isDeleted: true }))).toBe(false);
    expect(component.canRevert(change({ workout: null }))).toBe(false);
  });

  it('a user cannot revert and can only manage their own changes', async () => {
    await setup('USER');
    httpMock.expectOne(`${base}?page=1&limit=5`).flush(page([]));

    expect(component.canRevert(change())).toBe(false);
    expect(component.canManage(change())).toBe(true);
    expect(
      component.canManage(change({ author: { _id: 'u2', name: 'Otro', email: 'o@b.c' } })),
    ).toBe(false);
  });

  it('confirming the revert posts to the revert url, reloads the page and tells the parent', async () => {
    await setup('ADMIN', 'w1');
    httpMock.expectOne(`${base}/workout/w1?page=1&limit=5`).flush(page([change()]));

    let reverted = 0;
    component.workoutReverted.subscribe(() => reverted++);

    component.askRevert(change());
    component.confirmRevert();
    const req = httpMock.expectOne(`${base}/c1/revert`);
    expect(req.request.method).toBe('POST');
    req.flush({ change: {}, revertEntry: {}, workout: {} });

    httpMock.expectOne(`${base}/workout/w1?page=1&limit=5`).flush(page([]));
    await fixture.whenStable();

    expect(reverted).toBe(1);
    expect(component.notice()).toContain('revertido');
  });

  it('shows the 409 message when the revert is not possible', async () => {
    await setup('ADMIN', 'w1');
    httpMock.expectOne(`${base}/workout/w1?page=1&limit=5`).flush(page([change()]));

    component.askRevert(change());
    component.confirmRevert();
    httpMock
      .expectOne(`${base}/c1/revert`)
      .flush(
        { message: 'Este cambio ya ha sido revertido' },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();

    expect(component.error()).toBe('Este cambio ya ha sido revertido');
  });

  it('formats the values of each field in a readable way', async () => {
    await setup('ADMIN');
    httpMock.expectOne(`${base}?page=1&limit=5`).flush(page([]));
    const [dayChange] = change().changes;

    expect(component.formatValue(dayChange, 'oldValue')).toBe('Lunes');
    expect(
      component.formatValue({ ...dayChange, field: 'isDeleted', newValue: true }, 'newValue'),
    ).toBe('Sí');
    expect(
      component.formatValue({ ...dayChange, field: 'exercises', newValue: ['a', 'b'] }, 'newValue'),
    ).toBe('2 ejercicios');
    expect(
      component.formatValue({ ...dayChange, field: 'description', newValue: '' }, 'newValue'),
    ).toBe('(vacío)');
  });
});
