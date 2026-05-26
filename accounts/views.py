from django.contrib.auth import login, logout
from django.shortcuts import get_object_or_404
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from work.models import ActivityLog

from .models import User
from .permissions import IsPlatformAdmin
from .serializers import (
    LoginSerializer,
    RegisterSerializer,
    UserRoleSerializer,
    UserSerializer,
)


class CsrfView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        return Response({"csrfToken": get_token(request)})


@method_decorator(csrf_protect, name="dispatch")
class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        login(request, user)
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        login(request, user)
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class UsersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        users = User.objects.order_by("full_name", "email")
        return Response(UserSerializer(users, many=True).data)

    def patch(self, request):
        permission = IsPlatformAdmin()
        if not permission.has_permission(request, self):
            return Response(
                {"detail": permission.message},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = UserRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target = get_object_or_404(User, id=serializer.validated_data["id"])
        new_role = serializer.validated_data["role"]

        if target.role == User.Role.ADMIN and new_role != User.Role.ADMIN:
            remaining_admins = User.objects.filter(role=User.Role.ADMIN).exclude(
                id=target.id
            )
            if not remaining_admins.exists():
                return Response(
                    {"role": ["At least one administrator must remain."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        old_role = target.role
        target.role = new_role
        target.save(update_fields=["role", "is_staff", "updated_at"])
        ActivityLog.objects.create(
            actor=request.user,
            action=ActivityLog.Action.ROLE_CHANGED,
            entity_type="user",
            entity_id=str(target.id),
            message=f"{target.email} role changed from {old_role} to {new_role}",
            metadata={"old_role": old_role, "new_role": new_role},
        )
        return Response(UserSerializer(target).data)
