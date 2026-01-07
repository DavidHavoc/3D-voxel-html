# 3D Voxel Sculptor

This is a simple web-based application that allows users to generate and view various 3D geometric shapes composed of voxels (3D pixels). It uses the Three.js library for 3D rendering and Tailwind CSS for styling the user interface.
live demo(not working for now): https://david.zhorzholiani.com/voxel

## Features

* **Shape Generation:** Generate predefined 3D shapes:
    * Cube
    * Sphere
    * Circle 
    * Cylinder
    * Cone
    * Square Pyramid
* **Customizable Dimensions:** Adjust the Width, Height, and Depth of the generation volume (1-32 units each) using sliders.
* **Interactive 3D View:**
    * Rotate the view: Left-click and drag.
    * Pan the view: Right-click and drag.
    * Zoom in/out: Scroll wheel.
* **Performance Optimizations:**
    * Uses `THREE.InstancedMesh` for rendering large numbers of voxels (>5000) when supported, improving performance.
    * Attempts to use merged `BufferGeometry` for very large voxel counts (>10000) as a fallback.
    * Reduces detail (`step` > 1) when generating complex shapes (Sphere, Cylinder, Cone) in large dimensions (`totalVoxels` >= 15000) to speed up calculation.
    * Displays a simplified bounding box representation if detailed rendering becomes too complex or fails.
* **User Feedback:**
    * Displays the total number of voxels generated for the current shape.
    * Shows a loading indicator while generating complex shapes.
    * Displays error messages if WebGL initialization or shape generation fails.
* **Basic Scene Setup:** Includes ambient and directional lighting, and a grid helper for spatial reference.

## How to Use

1.  **Download:** Make sure you have the `index.html` file.
2.  **Open:** Open the `index.html` file in a modern web browser (like Chrome, Firefox, Edge, Safari) that supports WebGL.
3.  **Interact:**
    * Use the control panel on the left to select a shape type and adjust the Width, Height, and Depth sliders.
    * Click the "Generate Shape" button to create the shape with the selected parameters.
    * Use the mouse controls (listed in the panel and above) to navigate the 3D scene.

## Technologies Used

* **HTML:** Structure of the web page.
* **Tailwind CSS (v2.2.19):** Utility-first CSS framework for styling (loaded via CDN).
* **JavaScript:** Core application logic.
* **Three.js (v0.137.0):** 3D graphics library for rendering the scene and voxels (loaded via CDN).
* **Three.js OrbitControls:** Add-on for easy mouse-based camera navigation (loaded via CDN).

## Code Structure (`index.html`)

* **`<head>`:** Includes metadata, title, links to Tailwind CSS and Three.js libraries.
* **`<body>`:**
    * **Control Panel (`div.w-64`):** Contains sliders, dropdown, button, control instructions, and stats display.
    * **3D Canvas (`div.flex-1`):** Contains the `div#canvas-container` where the Three.js renderer outputs, plus overlays for loading and error messages.
* **`<script>`:** Contains all the JavaScript code:
    * Global variables for Three.js components (`scene`, `camera`, etc.) and `voxels`.
    * `init()`: Sets up the Three.js scene, renderer, camera, controls, lights, and initial shape.
    * `animate()`: The main render loop.
    * `onWindowResize()`: Handles browser window resizing.
    * `generateShape()`: Core logic triggered by the button; clears old shape, calls specific generation functions, and handles rendering optimizations.
    * `createIndividualVoxels()`: Renders shapes using individual meshes or merged geometry.
    * `createSimplifiedRepresentation()`: Fallback for extremely large/complex shapes.
    * `clearVoxels()`: Removes previous voxels from the scene and cleans up resources.
    * `generate[ShapeName]()`: Functions implementing the mathematical logic for each shape type.
    * `showLoading()`, `showError()`: UI helper functions.
    * Initialization code (`window.onload`): Calls `init()` and sets up the button event listener.
 
## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
