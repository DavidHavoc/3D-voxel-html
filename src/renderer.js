/**
 * Self-contained raw-WebGL renderer for the 3D Voxel Sculptor.
 *
 * Draws exposed voxel faces and a reference grid when the model, camera,
 * or viewport changes.
 */

import { mat4Perspective, mat4LookAt, perspectiveFitDistance, vec3Normalize } from "./math.js";
import { OrbitControls } from "./controls.js";
import { buildVoxelMesh } from "./voxel-mesh.js";

const ACCENT = [0.46, 0.86, 0.7];
const LIGHT_DIRECTION = vec3Normalize([10, 20, 10]);
const FOV = (52 * Math.PI) / 180;
const GRID_Y = -0.025;

const VOXEL_VERTEX_SRC = `
precision highp float;
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uModelView;
uniform mat4 uProjection;
uniform vec3 uVoxelOffset;
varying vec3 vNormal;
varying vec3 vGridPosition;
void main() {
    vNormal = aNormal;
    vGridPosition = aPosition + uVoxelOffset;
    gl_Position = uProjection * uModelView * vec4(aPosition, 1.0);
}
`;

const VOXEL_FRAGMENT_SRC = `
precision highp float;
varying vec3 vNormal;
varying vec3 vGridPosition;
uniform vec3 uColor;
uniform vec3 uLightDir;
uniform float uAmbient;
void main() {
    vec3 n = normalize(vNormal);
    float diffuse = max(dot(n, normalize(uLightDir)), 0.0);
    float light = uAmbient + (1.0 - uAmbient) * diffuse;
    vec3 edge = abs(fract(vGridPosition) - 0.5) * (1.0 - abs(n));
    float seam = smoothstep(0.43, 0.495, max(edge.x, max(edge.y, edge.z)));
    gl_FragColor = vec4(uColor * light * mix(1.0, 0.67, seam), 1.0);
}
`;

const GRID_VERTEX_SRC = `
precision highp float;
attribute vec3 aPosition;
uniform mat4 uModelView;
uniform mat4 uProjection;
void main() {
    gl_Position = uProjection * uModelView * vec4(aPosition, 1.0);
}
`;

const GRID_FRAGMENT_SRC = `
precision highp float;
uniform vec3 uColor;
void main() {
    gl_FragColor = vec4(uColor, 1.0);
}
`;

export class WebGLRenderer {
    /**
     * @param {HTMLElement} container - Element the canvas is appended to.
     * @throws {Error} If no WebGL context can be created.
     */
    constructor(container) {
        this.container = container;

        this.canvas = document.createElement("canvas");
        container.appendChild(this.canvas);

        const gl =
            this.canvas.getContext("webgl2") ||
            this.canvas.getContext("webgl") ||
            this.canvas.getContext("experimental-webgl");
        if (!gl) {
            this.canvas.remove();
            throw new Error("WebGL is not supported by this browser.");
        }
        this.gl = gl;
        this.canvas.tabIndex = 0;
        this.canvas.setAttribute(
            "aria-label",
            "3D model. Use arrow keys to orbit, Shift and arrow keys to pan, and plus or minus to zoom."
        );

        this.voxelProgram = this._createProgram(VOXEL_VERTEX_SRC, VOXEL_FRAGMENT_SRC);
        this.gridProgram = this._createProgram(GRID_VERTEX_SRC, GRID_FRAGMENT_SRC);

        this.voxelBuffer = gl.createBuffer();
        this.vertexCount = 0;

        this.gridBuffer = gl.createBuffer();
        this.gridVertexCount = 0;
        this._buildGrid(50, 50);

        this.frameId = null;
        this.dimensions = null;
        this.controls = new OrbitControls(this.canvas, { onChange: () => this.requestRender() });

        gl.enable(gl.DEPTH_TEST);
        gl.clearColor(0.055, 0.078, 0.09, 1);

        this.resize(container.clientWidth, container.clientHeight, window.devicePixelRatio || 1);
    }

    /**
     * Compile and link a shader program.
     * @param {string} vsSrc - Vertex shader source.
     * @param {string} fsSrc - Fragment shader source.
     * @returns {WebGLProgram} The linked program.
     */
    _createProgram(vsSrc, fsSrc) {
        const gl = this.gl;
        const vs = this._compileShader(gl.VERTEX_SHADER, vsSrc);
        const fs = this._compileShader(gl.FRAGMENT_SHADER, fsSrc);
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        // Shaders are flagged for deletion; they are freed once detached with
        // the program at dispose time.
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const log = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            throw new Error("Shader link failed: " + log);
        }
        return program;
    }

    /**
     * Compile a single shader stage.
     * @param {number} type - `gl.VERTEX_SHADER` or `gl.FRAGMENT_SHADER`.
     * @param {string} src - Shader source.
     * @returns {WebGLShader} The compiled shader.
     */
    _compileShader(type, src) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error("Shader compile failed: " + log);
        }
        return shader;
    }

    /**
     * Build the reference grid lines into the grid buffer.
     * @param {number} size - Total grid extent in world units.
     * @param {number} divisions - Number of grid cells per axis.
     */
    _buildGrid(size, divisions) {
        const gl = this.gl;
        const half = size / 2;
        const stepSize = size / divisions;
        const lines = [];
        for (let i = 0; i <= divisions; i++) {
            const p = -half + i * stepSize;
            lines.push(-half, GRID_Y, p, half, GRID_Y, p);
            lines.push(p, GRID_Y, -half, p, GRID_Y, half);
        }
        this.gridVertexCount = lines.length / 3;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.gridBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lines), gl.STATIC_DRAW);
    }

    /**
     * Replace the rendered shape with a new voxel list. The voxels are merged
     * into one interleaved position/normal buffer so the whole shape draws in
     * a single call. Voxels sit on the ground and are centered horizontally.
     *
     * @param {Array<[number, number, number]>} list - Voxel coordinates.
     * @param {number} width - Volume width (for centering).
     * @param {number} height - Volume height.
     * @param {number} depth - Volume depth (for centering).
     */
    setVoxels(list, width, height, depth) {
        const gl = this.gl;
        const data = buildVoxelMesh(list, width, height, depth);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.voxelBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        this.vertexCount = data.length / 6;
        this.dimensions = [width, height, depth];
        this.fitView(true);
    }

    /** Fit the current model while retaining the viewing angle. */
    fitView(immediate = false) {
        if (!this.dimensions) {
            return;
        }
        const radius = Math.hypot(...this.dimensions) / 2;
        const distance = perspectiveFitDistance(radius, FOV, this.aspect);
        this.controls.frame([0, this.dimensions[1] / 2, 0], distance * 1.12, immediate);
    }

    zoom(factor) {
        this.controls.zoom(factor);
    }

    /**
     * Resize the canvas, backing store, and projection matrix.
     * @param {number} cssWidth - CSS pixel width of the container.
     * @param {number} cssHeight - CSS pixel height of the container.
     * @param {number} dpr - Device pixel ratio to apply.
     */
    resize(cssWidth, cssHeight, dpr) {
        const gl = this.gl;
        const w = Math.max(1, Math.floor(cssWidth * dpr));
        const h = Math.max(1, Math.floor(cssHeight * dpr));
        this.canvas.width = w;
        this.canvas.height = h;
        gl.viewport(0, 0, w, h);
        this.aspect = w / h;
        this.projection = mat4Perspective(FOV, this.aspect, 0.1, 1000);
        this.requestRender();
    }

    requestRender() {
        if (this.frameId !== null) {
            return;
        }
        this.frameId = requestAnimationFrame(() => {
            this.frameId = null;
            if (this.render()) {
                this.requestRender();
            }
        });
    }

    /** Render one frame using the current controls and voxel buffer. */
    render() {
        const gl = this.gl;
        const moving = this.controls.update();
        const eye = this.controls.getEye();
        const view = mat4LookAt(eye, this.controls.target, [0, 1, 0]);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Reference grid.
        gl.useProgram(this.gridProgram);
        this._setMatrix(this.gridProgram, view);
        gl.uniform3f(gl.getUniformLocation(this.gridProgram, "uColor"), 0.19, 0.25, 0.25);
        const gridPos = gl.getAttribLocation(this.gridProgram, "aPosition");
        gl.bindBuffer(gl.ARRAY_BUFFER, this.gridBuffer);
        gl.enableVertexAttribArray(gridPos);
        gl.vertexAttribPointer(gridPos, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.LINES, 0, this.gridVertexCount);

        // Voxels.
        if (this.vertexCount > 0) {
            gl.useProgram(this.voxelProgram);
            this._setMatrix(this.voxelProgram, view);
            gl.uniform3f(
                gl.getUniformLocation(this.voxelProgram, "uColor"),
                ACCENT[0],
                ACCENT[1],
                ACCENT[2]
            );
            gl.uniform3f(gl.getUniformLocation(this.voxelProgram, "uLightDir"), ...LIGHT_DIRECTION);
            gl.uniform3f(
                gl.getUniformLocation(this.voxelProgram, "uVoxelOffset"),
                this.dimensions[0] / 2,
                0,
                this.dimensions[2] / 2
            );
            gl.uniform1f(gl.getUniformLocation(this.voxelProgram, "uAmbient"), 0.5);

            const stride = 6 * 4;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.voxelBuffer);
            const posLoc = gl.getAttribLocation(this.voxelProgram, "aPosition");
            const normLoc = gl.getAttribLocation(this.voxelProgram, "aNormal");
            gl.enableVertexAttribArray(posLoc);
            gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, stride, 0);
            gl.enableVertexAttribArray(normLoc);
            gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, stride, 3 * 4);
            gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
            gl.disableVertexAttribArray(normLoc);
        }
        return moving;
    }

    /**
     * Upload the model-view-projection pair to a program.
     * @param {WebGLProgram} program - Active program.
     * @param {Float32Array} view - The view matrix.
     */
    _setMatrix(program, view) {
        const gl = this.gl;
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "uModelView"), false, view);
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "uProjection"), false, this.projection);
    }

    /** Release every GL resource and detach control listeners. */
    dispose() {
        const gl = this.gl;
        if (this.frameId !== null) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
        if (this.controls) {
            this.controls.dispose();
            this.controls = null;
        }
        if (this.voxelBuffer) {
            gl.deleteBuffer(this.voxelBuffer);
            this.voxelBuffer = null;
        }
        if (this.gridBuffer) {
            gl.deleteBuffer(this.gridBuffer);
            this.gridBuffer = null;
        }
        if (this.voxelProgram) {
            gl.deleteProgram(this.voxelProgram);
            this.voxelProgram = null;
        }
        if (this.gridProgram) {
            gl.deleteProgram(this.gridProgram);
            this.gridProgram = null;
        }
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        this.vertexCount = 0;
    }
}
