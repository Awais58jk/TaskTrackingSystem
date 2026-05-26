from django.urls import path

from .views import (
    ActivityListView,
    ProjectDetailView,
    ProjectListCreateView,
    TaskDetailView,
    TaskListCreateView,
    events_stream,
)

urlpatterns = [
    path("projects", ProjectListCreateView.as_view(), name="projects"),
    path("projects/<uuid:project_id>", ProjectDetailView.as_view(), name="project-detail"),
    path("tasks", TaskListCreateView.as_view(), name="tasks"),
    path("tasks/<uuid:task_id>", TaskDetailView.as_view(), name="task-detail"),
    path("activity", ActivityListView.as_view(), name="activity"),
    path("events/stream", events_stream, name="events-stream"),
]
