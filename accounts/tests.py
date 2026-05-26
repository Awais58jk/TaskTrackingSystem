from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from work.models import ActivityLog


class AuthenticationApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register_logs_user_in_as_standard_user(self):
        response = self.client.post(
            "/api/auth/register",
            {
                "email": "new.user@example.com",
                "full_name": "New User",
                "password": "StrongPass123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["email"], "new.user@example.com")
        self.assertEqual(response.data["role"], "standard")

        me_response = self.client.get("/api/auth/me")
        self.assertEqual(me_response.status_code, 200)
        self.assertEqual(me_response.data["email"], "new.user@example.com")

    def test_login_rejects_bad_credentials(self):
        response = self.client.post(
            "/api/auth/login",
            {"email": "missing@example.com", "password": "WrongPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)


class UserRoleApiTests(TestCase):
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
        self.client = APIClient()

    def test_standard_user_cannot_change_roles(self):
        self.client.force_authenticate(self.member)
        response = self.client.patch(
            "/api/users",
            {"id": str(self.member.id), "role": "admin"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_admin_can_promote_standard_user(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            "/api/users",
            {"id": str(self.member.id), "role": "admin"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.member.refresh_from_db()
        self.assertEqual(self.member.role, "admin")
        self.assertTrue(
            ActivityLog.objects.filter(action=ActivityLog.Action.ROLE_CHANGED).exists()
        )
