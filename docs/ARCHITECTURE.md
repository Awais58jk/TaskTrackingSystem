# TaskFlow Architecture

## Runtime Topology

```text
User Browser
   |
   v
Render Web Service
   |
   |-- React static build served by Django + WhiteNoise
   |-- Django REST API
   |-- Django session authentication and role permissions
   |-- Server-Sent Events activity stream
   |
   v
Neon PostgreSQL Free Database
```

## Backend Boundaries

- `accounts` owns users, registration, login/logout, session state, CSRF bootstrap, and role changes.
- `work` owns projects, tasks, activity logs, filtering, admin-only mutations, and the live activity stream.
- `config` owns deployment settings, ASGI/WSGI entrypoints, and the React SPA catch-all route.

## Security Model

- Browser clients authenticate through Django sessions.
- React never stores access tokens.
- Unsafe API methods send `X-CSRFToken`.
- Admin-only API operations use the `admin` role or superuser status.
- Role changes and data mutations are written to `ActivityLog`.

## Free Infrastructure Choice

Render hosts the web service because the assignment requires a Render link. Neon stores production PostgreSQL data because Render free PostgreSQL is not suitable for longer-lived coursework submissions.
