from rest_framework import serializers

from accounts.models import User
from accounts.serializers import PublicUserSerializer

from .models import ActivityLog, Project, Task


class ProjectSerializer(serializers.ModelSerializer):
    owner = PublicUserSerializer(read_only=True)
    task_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "description",
            "color",
            "owner",
            "task_count",
            "is_archived",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "owner", "task_count", "created_at", "updated_at"]

    def validate_color(self, value: str) -> str:
        if not value.startswith("#") or len(value) != 7:
            raise serializers.ValidationError("Use a hex color such as #2563eb.")
        return value


class ProjectSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ["id", "name", "color"]


class TaskSerializer(serializers.ModelSerializer):
    project = ProjectSummarySerializer(read_only=True)
    project_id = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.filter(is_archived=False),
        source="project",
        write_only=True,
    )
    created_by = PublicUserSerializer(read_only=True)
    assigned_to = PublicUserSerializer(read_only=True)
    assigned_to_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True),
        source="assigned_to",
        write_only=True,
        allow_null=True,
        required=False,
    )
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Task
        fields = [
            "id",
            "project",
            "project_id",
            "title",
            "description",
            "due_date",
            "priority",
            "status",
            "created_by",
            "assigned_to",
            "assigned_to_id",
            "is_overdue",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]

    def validate_title(self, value: str) -> str:
        title = value.strip()
        if not title:
            raise serializers.ValidationError("Task title is required.")
        return title


class ActivityLogSerializer(serializers.ModelSerializer):
    actor = PublicUserSerializer(read_only=True)

    class Meta:
        model = ActivityLog
        fields = [
            "id",
            "actor",
            "action",
            "entity_type",
            "entity_id",
            "message",
            "metadata",
            "created_at",
        ]
