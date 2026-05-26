# TaskFlow

TaskFlow is a full-stack project and task management platform for small teams. It satisfies the assignment requirements with authentication, role-based access, project-categorized tasks, CRUD workflows, responsive UI, database-backed persistence, tests, and a Render-ready deployment path.

## Stack

- React 19 + Vite + TypeScript + Tailwind CSS
- Django 5.2 LTS + Django REST Framework
- Django session authentication with CSRF protection
- PostgreSQL via Neon for production, SQLite for local development
- WhiteNoise static file serving on Render

## Roles

- Standard users can register, log in, view all projects/tasks, and create new tasks.
- Admin users can create/update/archive projects, update/delete tasks, manage user roles, and review activity logs.

## Local Setup

```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt

cd frontend
npm install
npm run build
cd ..

python manage.py migrate
python manage.py seed_initial_data
python manage.py runserver
```

For frontend development, run Django on port `8000` and Vite in another terminal:

```bash
cd frontend
npm run dev
```

Local demo credentials are created only when `DEBUG=True` and admin env vars are missing:

- Admin: `admin@taskflow.local` / `AdminPass123!`
- Standard user: `member@taskflow.local` / `MemberPass123!`

## Render Deployment

Create a free Neon PostgreSQL database and copy its pooled connection string into Render as `DATABASE_URL`.

Set these Render environment variables:

- `DATABASE_URL`
- `SECRET_KEY`
- `DEBUG=False`
- `ALLOWED_HOSTS=.onrender.com`
- `CSRF_TRUSTED_ORIGINS=https://YOUR-RENDER-SERVICE.onrender.com`
- `DJANGO_ADMIN_EMAIL`
- `DJANGO_ADMIN_PASSWORD`

Render commands:

- Build command: `./build.sh`
- Pre-deploy command: `python manage.py migrate && python manage.py seed_initial_data`
- Start command: `python -m gunicorn config.asgi:application -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT`

## Testing

```bash
python manage.py test
cd frontend
npm run build
npm run test
```

## Assignment Evidence

- GitHub repository: submit the repository URL.
- Live deployment: submit the Render service URL.
- Database: Neon PostgreSQL free tier.
- Security: HttpOnly session cookie, CSRF token on unsafe API methods, role checks on admin routes, and audit logs.
- Accessibility: semantic layout, keyboard focus states, labeled forms, responsive navigation, and status text for live updates.
