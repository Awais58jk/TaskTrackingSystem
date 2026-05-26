import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Project(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=140)
    description = models.TextField(blank=True)
    color = models.CharField(max_length=7, default="#2563eb")
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="owned_projects",
    )
    is_archived = models.BooleanField(default=False)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["is_archived"]),
            models.Index(fields=["owner"]),
        ]

    def __str__(self) -> str:
        return self.name


class Task(TimeStampedModel):
    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        URGENT = "urgent", "Urgent"

    class Status(models.TextChoices):
        TODO = "todo", "To Do"
        IN_PROGRESS = "in_progress", "In Progress"
        BLOCKED = "blocked", "Blocked"
        DONE = "done", "Completed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.PROTECT, related_name="tasks")
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    due_date = models.DateField()
    priority = models.CharField(
        max_length=16,
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )
    status = models.CharField(
        max_length=24,
        choices=Status.choices,
        default=Status.TODO,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_tasks",
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="assigned_tasks",
        blank=True,
        null=True,
    )

    class Meta:
        ordering = ["due_date", "-created_at"]
        indexes = [
            models.Index(fields=["project"]),
            models.Index(fields=["status"]),
            models.Index(fields=["priority"]),
            models.Index(fields=["due_date"]),
            models.Index(fields=["created_by"]),
            models.Index(fields=["assigned_to"]),
        ]

    @property
    def is_overdue(self) -> bool:
        return self.status != self.Status.DONE and self.due_date < timezone.localdate()

    def __str__(self) -> str:
        return self.title


class ActivityLog(models.Model):
    class Action(models.TextChoices):
        CREATED = "created", "Created"
        UPDATED = "updated", "Updated"
        DELETED = "deleted", "Deleted"
        ARCHIVED = "archived", "Archived"
        ROLE_CHANGED = "role_changed", "Role Changed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="activity_logs",
        null=True,
    )
    action = models.CharField(max_length=32, choices=Action.choices)
    entity_type = models.CharField(max_length=60)
    entity_id = models.CharField(max_length=64)
    message = models.CharField(max_length=255)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["created_at"]),
            models.Index(fields=["entity_type", "entity_id"]),
        ]

    def __str__(self) -> str:
        return self.message
