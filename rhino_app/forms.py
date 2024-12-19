from django import forms
from .models import Material

class MaterialForm(forms.ModelForm):
    class Meta:
        model = Material
        fields = ['name', 'absorption_125hz', 'absorption_250hz', 
                  'absorption_500hz', 'absorption_1000hz', 
                  'absorption_2000hz', 'absorption_4000hz']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'input input-bordered', 'placeholder': 'Material Name'}),
            'absorption_125hz': forms.NumberInput(attrs={'class': 'input input-bordered', 'placeholder': '0.0'}),
            'absorption_250hz': forms.NumberInput(attrs={'class': 'input input-bordered', 'placeholder': '0.0'}),
            'absorption_500hz': forms.NumberInput(attrs={'class': 'input input-bordered', 'placeholder': '0.0'}),
            'absorption_1000hz': forms.NumberInput(attrs={'class': 'input input-bordered', 'placeholder': '0.0'}),
            'absorption_2000hz': forms.NumberInput(attrs={'class': 'input input-bordered', 'placeholder': '0.0'}),
            'absorption_4000hz': forms.NumberInput(attrs={'class': 'input input-bordered', 'placeholder': '0.0'}),
        }
