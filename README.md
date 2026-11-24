# 3D Voxel Sculptor

A web-based application for generating and viewing 3D geometric shapes built from voxels (3D pixels). It renders entirely in the browser using a self-contained raw-WebGL renderer with no external libraries and no CDNs, so it works fully offline.

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
* **Efficient Rendering:**
    * Builds a single merged vertex buffer for all voxels of a shape, so each shape is drawn in one WebGL draw call rather than one per voxel.
    * Resizes from the canvas container and accounts for `devicePixelRatio` for crisp output.
    * Ambient and directional lighting computed in the shader, plus a reference grid for spatial orientation.
* **User Feedback:**
    * Displays the total number of voxels generated for the current shape.
    * Shows a loading indicator while generating complex shapes.
    * Displays an error message if WebGL initialization or shape generation fails.

## How to Use

1.  **Get the files:** Clone or download this repository (it is a static site with no build step).
2.  **Open:** Open `index.html` in a modern web browser that supports WebGL (Chrome, Firefox, Edge, Safari). Because the app uses ES modules, serve the folder over HTTP rather than opening the file directly from disk (see [Development](#development)).
3.  **Interact:**
    * Use the control panel on the left to select a shape type and adjust the Width, Height, and Depth sliders.
    * Click the "Generate Shape" button to create the shape with the selected parameters.
    * Use the mouse controls (listed in the panel and above) to navigate the 3D scene.

## Technologies Used

* **HTML:** Structure of the web page (`index.html`).
* **CSS:** A small local stylesheet (`styles.css`) for layout and styling. No CSS framework.
* **JavaScript (ES modules):** Core application logic, split into focused modules under `src/`.
* **Raw WebGL:** A self-contained renderer written directly against the browser's WebGL API. There are no external libraries (no Three.js, no OrbitControls), no CDNs, and zero runtime dependencies, so the app loads and runs fully offline.

## Code Structure

* **`index.html`:** Page markup: the control panel (sliders, shape dropdown, Generate button, controls hint, voxel stats) and the viewport containing `#canvas-container` plus the loading and error overlays. Loads `src/app.js` as an ES module.
* **`styles.css`:** Local stylesheet for the layout, controls, canvas container, and overlays.
* **`src/voxel-generators.js`:** Pure shape generators (cube, sphere, circle, cylinder, cone, pyramid) and a dispatch helper. Each returns an array of `[x, y, z]` voxel coordinates with no DOM or WebGL dependency.
* **`src/renderer.js`:** The self-contained raw-WebGL renderer: shader setup, perspective camera, merged-geometry voxel drawing, ambient + directional lighting, reference grid, resize handling, and GL resource teardown.
* **`src/controls.js`:** Orbit-style mouse controls (left-drag rotate, right-drag pan, wheel zoom).
* **`src/math.js`:** Small `mat4`/`vec3` math helpers used by the renderer and controls.
* **`src/app.js`:** Wires the DOM controls to the generators and renderer (slider labels, shape selection, Generate button, voxel count, loading/error state).
* **`test/voxel-generators.test.js`:** `node:test` unit tests for the pure voxel generators.

## Development

This project has **no build step** and **no dependencies to install** (zero runtime dependencies). The npm scripts call tools you may already have installed globally.

* **Run the unit tests:**

    ```sh
    npm test
    ```

    This runs Node's built-in test runner (equivalent to `node --test`) over `test/`.

* **Lint the source:**

    ```sh
    npm run lint
    ```

* **Check formatting:**

    ```sh
    npm run format:check
    ```

* **Serve locally:** ES modules must be loaded over HTTP, so serve the folder and open the printed URL:

    ```sh
    npm run serve
    ```

    This starts a static file server at `http://localhost:8000/` (open `index.html` from there).

    > **Note:** The `serve` script shells out to `python3 -m http.server`, so it
    > needs Python 3 on your `PATH`. It is a development convenience only, not a
    > runtime dependency: any static file server works (for example
    > `npx serve`, `php -S localhost:8000`, or your editor's live-server), and
    > the app itself still has zero runtime dependencies.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
