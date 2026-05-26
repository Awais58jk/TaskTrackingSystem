from django.contrib import admin

from .models import ActivityLog, Project, Task


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "is_archived", "created_at")
    list_filter = ("is_archived",)
    search_fields = ("name", "description", "owner__email")


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("title", "project", "priority", "status", "due_date", "assigned_to")
    list_filter = ("priority", "status", "project")
    search_fields = ("title", "description", "project__name")
    date_hierarchy = "due_date"


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("message", "actor", "action", "entity_type", "created_at")
    list_filter = ("action", "entity_type")
    search_fields = ("message", "actor__email")
    readonly_fields = ("actor", "action", "entity_type", "entity_id", "metadata", "created_at")

# Register your models here.
