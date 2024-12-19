from django.db import models
from django.contrib.auth.models import User

class Preset(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    inputs = models.JSONField()

    def __str__(self):
        return self.name
