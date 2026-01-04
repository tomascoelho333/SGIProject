import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// Global variables
let gltf;
let animationMixer;
const clock = new THREE.Clock();

// Setup scene
const scene = new THREE.Scene();
scene.background = new THREE.Color("white");

// Canvas
const canvasContainer = document.querySelector('.canvas');
let canvasWidth = canvasContainer ? canvasContainer.offsetWidth : window.innerWidth * 0.35;
let canvasHeight = canvasContainer ? canvasContainer.offsetWidth : window.innerWidth * 0.35;


// Setup texture
const textureLoader = new THREE.TextureLoader();

function changeObjectTexture(objectName, imagePath) {
    if (!gltf) return;

    const object = gltf.scene.getObjectByName(objectName);

    if (object) {
        // new texture
        textureLoader.load(imagePath, (texture) => {
            
            texture.colorSpace = THREE.SRGBColorSpace; 
            texture.flipY = false;
            object.material.map = texture;
            object.material.needsUpdate = true;
            
            console.log(`Texture Applied to ${objectName}`);
        });
    } else {
        console.error("Error loading texture");
    }
}


// Camera
const camera = new THREE.PerspectiveCamera(
  45,
  canvasWidth / canvasHeight,
  0.1,
  1000
);
camera.position.set(0, 3, 4);
camera.lookAt(0, 0, 0);

// Renderer
const canvas = document.getElementById("canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setSize(canvasWidth, canvasHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.enableDamping = true;
controls.minDistance = 2;
controls.maxDistance = 10;

// Light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 5);
dirLight.castShadow = true;
scene.add(dirLight);

// Load the model
const loader = new GLTFLoader();

// Helper vars to store set values
const animationActions = {};
const toggles = {};
// Manual rotation helper vars
let diskSpinning = false;
let diskObject = null;

// Helper var to get the default texture
let originalBaseTexture = null;


loader.load("../models/RecordPlayer.glb", (loadedGLTF) => {
    gltf = loadedGLTF;
    scene.add(gltf.scene);

    // Augment model
    gltf.scene.scale.set(4, 4, 4);

    const baseObject = gltf.scene.getObjectByName("Base");

    //default texture
    originalBaseTexture = baseObject.material.map;

    gltf.scene.traverse((node) => {
        if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
            if (node.name.includes("VinylDisk")) {
                diskObject = node;
            }
        }
    });

    animationMixer = new THREE.AnimationMixer(gltf.scene);

    // Set up animations
    ['DustCover_Close', 'DiskSpin', 'ButtonPush', 'PickupPlace'].forEach(name => {
        const clip = THREE.AnimationClip.findByName(gltf.animations, name);
        if (clip) {
            const action = animationMixer.clipAction(clip);

            if (name === "DiskSpin") {
                action.clampWhenFinished = false;
            } else if (name === "ButtonPush") {
                action.setLoop(THREE.LoopOnce);
                action.clampWhenFinished = true;
            } else {
                action.setLoop(THREE.LoopOnce);
                action.clampWhenFinished = true;
            }

            animationActions[name] = action;
            toggles[name] = false;
        }
    });
});

// Sidebar buttons
const btnReset = document.getElementById("btn_reset");
const btnFront = document.getElementById("btn_front_view");
const btnTop = document.getElementById("btn_top_view");
const btnLeft = document.getElementById("btn_left_view");
const btnRight = document.getElementById("btn_right_view");
const intensitySlider = document.getElementById("intensitySlider");
const intensityMax = document.getElementById("btn_light_on");
const intensityMin = document.getElementById("btn_light_off");


// Texture buttons
const btnTexture1 = document.getElementById("btn_texture_1");
const btnTexture2 = document.getElementById("btn_texture_2");


// Light Buttons
if (intensityMin) {
    intensityMin.addEventListener("click", () => {
        ambientLight.intensity = 0;
    });
}


if (intensityMax) {
    intensityMax.addEventListener("click", () => {
        ambientLight.intensity = 1;
    });
}

// Texture methods
if (btnTexture1) {
    btnTexture1.addEventListener("click", () => {
        changeObjectTexture("Base", "models/materials/plastic.png"); 
    });
}

if (btnTexture2) {
    btnTexture2.addEventListener("click", () => {
        changeObjectTexture("Base", "models/materials/carbon.png");
    });
}

btnReset?.addEventListener("click", resetScene);
btnFront?.addEventListener("click", () => moveCamera(0, 3, 4));
btnTop?.addEventListener("click", () => moveCamera(0, 10, 0));
btnLeft?.addEventListener("click", () => moveCamera(-5, 3, 0));
btnRight?.addEventListener("click", () => moveCamera(5, 3, 0));

intensitySlider?.addEventListener("input", (e) => {
    ambientLight.intensity = parseFloat(e.target.value);
    //console.log(ambientLight.intensity);
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    if (!gltf) return;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(gltf.scene.children, true);
    if (intersects.length > 0) {
        const objectName = intersects[0].object.name;
        console.log("Clicked object:", objectName);

        if (objectName.includes("DustCover")) {
            toggleAnimation("DustCover_Close");
        } else if (objectName.includes("VolumeControl")) {
            diskSpinning = !diskSpinning; // Alters
            toggleAnimation("ButtonPush");
        } else if (objectName.includes("Pickup")) {
            toggleAnimation("PickupPlace");
        }
    }
});

// Animation toggle (1 to start, -1 to reverse)
function toggleAnimation(name) {
    const action = animationActions[name];
    if (!action) return;

    toggles[name] = !toggles[name];

    if (name === "DiskSpin") {
        // The disk is controlled manually in animate()
        return;
    } else {
        // The others are toggled (-1 plays the animation in reverse)
        action.reset();
        action.time = toggles[name] ? 0 : action.getClip().duration;
        action.timeScale = toggles[name] ? 1 : -1;
        action.play();
    }
}

function moveCamera(x, y, z) {
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
    controls.update();
}

function resetScene() {
    const baseObject = gltf.scene.getObjectByName("Base");
    baseObject.material.map = originalBaseTexture;
    moveCamera(0, 3, 4);
    ambientLight.intensity = 0.5;
    if (intensitySlider) intensitySlider.value = 0.5;
    animationMixer?.stopAllAction();
    diskSpinning = false;

    Object.keys(toggles).forEach(k => toggles[k] = false);
}

//Animation Loop
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    animationMixer?.update(delta);

    // Manual Disk Rotation so the animation doesnt look weird
    if (diskSpinning && diskObject) {
        diskObject.rotation.y -= delta * 3 ;
    }

    controls.update();
    renderer.render(scene, camera);
}

animate();