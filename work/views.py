import json
import time

from django.contrib.auth.decorators import login_required
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import Count, Q
from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsPlatformAdmin

from .models import ActivityLog, Project, Task
from .serializers import ActivityLogSerializer, ProjectSerializer, TaskSerializer


def ensure_admin(user):
    if not user.is_platform_admin:
        raise PermissionDenied("You need an administrator role to perform this action.")


def log_activity(actor, action, entity, message, metadata=None):
    return ActivityLog.objects.create(
        actor=actor,
        action=action,
        entity_type=entity.__class__.__name__.lower(),
        entity_id=str(entity.id),
        message=message,
        metadata=metadata or {},
    )


class ProjectListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        projects = Project.objects.select_related("owner").annotate(
            task_count=Count("tasks")
        )
        if request.query_params.get("include_archived") != "true":
            projects = projects.filter(is_archived=False)
        serializer = ProjectSerializer(projects, many=True)
        return Response(serializer.data)

    def post(self, request):
        ensure_admin(request.user)
        serializer = ProjectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        project = serializer.save(owner=request.user)
        log_activity(
            request.user,
            ActivityLog.Action.CREATED,
            project,
            f"Project {project.name} was created",
        )
        return Response(ProjectSerializer(project).data, status=status.HTTP_201_CREATED)


class ProjectDetailView(APIView):
    permission_classes = [IsPlatformAdmin]

    def patch(self, request, project_id):
        project = get_object_or_404(Project, id=project_id)
        serializer = ProjectSerializer(project, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        project = serializer.save()
        log_activity(
            request.user,
            ActivityLog.Action.UPDATED,
            project,
            f"Project {project.name} was updated",
        )
        return Response(ProjectSerializer(project).data)

    def delete(self, request, project_id):
        project = get_object_or_404(Project, id=project_id)
        project.is_archived = True
        project.save(update_fields=["is_archived", "updated_at"])
        log_activity(
            request.user,
            ActivityLog.Action.ARCHIVED,
            project,
            f"Project {project.name} was archived",
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class TaskListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tasks = Task.objects.select_related(
            "project",
            "created_by",
            "assigned_to",
        ).filter(project__is_archived=False)

        status_filter = request.query_params.get("status")
        priority_filter = request.query_params.get("priority")
        project_filter = request.query_params.get("project")
        assigned_filter = request.query_params.get("assigned_to")
        search = request.query_params.get("search")

        if status_filter:
            tasks = tasks.filter(status=status_filter)
        if priority_filter:
            tasks = tasks.filter(priority=priority_filter)
        if project_filter:
            tasks = tasks.filter(project_id=project_filter)
        if assigned_filter:
            tasks = tasks.filter(assigned_to_id=assigned_filter)
        if search:
            tasks = tasks.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(project__name__icontains=search)
            )

        serializer = TaskSerializer(tasks, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = TaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task = serializer.save(created_by=request.user)
        log_activity(
            request.user,
            ActivityLog.Action.CREATED,
            task,
            f"Task {task.title} was created",
            {"project": str(task.project_id), "priority": task.priority},
        )
        return Response(TaskSerializer(task).data, status=status.HTTP_201_CREATED)


class TaskDetailView(APIView):
    permission_classes = [IsPlatformAdmin]

    def patch(self, request, task_id):
        task = get_object_or_404(Task.objects.select_related("project"), id=task_id)
        before = {
            "title": task.title,
            "status": task.status,
            "priority": task.priority,
            "due_date": task.due_date.isoformat(),
        }
        serializer = TaskSerializer(task, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        task = serializer.save()
        log_activity(
            request.user,
            ActivityLog.Action.UPDATED,
            task,
            f"Task {task.title} was updated",
            {"before": before},
        )
        return Response(TaskSerializer(task).data)

    def delete(self, request, task_id):
        task = get_object_or_404(Task, id=task_id)
        task_title = task.title
        task_id_value = str(task.id)
        task.delete()
        ActivityLog.objects.create(
            actor=request.user,
            action=ActivityLog.Action.DELETED,
            entity_type="task",
            entity_id=task_id_value,
            message=f"Task {task_title} was deleted",
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class ActivityListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        activities = ActivityLog.objects.select_related("actor")[:80]
        return Response(ActivityLogSerializer(activities, many=True).data)


@login_required
def events_stream(request):
    def stream():
        last_seen = request.GET.get("last_id", "")
        deadline = time.monotonic() + 55
        while time.monotonic() < deadline:
            latest = ActivityLog.objects.select_related("actor").first()
            if latest and str(latest.id) != last_seen:
                last_seen = str(latest.id)
                payload = json.dumps(
                    ActivityLogSerializer(latest).data,
                    cls=DjangoJSONEncoder,
                )
                yield f"event: activity\ndata: {payload}\n\n"
            else:
                yield ": heartbeat\n\n"
            time.sleep(8)

    response = StreamingHttpResponse(stream(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response
