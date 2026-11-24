/**
 * DOM wiring for the 3D Voxel Sculptor.
 *
 * Reads the slider/select controls, drives the pure voxel generators, feeds
 * the resulting voxel list to the raw-WebGL renderer, runs the render loop,
 * and manages the loading/error UI. All events are bound with
 * `addEventListener`; there are no inline handlers.
 */

import { generateVoxels } from "./voxel-generators.js";
import { WebGLRenderer } from "./renderer.js";

/** Volumes with more cells than this are generated at reduced detail. */
const HIGH_DETAIL_THRESHOLD = 15000;
const ERROR_TIMEOUT_MS = 5000;

const elements = {
    width: document.getElementById("width"),
    height: document.getElementById("height"),
    depth: document.getElementById("depth"),
    widthValue: document.getElementById("widthValue"),
    heightValue: document.getElementById("heightValue"),
    depthValue: document.getElementById("depthValue"),
    shape: document.getElementById("shape"),
    generateBtn: document.getElementById("generateBtn"),
    container: document.getElementById("canvas-container"),
    loading: document.getElementById("loading"),
    errorMsg: document.getElementById("errorMsg"),
    voxelCount: document.getElementById("voxelCount"),
};

let renderer = null;
let errorTimer = null;

/**
 * Show or hide the loading overlay using the shared `.hidden` class.
 * @param {boolean} visible - True to show the overlay, false to hide it.
 */
function showLoading(visible) {
    elements.loading.classList.toggle("hidden", !visible);
}

/**
 * Display an error toast that auto-hides after a timeout.
 * @param {string} message - Text to display.
 */
function showError(message) {
    elements.errorMsg.textContent = message;
    elements.errorMsg.classList.remove("hidden");
    if (errorTimer !== null) {
        clearTimeout(errorTimer);
    }
    errorTimer = setTimeout(() => {
        elements.errorMsg.classList.add("hidden");
        errorTimer = null;
    }, ERROR_TIMEOUT_MS);
}

/** Read the controls, regenerate the shape, and update the renderer. */
function generateShape() {
    showLoading(true);

    const width = parseInt(elements.width.value, 10);
    const height = parseInt(elements.height.value, 10);
    const depth = parseInt(elements.depth.value, 10);
    const shapeType = elements.shape.value;

    const totalVoxels = width * height * depth;
    const highDetail = totalVoxels < HIGH_DETAIL_THRESHOLD;

    let voxelList;
    try {
        voxelList = generateVoxels(shapeType, width, height, depth, highDetail);
    } catch (e) {
        showError("Error generating shape: " + e.message);
        showLoading(false);
        return;
    }

    renderer.setVoxels(voxelList, width, height, depth);
    elements.voxelCount.textContent = String(voxelList.length);
    showLoading(false);
}

/** Resize the renderer to the container using the device pixel ratio. */
function handleResize() {
    if (!renderer) {
        return;
    }
    renderer.resize(
        elements.container.clientWidth,
        elements.container.clientHeight,
        window.devicePixelRatio || 1
    );
}

/** Bind all DOM events. */
function bindEvents() {
    const sliders = [
        [elements.width, elements.widthValue],
        [elements.height, elements.heightValue],
        [elements.depth, elements.depthValue],
    ];
    for (const [slider, label] of sliders) {
        slider.addEventListener("input", () => {
            label.textContent = slider.value;
        });
    }

    elements.generateBtn.addEventListener("click", () => {
        try {
            generateShape();
        } catch (e) {
            showError("Error generating shape: " + e.message);
            showLoading(false);
        }
    });

    window.addEventListener("resize", handleResize);
}

/** Bootstrap the renderer, bind events, and render the default shape. */
function init() {
    showLoading(false);

    try {
        renderer = new WebGLRenderer(elements.container);
    } catch (e) {
        showError("Failed to initialize 3D renderer: " + e.message);
        return;
    }

    bindEvents();
    generateShape();

    const loop = () => {
        renderer.render();
        requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
}

init();
