from django.urls import path
from rhino_app import views

urlpatterns = [
    path('', views.index, name='index'),  # Main page
    path('api/rhino/solve/', views.solve_grasshopper, name='solve_grasshopper'),  # API
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('save_preset/', views.save_preset, name='save_preset'),
    path('delete_preset/<int:preset_id>/', views.delete_preset, name='delete_preset'),
    path('create_material',views.create_material , name = 'create_material' ),
    path('get_material/<int:material_id>/', views.get_material_details, name='get_material'),
    path('api/openai/chat/', views.chat_with_openai, name='chat_with_openai'),

]
