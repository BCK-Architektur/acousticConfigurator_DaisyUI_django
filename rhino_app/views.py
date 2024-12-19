import requests
import base64
import json
import os
from django.http import JsonResponse
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from .models import Preset , Material
from .forms import MaterialForm

def solve_grasshopper(request):
    if request.method == "POST":
        try:
            # 1. Collect Parameters
            gh_file_name = request.POST.get("grasshopper_file_name")
            inputs = json.loads(request.POST.get("input_data", "{}"))
            print("Inputs received:", inputs)

            # Locate Grasshopper definition
            gh_file_path = os.path.join(settings.GRASSHOPPER_FILES_DIR, gh_file_name)
            if not os.path.exists(gh_file_path):
                return JsonResponse({"success": False, "error": f"File {gh_file_name} not found."})

            # 2. Encode Grasshopper File
            with open(gh_file_path, "rb") as gh_file:
                gh_data = gh_file.read()
                encoded = base64.b64encode(gh_data).decode()  # Keep it as Base64-encoded string

            # 3. Prepare Inputs
            values = []
            for param_name, param_value in inputs.items():
                inner_tree = {
                    "{0;0}": [
                        {
                            "type": "System.Double" if isinstance(param_value, (float, int)) else "System.String",
                            "data": param_value,
                        }
                    ]
                }
                values.append({"ParamName": param_name, "InnerTree": inner_tree})

            # 4. Send Request to Rhino Compute
            post_url = "http://localhost:6001/grasshopper"
            payload = {"algo": encoded, "pointer": None, "values": values}
            response = requests.post(post_url, json=payload)

            if response.status_code != 200:
                print("Compute server error:", response.text)
                return JsonResponse({"success": False, "error": response.text}, status=response.status_code)

            # 5. Parse and Return Result
            res_data = response.json()
            return JsonResponse(res_data)

        except Exception as e:
            print("Error in solve_grasshopper:", str(e))
            return JsonResponse({"success": False, "error": str(e)}, status=500)

    return JsonResponse({"success": False, "error": "Only POST method allowed."})

def login_view(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            return redirect('index')
        else:
            return render(request, 'rhino_app/login.html', {'error': 'Invalid username or password'})

    return render(request, 'rhino_app/login.html')

@login_required
def logout_view(request):
    logout(request)
    return redirect('login')


@login_required
def index(request):
    # Fetch presets for the logged-in user
    presets = Preset.objects.filter(user=request.user).values('id', 'name', 'inputs')
    
    # Fetch materials for the logged-in user
    materials = Material.objects.all()
    
    # Pass both presets and materials to the template
    return render(request, 'rhino_app/index.html', {'presets': presets, 'materials': materials})

@login_required
def save_preset(request):
    if request.method == 'POST':
        preset_name = request.POST.get('name')
        inputs = request.POST.get('inputs')  # This should be JSON string from JavaScript
        inputs = json.loads(inputs)  # Convert JSON string to Python dict
        preset = Preset(user=request.user, name=preset_name, inputs=inputs)
        preset.save()
        return JsonResponse({'success': True})

    return JsonResponse({'success': False, 'error': 'Invalid request'})

@login_required
def delete_preset(request, preset_id):
    """
    Deletes a preset by its ID for the logged-in user.
    """
    try:
        preset = Preset.objects.get(id=preset_id, user=request.user)  # Ensure user ownership
        preset.delete()
        return JsonResponse({'success': True})
    except Preset.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Preset not found or unauthorized'}, status=404)

@login_required
def create_material(request):
    if request.method == 'POST':
        form = MaterialForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('index')  # Redirect to a material list or another relevant page
    else:
        form = MaterialForm()
    return render(request, 'rhino_app/index.html', {'form': form})