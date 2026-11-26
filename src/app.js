import { generateVoxels } from "./voxel-generators.js";
import { WebGLRenderer } from "./renderer.js";

const form = document.getElementById("model-form");
const shape = document.getElementById("shape");
const container = document.getElementById("canvas-container");
const errorMessage = document.getElementById("errorMsg");
const modelName = document.getElementById("model-name");
const modelDimensions = document.getElementById("model-dimensions");
const voxelCount = document.getElementById("voxelCount");
const zoomIn = document.getElementById("zoom-in");
const zoomOut = document.getElementById("zoom-out");
const fitView = document.getElementById("fit-view");
const circleNote = document.getElementById("circle-note");

const dimensions = ["width", "height", "depth"].map((axis) => ({
    number: document.getElementById(axis),
    slider: document.getElementById(axis + "Range"),
}));
const heightControl = dimensions[1];

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.hidden = !message;
}

function syncShapeOptions() {
    const isCircle = shape.value === "circle";
    heightControl.number.disabled = isCircle;
    heightControl.slider.disabled = isCircle;
    circleNote.hidden = !isCircle;
}

function init() {
    let renderer;
    try {
        renderer = new WebGLRenderer(container);
    } catch (error) {
        showError("Could not start the 3D preview. " + error.message);
        for (const control of [...form.elements, zoomIn, zoomOut, fitView]) {
            control.disabled = true;
        }
        return;
    }

    function generateShape() {
        const [width, height, depth] = dimensions.map(({ number }) =>
            number.disabled ? 1 : number.valueAsNumber
        );
        try {
            const voxels = generateVoxels(shape.value, width, height, depth);
            renderer.setVoxels(voxels, width, height, depth);
            modelName.textContent = shape.selectedOptions[0].text;
            modelDimensions.textContent = [width, height, depth].join(" × ");
            voxelCount.textContent = voxels.length.toLocaleString();
            showError("");
        } catch (error) {
            showError("Could not generate the shape. " + error.message);
        }
    }

    for (const { number, slider } of dimensions) {
        number.addEventListener("input", () => {
            if (number.validity.valid) {
                slider.value = String(number.valueAsNumber);
            }
        });
        slider.addEventListener("input", () => {
            number.value = slider.value;
        });
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        generateShape();
    });
    shape.addEventListener("change", syncShapeOptions);
    zoomIn.addEventListener("click", () => renderer.zoom(1 / 1.2));
    zoomOut.addEventListener("click", () => renderer.zoom(1.2));
    fitView.addEventListener("click", () => renderer.fitView());
    window.addEventListener("resize", () => {
        renderer.resize(
            container.clientWidth,
            container.clientHeight,
            window.devicePixelRatio || 1
        );
    });

    syncShapeOptions();
    if (form.checkValidity()) {
        generateShape();
    }
}

init();
