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
from django.shortcuts import get_object_or_404
from django.shortcuts import redirect, get_object_or_404
from django.http import JsonResponse
from openai import OpenAI 
import json
from dotenv import load_dotenv 
import re
load_dotenv()

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
        return redirect('index')  
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
        return redirect('index')  
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

def get_material_details(request, material_id):
    """
    Fetch material details including absorption coefficients for a given material ID.
    """
    try:
        material = Material.objects.get(id=material_id)
        material_data = {
            "name": material.name,
            "absorption_coefficients": {
                "125hz": material.absorption_125hz,
                "250hz": material.absorption_250hz,
                "500hz": material.absorption_500hz,
                "1000hz": material.absorption_1000hz,
                "2000hz": material.absorption_2000hz,
                "4000hz": material.absorption_4000hz,
            },
            "cost_per_unit": material.cost_per_absorber,
        }
        return JsonResponse({"success": True, "material": material_data})
    except Material.DoesNotExist:
        return JsonResponse({"success": False, "error": "Material not found"}, status=404)

def delete_material(request, material_id):
    """
    Deletes a material by its ID and redirects to the index page.
    """
    if request.method == "POST":  # Ensure only POST requests are allowed
        try:
            material = get_object_or_404(Material, id=material_id)
            material.delete()
            # Redirect to index page after successful deletion
            return redirect('index')  # Replace 'index' with the name of your URL pattern for ''
        except Exception as e:
            return JsonResponse({"success": False, "error": str(e)}, status=400)
    return JsonResponse({"success": False, "error": "Invalid request method"}, status=405)

# Access the API key
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY_5")

# Initialize the OpenAI client
client = OpenAI(api_key=OPENAI_API_KEY)

@csrf_exempt
def chat_with_openai(request):
    print("Received request for OpenAI call")
    # Store recent prompt-response pairs (max 3)
    chat_memory = []
    if request.method == 'POST':
        try:
            # Parse the request body for the prompt
            data = json.loads(request.body)
            print(f"Raw request data: {data}")
            prompt = data.get('prompt', '')
            inputs = data.get('input_data', {})
            print(f"Received prompt: {prompt}")
            print(f"Received inputs: {inputs}")


            if not prompt:
                return JsonResponse({"error": "No prompt provided"}, status=400)

            # Define inputs, their descriptions, ranges, and an example response
            inputs_description = {
                "x_size": "Room length in mm",
                "y_size": "Room width in mm",
                "z_size": "Room height in mm",
                "numberOfDoors": "Number of doors (1 to 3)",
                "doorWall_1": "Wall on which door 1 is located",
                "doorPosition_1": "Position of door 1 along the wall in mm",
                "doorWall_2": "Wall on which door 2 is located",
                "doorPosition_2": "Position of door 2 along the wall in mm",
                "doorWall_3": "Wall on which door 3 is located",
                "doorPosition_3": "Position of door 3 along the wall in mm",
                "numberOfWindows": "Number of windows (1 to 3)",
                "windowWall_1": "Wall on which window 1 is located",
                "windowPosition_1": "Position of window 1 along the wall in mm",
                "windowWall_2": "Wall on which window 2 is located",
                "windowPosition_2": "Position of window 2 along the wall in mm",
                "windowWall_3": "Wall on which window 3 is located",
                "windowPosition_3": "Position of window 3 along the wall in mm",
                "stereoSetup": "True or False — whether stereo speakers are used, when specified with skeaper setup this will always be false",
                "speakerSetup": "Speaker setup type: 1=7.1.4, 2=7.1.6, 3=9.1.4, 4=9.1.6",
                "changeSpeakerOrientationToOrthogonal": "True or False — whether speaker orientation is orthogonal",
                "listenerPosition": "Listener position from wall in mm",
                "speakerWallOffset": "Distance of speaker from wall in mm",
                "speakerOrientation": "Speaker orientation ID: 1 to 4",
                "additionalFirstLayerSpeakers": "True or False — whether to add more first layer speakers",
                "additionalSecondLayerSpeakers": "True or False — whether to add more second layer speakers",
                "frontSpeakerAngle": "Angle of front speakers in degrees",
                "sideSpeakerAngle": "Angle of side speakers in degrees",
                "rearSpeakerAngle": "Angle of rear speakers in degrees",
                "adjustOverheadSpeakers": "Vertical offset of overhead speakers in mm",
                "adjustAbsorberAmount": "Amount of wall absorbers (0 to 50)",
                "adjustAbsorberAmountCeiling": "Amount of ceiling absorbers (0 to 30)",
                "selectAbsorberType": "ID of the absorber material to use"
            }


            input_ranges = {
                "x_size": [1000, 20000],
                "y_size": [1000, 20000],
                "z_size": [2000, 10000],
                "doorPosition_1": [36, 1000],
                "doorPosition_2": [36, 1000],
                "doorPosition_3": [36, 1000],
                "numberOfDoors": [1, 3],
                "numberOfWindows": [1, 3],
                "windowPosition_1": [0, 1000],
                "windowPosition_2": [0, 1000],
                "windowPosition_3": [0, 1000],
                "listenerPosition": [800, 1500],
                "speakerWallOffset": [250, 1000],
                "speakerOrientation": [1, 4],
                "frontSpeakerAngle": [22, 40],
                "sideSpeakerAngle": [90, 110],
                "rearSpeakerAngle": [120, 150],
                "adjustOverheadSpeakers": [-1000, 500],
                "adjustAbsorberAmount": [0, 50],
                "adjustAbsorberAmountCeiling": [0, 30],
                "selectAbsorberType": [9, 10, 11, 12, 13, 14],
                "stereoSetup": [True, False],
            }

            example_response = {
                "parameters": {
                    "x_size": 5000,
                    "y_size": 4000,
                    "z_size": 3000,
                    "numberOfDoors": 2,
                    "doorWall_1": "wall1",
                    "doorPosition_1": 500,
                    "doorWall_2": "wall2",
                    "doorPosition_2": 800,
                    "doorWall_3": "wall3",
                    "doorPosition_3": 200,
                    "numberOfWindows": 2,
                    "windowWall_1": "wall2",
                    "windowPosition_1": 300,
                    "windowWall_2": "wall3",
                    "windowPosition_2": 600,
                    "windowWall_3": "wall4",
                    "windowPosition_3": 900,
                    "stereoSetup": True,
                    "speakerSetup": 1,
                    "changeSpeakerOrientationToOrthogonal": False,
                    "listenerPosition": 940,
                    "speakerWallOffset": 500,
                    "speakerOrientation": 3,
                    "additionalFirstLayerSpeakers": False,
                    "additionalSecondLayerSpeakers": True,
                    "frontSpeakerAngle": 30,
                    "sideSpeakerAngle": 100,
                    "rearSpeakerAngle": 135,
                    "adjustOverheadSpeakers": -520,
                    "adjustAbsorberAmount": 15,
                    "adjustAbsorberAmountCeiling": 10,
                    "selectAbsorberType": 2
                },
                "reasoning": "Selected a medium room with balanced speaker and absorber setup to optimize surround experience."
            }


            # Absorber material presets
            material_presets = {
                1: {
                    "name": "Acoustic Foam Panel (25mm)",
                    "coefficients": [0.10, 0.30, 0.65, 0.85, 0.95, 0.95]
                },
                2: {
                    "name": "Mineral Wool Panel (50mm)",
                    "coefficients": [0.30, 0.65, 0.90, 0.95, 1.00, 1.00]
                },
                3: {
                    "name": "Perforated Wood Panel (16/16/10)",
                    "coefficients": [0.20, 0.30, 0.60, 0.70, 0.55, 0.35]
                },
                4: {
                    "name": "Fabric-Wrapped Panel (50mm Fiberglass)",
                    "coefficients": [0.25, 0.60, 0.85, 0.90, 0.90, 0.90]
                },
                5: {
                    "name": "Carpet on Concrete",
                    "coefficients": [0.08, 0.24, 0.57, 0.69, 0.71, 0.73]
                }
            }

            # Format material preset context for GPT
            material_info = "\n".join([
                f"- ID {id}: {preset['name']} with coefficients at [125,250,500,1000,2000,4000] Hz: {preset['coefficients']}"
                for id, preset in material_presets.items()
            ])

            # Format memory into the prompt
            history_section = ""
            if chat_memory:
                history_section = "\n\nConversation History:\n"
                for i, (old_prompt, old_reasoning) in enumerate(chat_memory[-3:], 1):
                    history_section += f"\nUser {i}: {old_prompt}\nAssistant {i}: {old_reasoning}\n"


            system_instruction = (
                "You are an expert acoustics engineer. Your job is to configure room acoustics to meet a target RT60 value "
                "by adjusting parameters such as absorber amount and material type.\n"
                "Materials are preloaded and each one has defined absorption coefficients. "
                "You must use their effectiveness when choosing the absorber type and quantity.\n"
                "Always return a JSON with 'parameters' and 'reasoning'."
                "Keep absorbers always zero quantity unless mentioned in the initial prompt."

            )

            full_prompt = (
                "Descriptions:\n" + "\n".join([f"- {k}: {v}" for k, v in inputs_description.items()]) +
                "\n\nRanges:\n" + "\n".join([f"- {k}: {v}" for k, v in input_ranges.items()]) +
                "\n\nAvailable Absorber Materials:\n" + material_info +
                 history_section +  # ← NEW
                "\n\nExample Response:\n" + json.dumps(example_response, indent=2) +
                "\n\nYour task is to provide a JSON response with the following structure:\n" +
                "\n\nCurrent Room Configuration:\n" + json.dumps(inputs, indent=2) +
                f"\n\nNow respond to this prompt:\n{prompt}"
            )

            # Then send it to OpenAI
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": full_prompt}
                ],
                max_tokens=900
            )
            # Check if the response is valid
            print("OpenAI API call succeeded")
            print(f"Raw OpenAI Response: {response}")

            # Extract the content and parse as JSON if applicable
            gpt_output = response.choices[0].message.content
            print(f"gpt output Response: {gpt_output}")

            # Use the parsing helper function
            parameters = parse_openai_response(gpt_output)

            # Handle errors in parsing
            if "error" in parameters:
                return JsonResponse(parameters, status=500)
            
            # Add the current prompt and reasoning to chat memory
            reasoning = parameters.get("reasoning", "")
            chat_memory.append((prompt, reasoning))
            # Limit chat memory to the last 3 entries
            if len(chat_memory) > 3:
                chat_memory.pop(0)


            # Send the extracted parameters to the frontend
            return JsonResponse({"parameters": parameters})
            
        except Exception as e:
            print(f"Error while calling OpenAI API: {e}")
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request method"}, status=400)

@csrf_exempt
def parse_openai_response(raw_response):
    """
    Extracts and parses JSON from a mixed OpenAI response, returning parameters and reasoning.
    """
    try:
        # Use regex to find the first valid JSON object in the response
        json_match = re.search(r'\{[\s\S]*\}', raw_response)
        if not json_match:
            raise ValueError("No JSON object found in the response.")

        # Extract and parse the JSON content
        json_str = json_match.group(0)
        parsed = json.loads(json_str)

        # Return structured response
        parameters = parsed.get("parameters", {})
        reasoning = parsed.get("reasoning", "")
        return {"parameters": parameters, "reasoning": reasoning}

    except json.JSONDecodeError as e:
        print(f"JSON decode error: {e}")
        return {"error": "Failed to parse JSON from response."}
    except Exception as e:
        print(f"Unexpected error during parsing: {e}")
        return {"error": str(e)}