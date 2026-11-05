import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { WorkoutChange } from '../../models';
import { WorkoutChangeForm } from './workout-change-form';

const base = `${environment.apiUrl}/workout-changes`;

describe('WorkoutChangeForm', () => {
  let fixture: ComponentFixture<WorkoutChangeForm>;
  let component: WorkoutChangeForm;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkoutChangeForm],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(WorkoutChangeForm);
    component = fixture.componentInstance;
  });

  afterEach(() => httpMock.verify());

  it('registers a manual change with the workout id and no author', async () => {
    fixture.componentRef.setInput('workoutId', 'w1');
    fixture.detectChanges();
    component.form.patchValue({
      field: 'name',
      oldText: 'Antes',
      newText: 'Después',
      reason: 'Renombrada',
    });

    let saved = 0;
    component.saved.subscribe(() => saved++);
    component.save();

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      workout: 'w1',
      reason: 'Renombrada',
      changes: [{ field: 'name', oldValue: 'Antes', newValue: 'Después' }],
    });
    req.flush({ change: {} });
    await fixture.whenStable();

    expect(saved).toBe(1);
  });

  it('does not send a change whose old and new values are equal', () => {
    fixture.componentRef.setInput('workoutId', 'w1');
    fixture.detectChanges();
    component.form.patchValue({ field: 'name', oldText: 'Igual', newText: 'Igual' });

    component.save();

    expect(component.error()).toContain('iguales');
  });

  it('editing only sends the reason of the existing entry', async () => {
    fixture.componentRef.setInput('change', {
      _id: 'c1',
      reason: 'Antiguo',
      changes: [],
    } as unknown as WorkoutChange);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.form.controls.reason.value).toBe('Antiguo');
    component.form.patchValue({ reason: 'Nuevo' });
    component.save();

    const req = httpMock.expectOne(`${base}/c1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ reason: 'Nuevo' });
    req.flush({ change: {} });
  });

  it('shows the error of the API when saving fails', () => {
    fixture.componentRef.setInput('workoutId', 'w1');
    fixture.detectChanges();
    component.form.patchValue({ field: 'dayOfWeek', oldDay: 'MONDAY', newDay: 'FRIDAY' });

    component.save();
    httpMock
      .expectOne(base)
      .flush({ message: 'La rutina no existe' }, { status: 404, statusText: 'Not Found' });

    expect(component.error()).toBe('La rutina no existe');
    expect(component.saving()).toBe(false);
  });
});
