/**
 * Self-contained raw-WebGL renderer for the 3D Voxel Sculptor.
 *
 * This replaces the former Three.js renderer entirely. It has no external
 * dependency: it obtains a WebGL2 (or WebGL1) context, compiles a single
 * shader program with ambient + directional Lambert lighting (approximating
 * the old `MeshLambertMaterial` look in accent color `0xAC1754`), and draws
 * an entire voxel shape from one merged position/normal vertex buffer in a
 * single draw call. A reference grid is drawn with a second small program.
 *
 * Lifecycle: construct once with a container element, call
 * {@link WebGLRenderer#setVoxels} whenever the shape changes,
 * {@link WebGLRenderer#resize} on layout changes, {@link WebGLRenderer#render}
 * each frame, and {@link WebGLRenderer#dispose} to release every GL resource.
 */

import { mat4Perspective, mat4LookAt, mat4Multiply, vec3Normalize } from "./math.js";
import { OrbitControls } from "./controls.js";

const ACCENT = [0xac / 255, 0x17 / 255, 0x54 / 255];

// Unit-cube geometry: 6 faces, each a quad (2 triangles), with per-face
// normals so lighting reads as flat-shaded cube faces. Positions are offsets
// in [0, 1] from a voxel's lower corner.
const CUBE_FACES = [
    // normal, then 4 corners (CCW) of the face
    {
        n: [0, 0, 1],
        v: [
            [0, 0, 1],
            [1, 0, 1],
            [1, 1, 1],
            [0, 1, 1],
        ],
    }, // front (+z)
    {
        n: [0, 0, -1],
        v: [
            [1, 0, 0],
            [0, 0, 0],
            [0, 1, 0],
            [1, 1, 0],
        ],
    }, // back (-z)
    {
        n: [0, 1, 0],
        v: [
            [0, 1, 1],
            [1, 1, 1],
            [1, 1, 0],
            [0, 1, 0],
        ],
    }, // top (+y)
    {
        n: [0, -1, 0],
        v: [
            [0, 0, 0],
            [1, 0, 0],
            [1, 0, 1],
            [0, 0, 1],
        ],
    }, // bottom (-y)
    {
        n: [1, 0, 0],
        v: [
            [1, 0, 1],
            [1, 0, 0],
            [1, 1, 0],
            [1, 1, 1],
        ],
    }, // right (+x)
    {
        n: [-1, 0, 0],
        v: [
            [0, 0, 0],
            [0, 0, 1],
            [0, 1, 1],
            [0, 1, 0],
        ],
    }, // left (-x)
];

const VOXEL_VERTEX_SRC = `
precision highp float;
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uModelView;
uniform mat4 uProjection;
varying vec3 vNormal;
void main() {
    vNormal = aNormal;
    gl_Position = uProjection * uModelView * vec4(aPosition, 1.0);
}
`;

const VOXEL_FRAGMENT_SRC = `
precision highp float;
varying vec3 vNormal;
uniform vec3 uColor;
uniform vec3 uLightDir;
uniform float uAmbient;
void main() {
    vec3 n = normalize(vNormal);
    float diffuse = max(dot(n, normalize(uLightDir)), 0.0);
    float light = uAmbient + (1.0 - uAmbient) * diffuse;
    gl_FragColor = vec4(uColor * light, 1.0);
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

        this.voxelProgram = this._createProgram(VOXEL_VERTEX_SRC, VOXEL_FRAGMENT_SRC);
        this.gridProgram = this._createProgram(GRID_VERTEX_SRC, GRID_FRAGMENT_SRC);

        this.voxelBuffer = gl.createBuffer();
        this.vertexCount = 0;

        this.gridBuffer = gl.createBuffer();
        this.gridVertexCount = 0;
        this._buildGrid(50, 50);

        this.projection = null;
        this.controls = new OrbitControls(this.canvas);

        gl.enable(gl.DEPTH_TEST);
        gl.clearColor(0, 0, 0, 1);

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
            lines.push(-half, 0, p, half, 0, p);
            lines.push(p, 0, -half, p, 0, half);
        }
        this.gridVertexCount = lines.length / 3;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.gridBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lines), gl.STATIC_DRAW);
    }

    /**
     * Replace the rendered shape with a new voxel list. The voxels are merged
     * into one interleaved position/normal buffer so the whole shape draws in
     * a single call. Voxels are centered on the origin using the volume size.
     *
     * @param {Array<[number, number, number]>} list - Voxel coordinates.
     * @param {number} width - Volume width (for centering).
     * @param {number} height - Volume height (for centering).
     * @param {number} depth - Volume depth (for centering).
     */
    setVoxels(list, width, height, depth) {
        const gl = this.gl;
        const gap = 0.025; // leaves a 0.95 cube like the original BoxGeometry
        const data = new Float32Array(list.length * CUBE_FACES.length * 6 * 6);
        let o = 0;

        const offX = width / 2;
        const offY = height / 2;
        const offZ = depth / 2;

        for (let i = 0; i < list.length; i++) {
            const bx = list[i][0] - offX + gap;
            const by = list[i][1] - offY + gap;
            const bz = list[i][2] - offZ + gap;

            for (let f = 0; f < CUBE_FACES.length; f++) {
                const face = CUBE_FACES[f];
                const n = face.n;
                const c = face.v;
                // Two triangles: 0,1,2 and 0,2,3.
                const order = [0, 1, 2, 0, 2, 3];
                for (let k = 0; k < order.length; k++) {
                    const corner = c[order[k]];
                    data[o++] = bx + corner[0] * (1 - gap * 2);
                    data[o++] = by + corner[1] * (1 - gap * 2);
                    data[o++] = bz + corner[2] * (1 - gap * 2);
                    data[o++] = n[0];
                    data[o++] = n[1];
                    data[o++] = n[2];
                }
            }
        }

        this.vertexCount = list.length * CUBE_FACES.length * 6;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.voxelBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

        // Frame the shape: point the controls at the origin and size the orbit
        // distance to the volume so the whole thing stays visible.
        const span = Math.max(width, height, depth, 1);
        this.controls.target = [0, 0, 0];
        this.controls._goalTarget = [0, 0, 0];
        this.controls._goalDistance = Math.max(span * 2.2, 10);
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
        const aspect = cssWidth / Math.max(1, cssHeight);
        this.projection = mat4Perspective((75 * Math.PI) / 180, aspect, 0.1, 1000);
    }

    /** Render one frame using the current controls and voxel buffer. */
    render() {
        const gl = this.gl;
        this.controls.update();
        const eye = this.controls.getEye();
        const view = mat4LookAt(eye, this.controls.target, [0, 1, 0]);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Reference grid.
        gl.useProgram(this.gridProgram);
        this._setMatrix(this.gridProgram, view);
        gl.uniform3f(gl.getUniformLocation(this.gridProgram, "uColor"), 0.33, 0.33, 0.33);
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
            const lightDir = vec3Normalize([10, 20, 10]);
            gl.uniform3f(
                gl.getUniformLocation(this.voxelProgram, "uLightDir"),
                lightDir[0],
                lightDir[1],
                lightDir[2]
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
        }
    }

    /**
     * Upload the model-view-projection pair to a program.
     * @param {WebGLProgram} program - Active program.
     * @param {Float32Array} view - The view matrix.
     */
    _setMatrix(program, view) {
        const gl = this.gl;
        const mv = mat4Multiply(view, this._identity());
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "uModelView"), false, mv);
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "uProjection"), false, this.projection);
    }

    /**
     * Identity model matrix (voxels are pre-transformed into world space).
     * @returns {Float32Array} A column-major identity matrix.
     */
    _identity() {
        const m = new Float32Array(16);
        m[0] = 1;
        m[5] = 1;
        m[10] = 1;
        m[15] = 1;
        return m;
    }

    /** Release every GL resource and detach control listeners. */
    dispose() {
        const gl = this.gl;
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
