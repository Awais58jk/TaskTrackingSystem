from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class TaskFlowUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("TaskFlow profile", {"fields": ("full_name", "role")}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("TaskFlow profile", {"fields": ("email", "full_name", "role")}),
    )
    list_display = ("email", "full_name", "role", "is_staff", "is_active")
    list_filter = ("role", "is_staff", "is_active")
    search_fields = ("email", "full_name", "username")
    ordering = ("email",)

# Register your models here.
