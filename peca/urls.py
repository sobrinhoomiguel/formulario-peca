from django.urls import path
from django.conf import settings
from django.conf.urls.static import static

from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('vote/', views.vote, name='vote'),
    path('get_votes/', views.get_votes, name='get_votes'),
    path('ganhador/', views.ganhador, name='ganhador'),
    path('delete_votes/', views.delete_votes, name='delete_votes'),
    path('admin-panel/', views.admin_panel, name='admin_panel'),
]


if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)