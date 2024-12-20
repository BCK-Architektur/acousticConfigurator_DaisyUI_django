from django.db import models
from django.contrib.auth.models import User

class Preset(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    inputs = models.JSONField()

    def __str__(self):
        return self.name

class Material(models.Model):
    name = models.CharField(max_length=100, unique=True)  # Material name
    absorption_125hz = models.FloatField(default=0.0)  # Absorption coefficient for 125 Hz
    absorption_250hz = models.FloatField(default=0.0)  # Absorption coefficient for 250 Hz
    absorption_500hz = models.FloatField(default=0.0)  # Absorption coefficient for 500 Hz
    absorption_1000hz = models.FloatField(default=0.0)  # Absorption coefficient for 1000 Hz
    absorption_2000hz = models.FloatField(default=0.0)  # Absorption coefficient for 2000 Hz
    absorption_4000hz = models.FloatField(default=0.0)  # Absorption coefficient for 4000 Hz
    cost_per_absorber = models.FloatField(default=1.0)  # Cost per absorber

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Material"
        verbose_name_plural = "Materials"
