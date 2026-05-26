from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import ActivityLog, Project, Task


class WorkApiPermissionTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(
            email="admin@example.com",
            username="admin",
            password="AdminPass123!",
            full_name="Admin User",
            role=User.Role.ADMIN,
        )
        self.member = User.objects.create_user(
            email="member@example.com",
            username="member",
            password="MemberPass123!",
            full_name="Member User",
        )
        self.project = Project.objects.create(
            name="Client Portal",
            description="Launch work",
            color="#2563eb",
            owner=self.admin,
        )
        self.task = Task.objects.create(
            project=self.project,
            title="Existing task",
            description="Baseline task",
            due_date=timezone.localdate() + timedelta(days=3),
            priority=Task.Priority.HIGH,
            status=Task.Status.TODO,
            created_by=self.admin,
            assigned_to=self.member,
        )
        self.client = APIClient()

    def task_payload(self):
        return {
            "project_id": str(self.project.id),
            "title": "New standard task",
            "description": "Created by a standard user",
            "due_date": (timezone.localdate() + timedelta(days=5)).isoformat(),
            "priority": "medium",
            "status": "todo",
            "assigned_to_id": str(self.member.id),
        }

    def test_standard_user_can_view_and_create_tasks(self):
        self.client.force_authenticate(self.member)

        list_response = self.client.get("/api/tasks")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.data), 1)

        create_response = self.client.post("/api/tasks", self.task_payload(), format="json")
        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(create_response.data["created_by"]["email"], self.member.email)

    def test_standard_user_cannot_update_or_delete_tasks(self):
        self.client.force_authenticate(self.member)

        patch_response = self.client.patch(
            f"/api/tasks/{self.task.id}",
            {"status": "done"},
            format="json",
        )
        delete_response = self.client.delete(f"/api/tasks/{self.task.id}")

        self.assertEqual(patch_response.status_code, 403)
        self.assertEqual(delete_response.status_code, 403)

    def test_admin_can_update_and_delete_tasks(self):
        self.client.force_authenticate(self.admin)

        patch_response = self.client.patch(
            f"/api/tasks/{self.task.id}",
            {"status": "done"},
            format="json",
        )
        self.assertEqual(patch_response.status_code, 200)
        self.assertEqual(patch_response.data["status"], "done")

        delete_response = self.client.delete(f"/api/tasks/{self.task.id}")
        self.assertEqual(delete_response.status_code, 204)
        self.assertFalse(Task.objects.filter(id=self.task.id).exists())
        self.assertTrue(ActivityLog.objects.filter(action=ActivityLog.Action.DELETED).exists())

    def test_admin_can_create_and_archive_projects(self):
        self.client.force_authenticate(self.admin)

        create_response = self.client.post(
            "/api/projects",
            {
                "name": "Automation",
                "description": "Internal process improvements",
                "color": "#0f766e",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)

        archive_response = self.client.delete(
            f"/api/projects/{create_response.data['id']}"
        )
        self.assertEqual(archive_response.status_code, 204)
        project = Project.objects.get(id=create_response.data["id"])
        self.assertTrue(project.is_archived)
