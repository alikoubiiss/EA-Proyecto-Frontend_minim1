import { Routes } from '@angular/router';

import { Chat } from './components/chat/chat';
import { ExerciseForm } from './components/exercise-form/exercise-form';
import { ExercisesList } from './components/exercises-list/exercises-list';
import { Home } from './components/home/home';
import { Login } from './components/login/login';
import { Register } from './components/register/register';
import { UserForm } from './components/user-form/user-form';
import { UsersList } from './components/users-list/users-list';
import { WorkoutChangesList } from './components/workout-changes-list/workout-changes-list';
import { WorkoutForm } from './components/workout-form/workout-form';
import { WorkoutsList } from './components/workouts-list/workouts-list';
import { adminGuard, authGuard, guestGuard } from './guards/auth.guard';

// canActivate: los guards que se comprueban, en orden, antes de entrar en la ruta.
//   guestGuard            solo sin sesión (login y registro)
//   authGuard             solo con sesión; si no, al login
//   authGuard, adminGuard con sesión y además rol ADMIN; un USER vuelve a la página de inicio
const admin = [authGuard, adminGuard];

export const routes: Routes = [
  { path: '', component: Home, canActivate: [authGuard], title: 'Inicio' },
  { path: 'login', component: Login, canActivate: [guestGuard], title: 'Iniciar sesión' },
  { path: 'register', component: Register, canActivate: [guestGuard], title: 'Crear cuenta' },

  { path: 'exercises', component: ExercisesList, canActivate: admin, title: 'Ejercicios' },
  { path: 'exercises/new', component: ExerciseForm, canActivate: admin, title: 'Nuevo ejercicio' },
  {
    path: 'exercises/:id/edit',
    component: ExerciseForm,
    canActivate: admin,
    title: 'Editar ejercicio',
  },

  { path: 'workouts', component: WorkoutsList, canActivate: admin, title: 'Rutinas' },
  { path: 'workouts/new', component: WorkoutForm, canActivate: admin, title: 'Nueva rutina' },
  {
    path: 'workouts/:id/edit',
    component: WorkoutForm,
    canActivate: admin,
    title: 'Editar rutina',
  },

  // Historial de cambios de las rutinas (auditoría). Pide sesión; qué botones se ven depende del rol:
  // revertir es solo de ADMIN y editar/borrar, del autor o un ADMIN. ?workoutId= filtra por una rutina
  {
    path: 'workout-changes',
    component: WorkoutChangesList,
    canActivate: [authGuard],
    title: 'Historial de cambios',
  },

  { path: 'users', component: UsersList, canActivate: admin, title: 'Usuarios' },
  { path: 'users/new', component: UserForm, canActivate: admin, title: 'Nuevo usuario' },
  { path: 'users/:id/edit', component: UserForm, canActivate: admin, title: 'Editar usuario' },

  { path: 'chat', component: Chat, canActivate: [authGuard], title: 'Chat' },

  // Cualquier otra URL vuelve a la página de inicio (o al login, si no hay sesión)
  { path: '**', redirectTo: '' },
];
