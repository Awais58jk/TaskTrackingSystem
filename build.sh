#!/usr/bin/env bash
set -o errexit

python -m pip install --upgrade pip
pip install -r requirements.txt

cd frontend
npm ci
npm run build
cd ..

python manage.py collectstatic --no-input
