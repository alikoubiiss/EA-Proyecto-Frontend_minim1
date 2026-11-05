# EA-Proyecto-Frontend

Backoffice en Angular de la API [EA-Proyecto-Backend](https://github.com/NASM-EA/EA-Proyecto-Backend):
usuarios, ejercicios y rutinas, más un chat en tiempo real. Todo salvo el login y el registro pide
sesión, y las pantallas de gestión son solo para `ADMIN`.

## Instalar las dependencias

```
npm install
```

Hace falta el backend arrancado con su MongoDB (ver su README: `npm install`, `cp .env.example .env`,
`npm run seed` y `npm run dev`).

El frontend no usa `.env`: lo que llega al navegador lo puede leer cualquiera, así que aquí no hay
secretos. Toda la configuración está en **un** fichero, y para cambiar la dirección de la API o del chat
se toca aquí y en ningún sitio más:

```
// src/environments/environment.ts
export const environment = {
  apiUrl: 'http://localhost:1337',    // llamadas HTTP
  socketUrl: 'http://localhost:1337', // conexión del chat
};
```

## Ejecutar

Mientras programas, arranca Angular en modo desarrollo; se recarga solo cada vez que guardas un archivo:

```
npm start
```

Queda en <http://localhost:4200>. Para entrar hace falta una cuenta `ADMIN`: con los datos del seed del
backend es `admin@example.com` / `seminari7`. "Registrarse" crea cuentas `USER` y **no** inicia sesión,
y el login del backoffice responde 403 si el usuario no es `ADMIN`.

Para pasar los tests, el linter y compilar la versión de producción:

```
npm test
npm run lint
npm run build
```

`npm test` pasa los tests con Vitest y se queda esperando cambios (`npm test -- --watch=false` para
pasarlos una vez). `npm run build` compila en `dist/`, y `npm run watch` recompila al guardar sin
levantar el servidor de desarrollo.

## Pantallas

Todo salvo `/login` y `/register` pide sesión, y las pantallas de gestión piden además rol `ADMIN`.

| Ruta                  | Pantalla         | Quién puede     | Qué hace                                                                                                                   |
| --------------------- | ---------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `/login`              | Iniciar sesión   | solo sin sesión | Pide email y contraseña a `POST /auth/admin/login` y guarda los dos tokens y el usuario                                    |
| `/register`           | Crear cuenta     | solo sin sesión | Da de alta un usuario `USER` (`POST /auth/register`), sin token, y vuelve al login con un aviso                            |
| `/`                   | Inicio           | con sesión      | Saludo, email y rol; accesos al backoffice si es `ADMIN`                                                                   |
| `/exercises`          | Ejercicios       | `ADMIN`         | Lista paginada: buscador por nombre, filtro por categoría, orden por columna, casillas para borrar varios, editar y borrar |
| `/exercises/new`      | Nuevo ejercicio  | `ADMIN`         | `name`, `category`, `sets` y `reps`                                                                                        |
| `/exercises/:id/edit` | Editar ejercicio | `ADMIN`         | Lo mismo, con los datos cargados                                                                                           |
| `/workouts`           | Rutinas          | `ADMIN`         | Lista paginada: buscador por nombre o descripción, filtro por día, orden por columna, borrado simple y múltiple            |
| `/workouts/new`       | Nueva rutina     | `ADMIN`         | `name`, `dayOfWeek`, `description` y `exercises` (multiselección)                                                          |
| `/workouts/:id/edit`  | Editar rutina    | `ADMIN`         | Lo mismo, con los datos cargados y, debajo, el historial de cambios de la rutina                                           |
| `/users`              | Usuarios         | `ADMIN`         | Lista paginada de `_id` y `name`: buscador, orden por nombre, borrado simple y múltiple                                    |
| `/users/new`          | Nuevo usuario    | `ADMIN`         | `name`, `email`, `password` y `role`                                                                                       |
| `/users/:id/edit`     | Editar usuario   | `ADMIN`         | Lo mismo; la contraseña solo se envía si se escribe                                                                        |
| `/workout-changes`    | Historial        | con sesión      | Historial de cambios de todas las rutinas (`?workoutId=` filtra por una). Revertir es solo de `ADMIN`                      |
| `/chat`               | Chat             | con sesión      | Salas general, de grupo y directa, con el historial y la lista de usuarios                                                 |
| cualquier otra        | —                | —               | Vuelve a `/` (o al login, si no hay sesión)                                                                                |

### Quién ve qué

Los guards y el esconder botones son solo comodidad: desde las herramientas del navegador se puede
saltar un guard. Quien protege los datos es el backend, que comprueba el token y el rol en cada
petición: sale 401 si no hay sesión y 403 si el rol no llega.

- **`ADMIN`**: ve todo, también los elementos borrados, que salen marcados y sin botón "Editar".
- **Cualquier otra sesión**: la API solo le devuelve los elementos activos. Un elemento borrado no
  aparece en los listados y su detalle responde 404.

### Borrar tiene dos formas

El mismo modal ofrece las dos, y cada una va a una petición distinta de la API:

- **Borrado lógico**: la API marca `isDeleted` y el documento sigue en MongoDB. Con las casillas se
  borran varios a la vez (la petición `DELETE` lleva los ids en el cuerpo y devuelve cuántos se
  borraron).
- **Borrado definitivo**: la API lo saca de la base de datos para siempre. En los ejercicios, además,
  los quita de las rutinas que los tuvieran.

### Lo que la API espera

- Editar es un `PUT` y la API pide el cuerpo completo. Un campo opcional que se deja vacío no se borra:
  el formulario no lo envía y la API deja el valor que tenía.
- Un filtro vacío (`category=`, `search=`) hace que la API responda 422, así que los parámetros vacíos
  no se envían.
- Los mensajes de validación (422) vienen en inglés, de Joi, y se enseñan tal cual en la pantalla.

## Sesión y token

Los tokens se guardan en `localStorage` (claves `token`, `refreshToken` y `user`) porque la API los
devuelve en el JSON del login. Su riesgo es **XSS**: un script en la página puede leerlos. Una cookie
HttpOnly lo evita, pero obliga a cambiar el backend y a protegerse de **CSRF**.

El access token dura 15 minutos. Cuando la API responde 401 con "El token ha caducado", el interceptor
pide uno nuevo a `POST /auth/refresh` y repite la petición, sin que el usuario lo note. Si el refresh
token también venció (a los 7 días), cierra la sesión y lleva al login. Cómo funciona por dentro, en el
[apartado 13 de la GUIA](GUIA.md#13-autenticación-interceptor-y-guards).

## Historial de cambios y reversión (Ejercicio tipo 3)

### Justificación de la entidad relacionada
La interfaz implementa el registro de auditoría y reversión para la entidad **`Workout` (rutina)**. Se ha elegido porque sus modificaciones y borrados lógicos disponen de estados reversibles y varios tipos de datos visualizables (ejercicios, días de la semana, descripción).

### Elementos implementados
- **Modelos TypeScript** ([workout-change.model.ts](src/app/models/workout-change.model.ts)): Tipado de `WorkoutChange`, el subdocumento `FieldChange` (campo, valores anterior/nuevo, fecha), la respuesta paginada `WorkoutChangesPage` y los parámetros de filtrado `WorkoutChangeListParams`. Reexportados en `models/index.ts`.
- **Servicio Angular** ([workout-change.service.ts](src/app/services/workout-change.service.ts)): Centraliza todas las llamadas HTTP a `/workout-changes`: listado paginado con filtros (`getChanges`), historial por rutina (`getWorkoutHistory`), detalle (`getChange`), alta manual (`createChange`), actualización de motivo (`updateReason`), reversión (`revertChange`) y borrado lógico/definitivo (`softDeleteChange`, `hardDeleteChange`).
- **Componentes standalone**:
  - `WorkoutChangesList`: Componente de tabla con **paginación y búsqueda en servidor** (5 elementos por página), filtros combinables (texto, acción, revertido, rango de fechas `from`/`to`) y modales de confirmación para reversión y borrado. Formatea valores para mostrar texto legible (p. ej. `X ejercicios`, días traducidos, `Sí/No`).
  - `WorkoutChangeForm`: Formulario para registrar un cambio manual sobre una rutina o actualizar el motivo de una entrada existente.
- **Integración en vistas existentes**:
  - En **Editar rutina** (`/workouts/:id/edit`): Se incrusta el historial de la rutina al pie de página. Al revertir un cambio, se emite un evento `workoutReverted` que recarga automáticamente la rutina en el formulario sin refrescar el navegador.
  - En **Página general** (`/workout-changes`): Vista global del historial con soporte para filtrar por `?workoutId=...`.
- **Seguridad, JWT y Roles**:
  - La ruta `/workout-changes` está protegida con `authGuard`.
  - El token JWT y su refresco son gestionados de forma transparente por el `authInterceptor` existente.
  - Los botones de acción se adaptan al rol: **Revertir** solo es visible para usuarios con rol `ADMIN`; **Motivo** y **Borrar** están disponibles para el autor del registro o administradores. Si el backend rechaza una operación (por ejemplo con 409 Conflict), el mensaje de error se visualiza de forma destacada sobre la tabla.

## Estructura del proyecto

```
src/
  main.ts                  Punto de entrada: arranca Angular sobre <app-root> de index.html
  styles.css               Estilos globales
  environments/
    environment.ts         La única configuración: la URL de la API y la del chat
  app/
    app.config.ts          Providers de toda la app: router y HttpClient (con el interceptor)
    app.routes.ts          El mapa de rutas: qué URL pinta qué componente y con qué guards
    app.ts, app.html       Componente raíz: la barra de navegación y el <router-outlet>
    components/
      navbar/              Menú de arriba: enlaces según el rol, usuario con sesión y cerrar sesión
      login/               Iniciar sesión
      register/            Crear una cuenta
      home/                Página de inicio para cualquier usuario con sesión
      exercises-list/      Lista de ejercicios: buscador, filtro, orden, paginación y borrado múltiple
      exercise-form/       Crear y editar ejercicios
      workouts-list/       Lista de rutinas: buscador, filtro por día, orden, paginación y borrado múltiple
      workout-form/        Crear y editar rutinas (con el historial de cambios integrado al editar)
      workout-changes-list/ Historial de cambios de las rutinas: paginación, buscador, filtros y revertir
      workout-change-form/ Registrar un cambio a mano y editar el motivo de una entrada
      users-list/          Lista de usuarios: buscador, orden, paginación y borrado múltiple
      user-form/           Crear y editar usuarios
      chat/                Chat en tiempo real: sala general, de grupo y directa
      pagination/          Paginación, componente hijo de las tres listas
      delete-modal/        Ventana con las dos formas de borrar: lógica o definitiva
      confirm-modal/       Ventana para confirmar antes de guardar un formulario
    models/                Interfaces de TypeScript con la forma de los datos de la API
      page.model.ts          ListParams, PageInfo, SortOrder y BulkDeleteResponse
      user.model.ts          User, UserSummary, UserInput y las peticiones y respuestas de /auth
      exercise.model.ts      Exercise, ExerciseInput, EXERCISE_CATEGORIES y sus etiquetas
      workout.model.ts       Workout, WorkoutInput, DAYS_OF_WEEK y sus etiquetas
      workout-change.model.ts WorkoutChange, FieldChange (subdocumento), la página y los filtros del historial
      index.ts               Reexporta todo: import { ... } from '../../models'
    services/              Las únicas piezas que hablan con la API
      auth.service.ts        register, login, refresh, logout y el usuario con sesión (signal)
      user.service.ts        getUsers, getUser, create, update, softDelete y hardDelete (suelto y en bloque)
      exercise.service.ts    Lo mismo para /exercises
      workout.service.ts     Lo mismo para /workouts
      workout-change.service.ts Todas las peticiones de /workout-changes: lista, historial de una rutina, alta, motivo, revertir y borrado
      chat.service.ts        Conecta socket.io, entra en una sala y manda y recibe mensajes
    guards/
      auth.guard.ts          authGuard, adminGuard y guestGuard: quién puede entrar en cada ruta
    interceptors/
      auth.interceptor.ts    Añade el token a cada petición y lo renueva si ha caducado
    pipes/
      truncate-pipe.ts       Corta los textos largos con "..."
    utils/
      api-error.ts           Pasa un error de HttpClient a un texto para la pantalla
      list-params.ts         Construye ?page=&search=... sin los valores vacíos, que la API rechaza (422)
      password-match.ts      Validador: la contraseña y su repetición coinciden
      remove-empty.ts        Quita los campos vacíos antes de enviar un formulario
```

Un dato viaja siempre por el mismo camino, igual que en el backend cada capa hace una sola cosa:

```
componente -> service (HttpClient) -> API -> respuesta -> subscribe -> signal -> la plantilla se repinta
```

Los componentes no saben de URLs ni de HTTP: piden los datos al service y guardan el resultado en una
signal. Tampoco saben del token ni de la sesión: el token lo pone el interceptor y la sesión vive en
`AuthService`.
