from django.http import HttpResponse
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie


@ensure_csrf_cookie
def spa(request):
    try:
        return render(request, "index.html")
    except Exception:
        return HttpResponse(
            "TaskFlow API is running. Build the React frontend to serve the full app.",
            content_type="text/plain",
        )
