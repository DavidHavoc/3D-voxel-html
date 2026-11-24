/**
 * Orbit-style camera controls driven by mouse input on a canvas.
 *
 * Mirrors the feel of the previous Three.js OrbitControls:
 *   - left-drag orbits (rotates) around the target,
 *   - right-drag pans the target,
 *   - the scroll wheel zooms (changes orbit distance),
 *   - motion is damped so it eases to a stop.
 *
 * The controls maintain spherical coordinates (azimuth, polar, distance)
 * around a target point and expose the resulting eye position via
 * {@link OrbitControls#getEye} and the target via {@link OrbitControls#target}.
 */

const MIN_POLAR = 0.01;
const MAX_POLAR = Math.PI - 0.01;
const MIN_DISTANCE = 2;
const MAX_DISTANCE = 500;
const DAMPING = 0.12;

export class OrbitControls {
    /**
     * @param {HTMLCanvasElement} canvas - Element to attach listeners to.
     * @param {object} [options] - Optional initial camera placement.
     * @param {number[]} [options.target] - Orbit target `[x, y, z]`.
     * @param {number} [options.distance] - Initial orbit distance.
     * @param {number} [options.azimuth] - Initial azimuth angle in radians.
     * @param {number} [options.polar] - Initial polar angle in radians.
     */
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.target = options.target ? options.target.slice() : [0, 0, 0];

        // Current (rendered) spherical state.
        this.distance = options.distance ?? 35;
        this.azimuth = options.azimuth ?? Math.PI / 4;
        this.polar = options.polar ?? Math.PI / 3;

        // Goal state the current state eases toward (damping).
        this._goalDistance = this.distance;
        this._goalAzimuth = this.azimuth;
        this._goalPolar = this.polar;
        this._goalTarget = this.target.slice();

        this._dragButton = -1;
        this._lastX = 0;
        this._lastY = 0;

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onWheel = this._onWheel.bind(this);
        this._onContextMenu = this._onContextMenu.bind(this);

        // Window-level listeners let a drag continue even when the pointer
        // leaves the canvas. `window` is always present in the browser; the
        // guard only matters under headless test runners that construct the
        // controls with a stub canvas and no global `window`.
        this._view = typeof window !== "undefined" ? window : null;

        canvas.addEventListener("pointerdown", this._onPointerDown);
        if (this._view) {
            this._view.addEventListener("pointermove", this._onPointerMove);
            this._view.addEventListener("pointerup", this._onPointerUp);
        }
        canvas.addEventListener("wheel", this._onWheel, { passive: false });
        canvas.addEventListener("contextmenu", this._onContextMenu);
    }

    _onPointerDown(event) {
        this._dragButton = event.button;
        this._lastX = event.clientX;
        this._lastY = event.clientY;
    }

    _onPointerMove(event) {
        if (this._dragButton < 0) {
            return;
        }
        const dx = event.clientX - this._lastX;
        const dy = event.clientY - this._lastY;
        this._lastX = event.clientX;
        this._lastY = event.clientY;

        if (this._dragButton === 0) {
            // Left-drag: orbit.
            this._goalAzimuth -= dx * 0.01;
            this._goalPolar -= dy * 0.01;
            this._goalPolar = Math.min(MAX_POLAR, Math.max(MIN_POLAR, this._goalPolar));
        } else if (this._dragButton === 2) {
            // Right-drag: pan in the camera's screen plane.
            this._pan(dx, dy);
        }
    }

    _onPointerUp() {
        this._dragButton = -1;
    }

    _onWheel(event) {
        event.preventDefault();
        const factor = Math.exp(event.deltaY * 0.001);
        this._goalDistance = Math.min(
            MAX_DISTANCE,
            Math.max(MIN_DISTANCE, this._goalDistance * factor)
        );
    }

    _onContextMenu(event) {
        // Suppress the browser menu so right-drag panning is usable.
        event.preventDefault();
    }

    /**
     * Pan the orbit target along the camera's right and up axes.
     * @param {number} dx - Horizontal pointer delta in pixels.
     * @param {number} dy - Vertical pointer delta in pixels.
     */
    _pan(dx, dy) {
        const eye = this.getEye();
        let fx = this.target[0] - eye[0];
        let fy = this.target[1] - eye[1];
        let fz = this.target[2] - eye[2];
        const flen = Math.hypot(fx, fy, fz) || 1;
        fx /= flen;
        fy /= flen;
        fz /= flen;

        // Horizontal screen-right axis in the ground plane. For forward
        // (fx,fy,fz) and world up (0,1,0) this is (fz, 0, -fx), so dragging
        // horizontally moves the target horizontally regardless of tilt.
        let rx = fz;
        let ry = 0;
        let rz = -fx;
        const rlen = Math.hypot(rx, ry, rz) || 1;
        rx /= rlen;
        ry /= rlen;
        rz /= rlen;

        // up = right x forward
        const ux = ry * fz - rz * fy;
        const uy = rz * fx - rx * fz;
        const uz = rx * fy - ry * fx;

        const speed = this._goalDistance * 0.0015;
        const moveX = -dx * speed;
        const moveY = dy * speed;

        this._goalTarget[0] += rx * moveX + ux * moveY;
        this._goalTarget[1] += ry * moveX + uy * moveY;
        this._goalTarget[2] += rz * moveX + uz * moveY;
    }

    /**
     * Advance the damped interpolation toward the goal state. Call once per
     * frame before reading {@link OrbitControls#getEye}.
     */
    update() {
        this.azimuth += (this._goalAzimuth - this.azimuth) * DAMPING;
        this.polar += (this._goalPolar - this.polar) * DAMPING;
        this.distance += (this._goalDistance - this.distance) * DAMPING;
        this.target[0] += (this._goalTarget[0] - this.target[0]) * DAMPING;
        this.target[1] += (this._goalTarget[1] - this.target[1]) * DAMPING;
        this.target[2] += (this._goalTarget[2] - this.target[2]) * DAMPING;
    }

    /**
     * Compute the current camera eye position from the spherical state.
     * @returns {number[]} The eye position `[x, y, z]`.
     */
    getEye() {
        const sinPolar = Math.sin(this.polar);
        return [
            this.target[0] + this.distance * sinPolar * Math.sin(this.azimuth),
            this.target[1] + this.distance * Math.cos(this.polar),
            this.target[2] + this.distance * sinPolar * Math.cos(this.azimuth),
        ];
    }

    /**
     * Frame a subject: set the goal target and goal orbit distance so the
     * current state eases toward them on the next {@link OrbitControls#update}.
     * This is the public entry point for callers (such as the renderer) that
     * want to recenter the camera without touching internal goal state.
     *
     * @param {number[]} target - New orbit target `[x, y, z]`.
     * @param {number} distance - New orbit distance (clamped to the allowed range).
     */
    frame(target, distance) {
        this._goalTarget = [target[0], target[1], target[2]];
        this._goalDistance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, distance));
    }

    /** Detach all event listeners added by this instance. */
    dispose() {
        this.canvas.removeEventListener("pointerdown", this._onPointerDown);
        if (this._view) {
            this._view.removeEventListener("pointermove", this._onPointerMove);
            this._view.removeEventListener("pointerup", this._onPointerUp);
        }
        this.canvas.removeEventListener("wheel", this._onWheel);
        this.canvas.removeEventListener("contextmenu", this._onContextMenu);
    }
}
