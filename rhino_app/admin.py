from django.contrib import admin
from .models import Material

@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = ('name', 'absorption_125hz', 'absorption_250hz', 
                    'absorption_500hz', 'absorption_1000hz', 
                    'absorption_2000hz', 'absorption_4000hz')
    search_fields = ('name',)
    list_filter = ('name',)