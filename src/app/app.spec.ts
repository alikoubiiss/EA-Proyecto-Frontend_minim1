import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';

describe('App', () => {
  // AuthService lee la sesión de localStorage al crearse: empiezo cada test sin sesión
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  async function navLinks(): Promise<(string | undefined)[]> {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    return Array.from(compiled.querySelectorAll('nav a')).map((a) => a.textContent?.trim());
  }

  it('should create the app', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
    expect(TestBed.createComponent(App).componentInstance).toBeTruthy();
  });

  it('without a session the navigation bar offers login and register', async () => {
    expect(await navLinks()).toEqual(['Iniciar sesión', 'Registrarse']);
  });

  it('an admin sees the backoffice links, the change history and chat', async () => {
    localStorage.setItem(
      'user',
      JSON.stringify({ _id: 'u1', name: 'Admin', email: 'admin@example.com', role: 'ADMIN' }),
    );
    expect(await navLinks()).toEqual(['Ejercicios', 'Rutinas', 'Usuarios', 'Historial', 'Chat']);
  });

  it('a user sees the change history and chat but not the backoffice links', async () => {
    localStorage.setItem(
      'user',
      JSON.stringify({ _id: 'u2', name: 'Usuario', email: 'user@example.com', role: 'USER' }),
    );
    expect(await navLinks()).toEqual(['Historial', 'Chat']);
  });
});
