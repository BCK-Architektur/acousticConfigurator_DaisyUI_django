import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { Rhino3dmLoader } from 'three/examples/jsm/loaders/3DMLoader'
import rhino3dm from 'rhino3dm'

// set up loader for converting the results to threejs
const loader = new Rhino3dmLoader()
loader.setLibraryPath( 'https://unpkg.com/rhino3dm@8.0.0-beta/' )

// initialise 'data' object that will be used by compute()
const data = {
  definition: '241195_configurator.gh',
  inputs: getInputs()
}
///////////////////////////////////////////////////////////////////////////
// globals
let _threeMesh, _threeMaterial, doc
let scene, camera, renderer, controls

const rhino = await rhino3dm()
console.log('Loaded rhino3dm.')

init()
// updateInputs()

// Call this after the DOM is loaded
attachEventListeners();
updateVisibility();
initializeSliders();
compute()

  /////////////////////////////////////////////////////////////////////////////
 //                            HELPER  FUNCTIONS                            //
/////////////////////////////////////////////////////////////////////////////

/**
 * Gets <input> elements from html and sets handlers
 * (html is generated from the grasshopper definition)
 */

// Called when a dropdown or slider value changes
function onSliderChange() {
  showSpinner(true);
  let inputs = {};
  for (const input of document.getElementsByTagName('input')) {
    switch (input.type) {
      case 'number':
        setTimeout(() => {
          inputs[input.id] = input.valueAsNumber;
        }, 1000); // Add 1-second delay for number inputs
        break;
      case 'range':
        setTimeout(() => {
        inputs[input.id] = input.valueAsNumber;
        }, 200); // Add 1-second delay for number inputs
        updateRangeValue(input.id); // Update displayed value
        break;
      case 'checkbox':
        inputs[input.id] = input.checked;
        break;
    }
  }
  for (const select of document.getElementsByTagName('select')) {
    inputs[select.id] = parseInt(select.value, 1); // Ensure dropdown values are stored as numbers
  }
  
  data.inputs = inputs;
  debouncedCompute();
}


// Function to update the displayed value of the range slider
function updateRangeValue(inputId) {
  const input = document.getElementById(inputId);
  const valueSpan = document.getElementById(`${inputId}_value`);
  if (input && valueSpan) {
    valueSpan.textContent = `${input.value}`;
  }
}


function getInputs() {
  const inputs = {
    x_size: Number(document.getElementById('x_size').value),
    y_size: Number(document.getElementById('y_size').value),
    z_size: Number(document.getElementById('z_size').value),
    changeSpeakerOrientationToOrthogonal: document.getElementById('changeSpeakerOrientationToOrthogonal').checked,
    stereoSetup: document.getElementById('stereoSetup').checked,
    listenerPosition: Number(document.getElementById('listenerPosition').value),
    speakerWallOffset: Number(document.getElementById('speakerWallOffset').value),
    speakerOrientation: Number(document.getElementById('speakerOrientation').value),
    additionalFirstLayerSpeakers: document.getElementById('additionalFirstLayerSpeakers').checked,
    additionalSecondLayerSpeakers: document.getElementById('additionalSecondLayerSpeakers').checked,
    frontSpeakerAngle: Number(document.getElementById('frontSpeakerAngle').value),
    sideSpeakerAngle: Number(document.getElementById('sideSpeakerAngle').value),
    rearSpeakerAngle: Number(document.getElementById('rearSpeakerAngle').value),
    adjustOverheadSpeakers: Number(document.getElementById('adjustOverheadSpeakers').value),
    // visualizeFirstReflections: document.getElementById('visualizeFirstReflections').checked,
    // visualizeHeatMap: document.getElementById('visualizeHeatMap').checked,
    // adjustHeatmap: Number(document.getElementById('adjustHeatmap').value),
    // addAbsorbers: document.getElementById('addAbsorbers').checked,
    adjustAbsorberAmount: Number(document.getElementById('adjustAbsorberAmount').value),
    // addAbsorbersToCeiling: document.getElementById('addAbsorbersToCeiling').checked,
    adjustAbsorberAmountCeiling: Number(document.getElementById('adjustAbsorberAmountCeiling').value),
    numberOfDoors: Number(document.getElementById('numberOfDoors').value),
    doorPosition_1: Number(document.getElementById('doorPosition_1').value),
    doorPosition_2: Number(document.getElementById('doorPosition_2').value),
    doorPosition_3: Number(document.getElementById('doorPosition_3').value),
    numberOfWindows: Number(document.getElementById('numberOfWindows').value),
    windowPosition_1: Number(document.getElementById('windowPosition_1').value),
    windowPosition_2: Number(document.getElementById('windowPosition_2').value),
    windowPosition_3: Number(document.getElementById('windowPosition_3').value),
    selectAbsorberType: Number(document.getElementById('selectAbsorberType').value)
  };

  return inputs;
}

function attachEventListeners() {
  // Attach event listeners for all <input> elements
  const inputs = document.querySelectorAll('input');
  inputs.forEach((input) => {
    // Skip inputs with the "no-update" class
    if (input.classList.contains('no-update')) return;

    if (input.type === 'number') {
      let typingTimer; // Timer identifier
      const typingDelay = 3000; // Delay in milliseconds

      input.addEventListener('input', () => {
        clearTimeout(typingTimer); // Clear the previous timer
        typingTimer = setTimeout(() => onSliderChange(), typingDelay); // Set a new timer
      });
    } else {
      input.addEventListener('input', onSliderChange);
    }
  });

  // Attach event listeners for all <select> elements
  const selects = document.querySelectorAll('select');
  selects.forEach((select) => {
    // Skip selects with the "no-update" class
    if (select.classList.contains('no-update')) return;

    select.addEventListener('change', onSliderChange); // Use 'change' for dropdowns
  });

  // Attach event listeners for wall dropdowns
  for (let i = 1; i <= 3; i++) {
    const doorWall = document.getElementById(`doorWall_${i}`);
    const windowWall = document.getElementById(`windowWall_${i}`);
    const doorPosition = document.getElementById(`doorPosition_${i}`);
    const windowPosition = document.getElementById(`windowPosition_${i}`);

    if (doorWall) {
      doorWall.addEventListener('change', () =>
        updateRangeForWall(doorWall, doorPosition, true)
      ); // true for door
    }
    if (windowWall) {
      windowWall.addEventListener('change', () =>
        updateRangeForWall(windowWall, windowPosition, false)
      ); // false for window
    }
  }
}



// Function to update the range slider values based on the selected wall
function updateRangeForWall(wallSelect, slider, isDoor) {
  if (!wallSelect || !slider) return;

  const selectedWall = wallSelect.value;
  let min, max, value;

  // Set range and default value based on the selected wall
  switch (selectedWall) {
    case 'wall1':
      min = 36;
      max = 275;
      value = isDoor ? 150 : 80; // Door = 150, Window = 100
      break;
    case 'wall2':
      min = 278;
      max = 525;
      value = isDoor ? 380 : 280; // Door = 350, Window = 300
      break;
    case 'wall3':
      min = 528;
      max = 775;
      value = isDoor ? 650 : 580; // Door = 650, Window = 600
      break;
    case 'wall4':
      min = 778;
      max = 1000;
      value = isDoor ? 950 : 880; // Door = 950, Window = 900
      break;
    default:
      return;
  }

  slider.min = min;
  slider.max = max;
  slider.value = value;
  updateRangeValue(slider.id); // Update the displayed value next to the slider
}

function initializeSliders() {
  // Loop through all door and window positions
  for (let i = 1; i <= 3; i++) {
    const doorWall = document.getElementById(`doorWall_${i}`);
    const windowWall = document.getElementById(`windowWall_${i}`);
    const doorPosition = document.getElementById(`doorPosition_${i}`);
    const windowPosition = document.getElementById(`windowPosition_${i}`);

    if (doorWall && doorPosition) {
      updateRangeForWall(doorWall, doorPosition, true); // true for door
    }
    if (windowWall && windowPosition) {
      updateRangeForWall(windowWall, windowPosition, false); // false for window
    }
  }
}

function updateVisibility() {
  // Update visibility for doors
  const numberOfDoors = parseInt(document.getElementById('numberOfDoors').value, 10);
  for (let i = 1; i <= 3; i++) {
    const doorPosition = document.getElementById(`doorPosition_${i}`);
    const doorLabel = document.querySelector(`label[for="doorPosition_${i}"]`);
    const doorSpan = document.getElementById(`doorPosition_${i}_value`);
    const doorWall = document.getElementById(`doorWall_${i}`); // Wall selection dropdown


    if (i <= numberOfDoors) {
      doorPosition.style.display = 'inline-block';
      doorLabel.style.display = 'inline-block';
      doorSpan.style.display = 'inline-block';
      doorWall.style.display = 'inline-block';
    } else {
      doorPosition.style.display = 'none';
      doorLabel.style.display = 'none';
      doorSpan.style.display = 'none';
      doorWall.style.display = 'none';

    }
  }

  // Update visibility for windows
  const numberOfWindows = parseInt(document.getElementById('numberOfWindows').value, 10);
  for (let i = 1; i <= 3; i++) {
    const windowPosition = document.getElementById(`windowPosition_${i}`);
    const windowLabel = document.querySelector(`label[for="windowPosition_${i}"]`);
    const windowSpan = document.getElementById(`windowPosition_${i}_value`);
    const windowWall = document.getElementById(`windowWall_${i}`); // Wall selection dropdown

    if (i <= numberOfWindows) {
      windowPosition.style.display = 'inline-block';
      windowLabel.style.display = 'inline-block';
      windowSpan.style.display = 'inline-block';
      windowWall.style.display = 'inline-block';

    } else {
      windowPosition.style.display = 'none';
      windowLabel.style.display = 'none';
      windowSpan.style.display = 'none';
      windowWall.style.display = 'none';

    }
  }
}

// Attach event listeners to the dropdowns
document.getElementById('numberOfDoors').addEventListener('change', updateVisibility);
document.getElementById('numberOfWindows').addEventListener('change', updateVisibility);



function updateSpeakerConfiguration() {
  const speakerSetup = document.getElementById('speakerSetup').value;
  const additionalFirstLayerSpeakers = document.getElementById('additionalFirstLayerSpeakers');
  const additionalSecondLayerSpeakers = document.getElementById('additionalSecondLayerSpeakers');
  
  // Reset both checkboxes first
  additionalFirstLayerSpeakers.checked = false;
  additionalSecondLayerSpeakers.checked = false;
  
  // Set the checkboxes based on the selected speaker setup
  switch (speakerSetup) {
      case "1": // 7.1.4
          // Default, both unchecked
          break;
      case "2": // 7.1.6
          additionalSecondLayerSpeakers.checked = true;
          break;
      case "3": // 9.1.4
          additionalFirstLayerSpeakers.checked = true;
          break;
      case "4": // 9.1.6
          additionalFirstLayerSpeakers.checked = true;
          additionalSecondLayerSpeakers.checked = true;
          break;
  }
  onSliderChange(); // Trigger an update with the new configuration
}

document.getElementById('speakerSetup').addEventListener('change', updateSpeakerConfiguration);



///////////////////////////////////////////////////////////////////////////
/**
 * Sets up the scene, orthographic camera, renderer, lights, and controls and starts the animation
 */
function init() {
  THREE.Object3D.DefaultUp = new THREE.Vector3(1, 0, 0);

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#eeeeee');

  const aspect = window.innerWidth / window.innerHeight;
  const frustumSize = 2000; // Adjusted for better model fitting

  camera = new THREE.OrthographicCamera(
    (frustumSize * aspect) / -2,
    (frustumSize * aspect) / 2,
    frustumSize / 2,
    frustumSize / -2,
    1,
    250000  // Far clipping plane adjusted for model depth
  );

  // Position the camera for a better view
  camera.position.set(100000, 100000, 100000); // Adjusted to have a clearer view of the model from an angle
  camera.lookAt(new THREE.Vector3(0, 0, 0)); // Center on the origin

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = true;
  controls.enablePan = true;



  window.addEventListener('resize', onWindowResize, false);
  //zoom camera to selection after window resize
  window.addEventListener('resize', () => zoomCameraToSelection(camera, controls, scene.children, 1.8), false);
  zoomCameraToSelection(camera, controls, scene.children, 1.8)
  animate();
}
///////////////////////////////////////////////////////////////////////////

/**
 * Call appserver
 */

async function compute() {
  if (!scene) {
    console.error("Scene not ready for compute call.");
    return;
  }

  data.inputs = getInputs();

  const url = "/api/rhino/solve/";
  const formData = new FormData();
  formData.append("grasshopper_file_name", data.definition);
  formData.append("input_data", JSON.stringify(data.inputs));

  try {
    const response = await fetch(url, {
      method: "POST",
      body: formData,
      headers: {
        "X-CSRFToken": getCSRFToken(),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const responseJson = await response.json();

    collectResults(responseJson);
  } catch (error) {
    console.error("Error during compute:", error);
    alert("Failed to process the request. Check the backend or network.");
    showSpinner(false);
  }
}



///////////////////////////////////////////////////////////////////////////
/**
 * Mesh-to-Three.js function that uses vertex colors and sets material properties.
 */
function meshToThreejs(mesh) {
  let loader = new THREE.BufferGeometryLoader();
  let geometry = loader.parse(mesh.toThreejsJSON());

  // Create a material that uses vertex colors
  let material = new THREE.MeshBasicMaterial({
    vertexColors: true, // Enable vertex colors
    side: THREE.DoubleSide, // Double-sided rendering
    transparent: true,
    opacity: 0.5 // Adjust opacity as needed
  });
  return new THREE.Mesh(geometry, material);
}
// Store meshes separately to avoid conflicts
let meshb64Mesh, meshoutMesh, panelText;

// Modify replaceCurrentMesh to handle each mesh type independently
function replaceCurrentMesh(threeMesh, type) {
  // Remove the existing mesh of the specified type
  if (type === "meshb64" && meshb64Mesh) {
    scene.remove(meshb64Mesh);
    meshb64Mesh.geometry.dispose();
    meshb64Mesh.material.dispose();
    meshb64Mesh = null;
  } else if (type === "meshout" && meshoutMesh) {
    scene.remove(meshoutMesh);
    meshoutMesh.geometry.dispose();
    meshoutMesh.material.dispose();
    meshoutMesh = null;
  }
  // Add the new mesh to the scene and assign it to the corresponding variable
  if (type === "meshb64") {
    meshb64Mesh = threeMesh;
    meshb64Mesh.geometry.rotateX(Math.PI); 
    scene.add(meshb64Mesh);
  } else if (type === "meshout") {
    meshoutMesh = threeMesh;
    scene.add(meshoutMesh);
  }
  // remove all lines from the scene
  scene.children.forEach(child => {
    if (child.type === "Line") {
      scene.remove(child);
    }
  });
}
// Global variables
let currentMaterial = "N.A"; // Default material name
let currentCostPerUnit = 0; // Default cost per absorber unit, to be dynamically updated

// Reference to the Chart.js instance
let chart; 

// Default frequencies and coefficients
const defaultFrequencies = [125, 250, 500, 1000, 2000, 4000];
const defaultCoefficients = [0, 0, 0, 0, 0, 0];

let currentAbsorptionCoefficients = [0, 0, 0, 0, 0, 0]; // Default values

async function fetchMaterialDetails(materialId) {
  try {
      const response = await fetch(`/get_material/${materialId}/`);
      const result = await response.json();

      if (result.success) {
          const materialData = result.material;

          // Update global variables
          currentMaterial = materialData.name; // Update the material name
          currentCostPerUnit = materialData.cost_per_unit; // Update the cost per unit dynamically
          currentAbsorptionCoefficients = [
              materialData.absorption_coefficients["125hz"],
              materialData.absorption_coefficients["250hz"],
              materialData.absorption_coefficients["500hz"],
              materialData.absorption_coefficients["1000hz"],
              materialData.absorption_coefficients["2000hz"],
              materialData.absorption_coefficients["4000hz"]
          ];

          // Update the UI with the new material name
          document.getElementById("selectedMaterial").textContent = materialData.name;

          // Optionally update the chart with new absorption coefficients
          updateChart([125, 250, 500, 1000, 2000, 4000], currentAbsorptionCoefficients);
      } else {
          console.error("Failed to fetch material details:", result.error);
      }
  } catch (error) {
      console.error("Error fetching material details:", error);
  }
}


// Attach event listener to material dropdown
document.getElementById("selectAbsorberType").addEventListener("change", function () {
    const materialId = this.value;
    console.log("Absorber type selected:", materialId);

    if (materialId) {
        fetchMaterialDetails(materialId);
    }
});

// Function to collect results and process data
function collectResults(responseJson) {
  const values = responseJson.values;

  if (doc !== undefined) doc.delete();
  doc = new rhino.File3dm();

  // Initialize variables
  let wallArea = 0,
    ceilingArea = 0,
    floorArea = 0,
    absorberAreaWall = 0,
    absorberAreaCeiling = 0,
    totalVolume = 0,
    noOfAbsorbersWall = 0,
    noOfAbsorbersCeiling = 0,
    totalCost = 0;

  // Parse the RH_OUT values
  for (let i = 0; i < values.length; i++) {
    const output = values[i];
    if (output.InnerTree && output.InnerTree["{0}"]) {
      const branch = output.InnerTree["{0}"];
      if (branch.length > 0) {
        const text = branch[0].data?.replace(/^"|"$/g, "") || "";

        // Parse values based on ParamName
        if (output.ParamName === "RH_OUT:data_wallArea") {
          wallArea = parseFloat(text) || 0;
        } else if (output.ParamName === "RH_OUT:data_ceilingArea") {
          ceilingArea = parseFloat(text) || 0;
        } else if (output.ParamName === "RH_OUT:data_floorArea") {
          floorArea = parseFloat(text) || 0;
        } else if (output.ParamName === "RH_OUT:data_absorberArea_wall") {
          absorberAreaWall = parseFloat(text) || 0;
        } else if (output.ParamName === "RH_OUT:data_absorberArea_ceiling") {
          absorberAreaCeiling = parseFloat(text) || 0;
        } else if (output.ParamName === "RH_OUT:data_totalVolume") {
          totalVolume = parseFloat(text) || 0;
        } else if (output.ParamName === "RH_OUT:data_noOfAbs_wall") {
          noOfAbsorbersWall = parseFloat(text) || 0;
        } else if (output.ParamName === "RH_OUT:data_noOfAbs_ceiling") {
          noOfAbsorbersCeiling = parseFloat(text) || 0;
        }
      }
    }
  }

  // Calculate RT60 dynamically for each frequency
  const frequencies = [125, 250, 500, 1000, 2000, 4000];
  const RT60 = frequencies.map((_, index) => {
    const alpha = currentAbsorptionCoefficients[index]; // Dynamic coefficient for the current frequency

    // Subtract absorber areas from wall and ceiling areas
    const effectiveWallArea = Math.max(0, wallArea - absorberAreaWall); // Ensure it doesn't go negative
    const effectiveCeilingArea = Math.max(0, ceilingArea - absorberAreaCeiling); // Ensure it doesn't go negative

    // Calculate the total absorption area
    const totalAbsorptionArea =
      absorberAreaWall * alpha + // Absorber contribution
      absorberAreaCeiling * alpha + // Absorber contribution
      effectiveWallArea * alpha + // Remaining wall area contribution
      effectiveCeilingArea * alpha + // Remaining ceiling area contribution
      floorArea * alpha; // Floor contribution

    // Calculate RT60 using Sabine's formula
    return totalAbsorptionArea > 0 ? (0.161 * totalVolume) / totalAbsorptionArea : 0;
  });

  // Update the RT60 chart
  updateChart(frequencies, RT60);

  // Calculate total cost using the dynamically fetched cost per unit
  totalCost = currentCostPerUnit * (noOfAbsorbersWall + noOfAbsorbersCeiling);

  // Update the values directly in the DOM
  document.getElementById("noOfAbsorbersWall").textContent = noOfAbsorbersWall.toFixed(2);
  document.getElementById("noOfAbsorbersCeiling").textContent = noOfAbsorbersCeiling.toFixed(2);
  document.getElementById("floorArea").textContent = floorArea.toFixed(2);
  document.getElementById("totalCost").textContent = totalCost.toFixed(2);
  document.getElementById("selectedMaterial").textContent = currentMaterial;

  // Handle mesh outputs
  for (let i = 0; i < values.length; i++) {
    const output = values[i];

    if (output.ParamName === "RH_OUT:meshb64") {
      for (const path in output.InnerTree) {
        const branch = output.InnerTree[path];
        for (let j = 0; j < branch.length; j++) {
          const rhinoObject = decodeItem(branch[j]);
          if (rhinoObject) {
            const threeMesh = meshToThreejs(rhinoObject);
            replaceCurrentMesh(threeMesh, "meshb64");
            threeMesh.geometry.rotateX(-Math.PI / 2);
            doc.objects().add(rhinoObject, null);
          }
        }
      }
    }

    if (output.ParamName === "RH_OUT:meshout") {
      for (const path in output.InnerTree) {
        const branch = output.InnerTree[path];
        for (let j = 0; j < branch.length; j++) {
          const rhinoObject = decodeItem(branch[j]);
          if (rhinoObject) {
            const threeMesh = meshToThreejs(rhinoObject);
            replaceCurrentMesh(threeMesh, "meshout");
            threeMesh.geometry.rotateX(-Math.PI / 2);
            doc.objects().add(rhinoObject, null);

            const edges = new THREE.EdgesGeometry(threeMesh.geometry);
            const line = new THREE.LineSegments(
              edges,
              new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 })
            );
            line.material.depthTest = false;
            line.material.depthWrite = false;
            line.renderOrder = 1; // Prevent visual glitches
            threeMesh.add(line);
          }
        }
      }
    }
  }

  zoomCameraToSelection(camera, controls, scene.children, 1.8);

  if (doc.objects().count < 1) {
    console.error("No rhino objects to load!");
  }

  showSpinner(false);
}

///////////////////////////////////////////////////////////////////////////

function decodeItem(item) {
  const data = JSON.parse(item.data)
  if (item.type === 'System.String') {
    // hack for draco meshes
    try {
        return rhino.DracoCompression.decompressBase64String(data)
    } catch {} // ignore errors (maybe the string was just a string...)
  } else if (typeof data === 'object') {
    return rhino.CommonObject.decode(data)
  }
  return null
}

// Debounce function to limit the frequency of compute calls
function debounce(func, delay) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  }
  
// Debounced version of compute
const debouncedCompute = debounce(compute, 100);

///////////////////////////////////////////////////////////////////////////

function animate() {
  requestAnimationFrame( animate )
  controls.update()
  renderer.render(scene, camera)
}
///////////////////////////////////////////////////////////////////////////

function onWindowResize() {
  const aspect = window.innerWidth / window.innerHeight
  const frustumSize = 500

  camera.left = (frustumSize * aspect) / -2
  camera.right = (frustumSize * aspect) / 2
  camera.top = frustumSize / 2
  camera.bottom = frustumSize / -2
  camera.updateProjectionMatrix()

  renderer.setSize(window.innerWidth, window.innerHeight)
  animate()
}
///////////////////////////////////////////////////////////////////////////

function zoomCameraToSelection(camera, controls, selection, fitOffset = 1.2) {
  const box = new THREE.Box3();

  // Calculate the bounding box for the entire selection
  selection.forEach(object => {
    if (!object.isLight) box.expandByObject(object);
  });

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  const distance = fitOffset * maxDim;

  // Check if the camera position and controls target are already set
  if (camera.position.length() > 0 && controls.target.length() > 0) {
    return; // Exit early if the camera position and target are already set
  }

  // Set the camera to a northeast view (e.g., [1, 1, 1] direction) if not already set
  camera.position.set(center.x + distance, center.y + distance, center.z + distance);
  controls.target.copy(center);

  // Adjust orthographic frustum based on model size
  const aspect = window.innerWidth / window.innerHeight;
  const frustumSize = maxDim * fitOffset;

  camera.left = (-frustumSize * aspect) / 2;
  camera.right = (frustumSize * aspect) / 2;
  camera.top = frustumSize / 2;
  camera.bottom = -frustumSize / 2;

  // Ensure near and far planes cover the model depth
  camera.near = 0.1;
  camera.far = distance * 10; // Increase for larger models
  camera.updateProjectionMatrix();

  // Update the controls for the new camera position and target
  controls.update();
}

///////////////////////////////////////////////////////////////////////////

function showSpinner(enable) {
  if (enable)
    document.getElementById('loader').style.display = 'block'
  else
    document.getElementById('loader').style.display = 'none'
}

function getCSRFToken() {
  const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
  return csrfToken;
}

async function savePreset() {
  const presetName = prompt('Enter a name for your project:');
  if (!presetName) return;

  const url = '/save_preset/';
  const formData = new FormData();
  formData.append('name', presetName);
  formData.append('inputs', JSON.stringify(getInputs()));

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        'X-CSRFToken': getCSRFToken(),
      },
    });

    const data = await response.json();
    if (data.success) {
      alert('Project saved successfully!');

      // Add the new preset to the dropdown dynamically
      const presetsDropdown = document.getElementById('presets-dropdown');
      const newOption = document.createElement('option');
      newOption.value = data.preset_id; // Assuming the backend returns the new preset ID
      newOption.textContent = presetName;
      newOption.dataset.inputs = JSON.stringify(getInputs()); // Store inputs as data attribute
      presetsDropdown.appendChild(newOption);

      // Optionally, select the new preset
      presetsDropdown.value = data.preset_id;
    } else {
      alert(`Failed to save project: ${data.error}`);
    }
  } catch (error) {
    console.error('Error saving project:', error);
  }
}

async function loadPresets() {
  const url = '/load_presets/';

  try {
      const response = await fetch(url, {
          method: 'GET',
          headers: {
              'X-CSRFToken': getCSRFToken(),
          },
      });

      const data = await response.json();
      const presetsDropdown = document.getElementById('presets-dropdown');
      presetsDropdown.innerHTML = ''; // Clear existing options

      data.presets.forEach(preset => {
          const option = document.createElement('option');
          option.value = preset.id;
          option.textContent = preset.name;
          option.dataset.inputs = JSON.stringify(preset.inputs); // Store inputs as data attribute
          presetsDropdown.appendChild(option);
      });
  } catch (error) {
      console.error('Error loading project:', error);
  }
}

function applyPreset() {
  const presetsDropdown = document.getElementById('presets-dropdown');
  const selectedOption = presetsDropdown.options[presetsDropdown.selectedIndex];

  if (!selectedOption) {
    console.error("No option selected in the projects dropdown");
    return;
  }

  let rawInputs = selectedOption.dataset.inputs;

  // Replace single quotes with double quotes and correct invalid JSON (False -> false, True -> true)
  rawInputs = rawInputs
    .replace(/'/g, '"') // Replace single quotes with double quotes
    .replace(/\bFalse\b/g, 'false') // Replace Python's False with JSON's false
    .replace(/\bTrue\b/g, 'true'); // Replace Python's True with JSON's true

  try {
    const inputs = JSON.parse(rawInputs); // Parse corrected JSON
    console.log("Parsed inputs:", inputs);

    for (const [key, value] of Object.entries(inputs)) {
      const input = document.getElementById(key);
      if (input) {
        if (input.type === 'checkbox') {
          input.checked = value;
        } else {
          input.value = value;
        }
      } else {
        console.warn(`Input element with id "${key}" not found.`);
      }
    }

    // Trigger updates based on the new inputs
    onSliderChange();

  } catch (error) {
    console.error("Error parsing or applying projectsinputs:", error);
    console.error("Raw inputs causing error:", rawInputs);
  }
}

async function deletePreset() {
  const presetsDropdown = document.getElementById('presets-dropdown');
  const selectedOption = presetsDropdown.options[presetsDropdown.selectedIndex];

  if (!selectedOption || !selectedOption.value) {
    alert("Please select a project to delete.");
    return;
  }

  const presetId = selectedOption.value;
  const url = `/delete_preset/${presetId}/`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'X-CSRFToken': getCSRFToken(), // Include CSRF token
      },
    });

    if (response.ok) {
      alert("Project deleted successfully.");
      selectedOption.remove(); // Remove the deleted preset from the dropdown
    } else {
      const data = await response.json();
      alert(`Failed to delete project: ${data.error}`);
    }
  } catch (error) {
    console.error("Error deleting preset:", error);
    alert("An error occurred while deleting the project.");
  }
}

let controlWindow = null;

function startPresentation() {
  // Check if the control window is already open
  if (controlWindow && !controlWindow.closed) {
    alert('Control window is already open!');
    return;
  }

  // Hide the overlay in the main window
  const overlay = document.getElementById('overlay');
  overlay.style.display = 'none';

  // Open a new window for the controls
  controlWindow = window.open('', 'ControlsWindow', 'width=400,height=800');
  if (!controlWindow) {
    alert('Unable to open the control window. Please check your browser settings.');
    return;
  }

  // Write the structure of the control window
  controlWindow.document.write(`
    {% load static %}
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Controls</title>
        <link rel="stylesheet" href="{% static 'css/output.css' %}">
        <style>
            #overlay {
                pointer-events: auto; /* Allow mouse events to pass through */
                z-index: 1;
                width: 100%; /* Full width for the control window */
                height: 100vh; /* Fill the entire height of the screen */
                overflow-y: auto; /* Enable scrolling if the content overflows */
                background-color: #f9f9f9; /* Optional: set a background color for clarity */
                padding: 10px; /* Optional: add padding inside the panel */
                box-sizing: border-box; /* Include padding and border in the width/height */
            }
            #overlay div { padding: 5px; }
            body {
                font-family: Arial, sans-serif;
                margin: 0;
                background-color: #f9f9f9;
            }
            button {
                background-color: #007aff;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 5px;
                font-size: 13px;
                cursor: pointer;
            }
            button:hover {
                background-color: #005bb5;
            }
        </style>
    </head>
    <body>
        <div id="overlay" class="p-6 bg-base-100 shadow-lg rounded-lg">
          <div class="flex flex-col gap-4">
            <label for="presets-dropdown" class="text-xl font-bold">Presets:</label>
            <select id="presets-dropdown" class="select select-bordered w-full">
              <option value="" disabled selected>Select a preset...</option>
              <!-- Presets will be dynamically added here -->
            </select>
            <div class="flex gap-4">
              <button id="save-preset-button" class="btn btn-outline btn-neutral">Save</button>
              <button id="delete-preset-button" class="btn btn-outline btn-error" disabled>Delete</button>
            </div>
          </div>
          <div id="inputs" class="mt-6">
            <h2 class="text-xl font-bold">Room Setup</h2>
            <!-- Inputs will be dynamically added here -->
          </div>
        </div>
    </body>
    </html>
  `);
  
  controlWindow.document.close();

  // Clone the overlay content (inputs) into the new window
  const clonedOverlay = overlay.cloneNode(true);

  // Remove unnecessary styles from the clone
  clonedOverlay.style.display = 'block';
  clonedOverlay.style.position = 'static';

  // Append the cloned overlay to the new window
  const overlayContainer = controlWindow.document.getElementById('overlay');
  if (overlayContainer) {
    overlayContainer.replaceWith(clonedOverlay);
  } else {
    console.error('Could not find overlay container in the new window.');
  }

  // Add event listeners to sync changes between windows
  setupSyncBetweenWindows(controlWindow);

  // Monitor if the control window is closed
  monitorControlWindow();
}

function setupSyncBetweenWindows(controlWindow) {
    // Sync changes made in the control window to the main window
    controlWindow.document.querySelectorAll('input, select').forEach((input) => {
        input.addEventListener('input', () => {
            const originalInput = document.getElementById(input.id);
            if (originalInput) {
                if (input.type === 'checkbox') {
                    originalInput.checked = input.checked;
                } else {
                    originalInput.value = input.value;
                }
                // Trigger updates in the main window
                onSliderChange();
            }
        });
    });
}

function monitorControlWindow() {
    const interval = setInterval(() => {
        if (!controlWindow || controlWindow.closed) {
            alert('Control window closed. Returning to normal mode.');
            restoreNormalMode();
            clearInterval(interval);
        }
    }, 1000);
}

function restoreNormalMode() {
    // Restore overlay visibility in the main window
    const overlay = document.getElementById('overlay');
    overlay.style.display = 'block';
}



window.monitorControlWindow = monitorControlWindow;
window.startPresentation = startPresentation;
window.setupSyncBetweenWindows = setupSyncBetweenWindows;
window.restoreNormalMode = restoreNormalMode;

window.savePreset = savePreset;
window.deletePreset = deletePreset;
window.applyPreset = applyPreset;
window.updateChart = updateChart;

function updateChart(frequencies = defaultFrequencies, coefficients = defaultCoefficients) {
  if (chart) {
      // Update the existing chart
      chart.data.labels = frequencies;
      chart.data.datasets[0].data = coefficients;
      chart.update();
  } else {
      // Create the chart if it doesn't exist
      const ctx = document.getElementById("rtChart").getContext("2d");

      chart = new Chart(ctx, {
          type: 'line',
          data: {
              labels: frequencies, // X-axis labels
              datasets: [
                  {
                      label: 'RT',
                      data: coefficients,
                      borderColor: '#4CAF50',
                      borderWidth: 2,
                      fill: false,
                      pointRadius: 5,
                      pointBackgroundColor: '#75CFCF',
                  },
              ],
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                  legend: {
                      display: false, // Hide the legend
                  },
                  tooltip: {
                      callbacks: {
                          label: (context) => `${context.raw.toFixed(2)}`, // Format tooltips
                      },
                  },
              },
              scales: {
                  x: {
                      title: {
                          display: true,
                          text: 'Frequency (Hz)',
                      },
                  },
                  y: {
                      beginAtZero: true,
                      title: {
                          display: true,
                          text: 'RT60',
                      },
                  },
              },
          },
      });
  }
}

// Initialize the chart with default values at the beginning
updateChart();

async function deleteMaterial() {
  const selectElement = document.getElementById("selectAbsorberType");
  const materialId = selectElement.value;

  if (!materialId) {
      alert("Please select a material to delete.");
      return;
  }

  if (!confirm("Are you sure you want to delete this material?")) {
      return;
  }

  try {
      const response = await fetch(`/delete_material/${materialId}/`, {
          method: "POST",
          headers: {
              "X-CSRFToken": getCSRFToken() // Function to get CSRF token
          }
      });

      const result = await response.json();

      if (result.success) {
          alert(result.message);
          // Remove the deleted material from the dropdown
          selectElement.querySelector(`option[value="${materialId}"]`).remove();
          selectElement.value = ""; // Reset the dropdown
      } else {
          alert(`Failed to delete material: ${result.error}`);
      }
  } catch (error) {
      console.error("Error deleting material:", error);
  }
}

window.deleteMaterial = deleteMaterial;