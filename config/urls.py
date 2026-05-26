from django.contrib import admin
from django.urls import include, path, re_path

from .views import spa

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("accounts.urls")),
    path("api/", include("work.urls")),
    re_path(r"^(?!api/|admin/|static/).*$", spa, name="spa"),
]
