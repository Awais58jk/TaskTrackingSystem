import os
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from work.models import ActivityLog, Project, Task


class Command(BaseCommand):
    help = "Create the first admin account and demo data for TaskFlow."

    def handle(self, *args, **options):
        User = get_user_model()
        admin_email = os.getenv("DJANGO_ADMIN_EMAIL")
        admin_password = os.getenv("DJANGO_ADMIN_PASSWORD")

        if not admin_email and settings.DEBUG:
            admin_email = "admin@taskflow.local"
            self.stdout.write(
                self.style.WARNING(
                    "DJANGO_ADMIN_EMAIL is not set; using admin@taskflow.local for local demo data."
                )
            )
        if not admin_password and settings.DEBUG:
            admin_password = "AdminPass123!"
            self.stdout.write(
                self.style.WARNING(
                    "DJANGO_ADMIN_PASSWORD is not set; using AdminPass123! for local demo data."
                )
            )
        if not admin_email or not admin_password:
            self.stdout.write(
                self.style.WARNING(
                    "Skipping seed data because DJANGO_ADMIN_EMAIL or DJANGO_ADMIN_PASSWORD is missing."
                )
            )
            return

        admin_user, created = User.objects.get_or_create(
            email=admin_email.lower(),
            defaults={
                "username": admin_email.split("@", 1)[0],
                "full_name": "TaskFlow Administrator",
                "role": User.Role.ADMIN,
                "is_superuser": True,
            },
        )
        admin_user.role = User.Role.ADMIN
        admin_user.is_superuser = True
        admin_user.set_password(admin_password)
        admin_user.save()

        member, _ = User.objects.get_or_create(
            email="member@taskflow.local",
            defaults={
                "username": "member",
                "full_name": "Ayesha Khan",
                "role": User.Role.STANDARD,
            },
        )
        if not member.has_usable_password():
            member.set_password("MemberPass123!")
            member.save()

        projects = [
            {
                "name": "Client Portal Launch",
                "description": "Customer-facing delivery portal for onboarding and status tracking.",
                "color": "#2563eb",
            },
            {
                "name": "Mobile App Refresh",
                "description": "Design and performance work for the mobile experience.",
                "color": "#0f766e",
            },
            {
                "name": "Operations Automation",
                "description": "Internal workflow automation for repeated project tasks.",
                "color": "#7c3aed",
            },
        ]

        project_objects = {}
        for item in projects:
            project, _ = Project.objects.get_or_create(
                name=item["name"],
                defaults={**item, "owner": admin_user},
            )
            project_objects[item["name"]] = project

        sample_tasks = [
            (
                "Client Portal Launch",
                "Map onboarding milestones",
                "Document the client journey, key states, and overdue handoffs.",
                2,
                Task.Priority.HIGH,
                Task.Status.IN_PROGRESS,
                admin_user,
            ),
            (
                "Client Portal Launch",
                "Build accessible task filters",
                "Ship keyboard-friendly filters for priority, status, project, and due date.",
                5,
                Task.Priority.URGENT,
                Task.Status.TODO,
                member,
            ),
            (
                "Mobile App Refresh",
                "Review mobile dashboard spacing",
                "Validate responsive breakpoints and touch target sizing.",
                7,
                Task.Priority.MEDIUM,
                Task.Status.BLOCKED,
                member,
            ),
            (
                "Operations Automation",
                "Prepare deployment checklist",
                "Document Render, Neon, environment variables, and post-deploy smoke tests.",
                10,
                Task.Priority.HIGH,
                Task.Status.TODO,
                admin_user,
            ),
            (
                "Operations Automation",
                "Seed initial project data",
                "Provide a realistic demo dataset for the assignment presentation.",
                -1,
                Task.Priority.LOW,
                Task.Status.DONE,
                admin_user,
            ),
        ]

        for project_name, title, description, days, priority, task_status, assignee in sample_tasks:
            Task.objects.get_or_create(
                title=title,
                project=project_objects[project_name],
                defaults={
                    "description": description,
                    "due_date": timezone.localdate() + timedelta(days=days),
                    "priority": priority,
                    "status": task_status,
                    "created_by": admin_user,
                    "assigned_to": assignee,
                },
            )

        if created:
            ActivityLog.objects.create(
                actor=admin_user,
                action=ActivityLog.Action.CREATED,
                entity_type="user",
                entity_id=str(admin_user.id),
                message="Initial administrator account was created",
            )

        self.stdout.write(self.style.SUCCESS("TaskFlow seed data is ready."))
