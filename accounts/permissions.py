from rest_framework.permissions import BasePermission


class IsPlatformAdmin(BasePermission):
    message = "You need an administrator role to perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_platform_admin
        )
