/**
 * Damped orbit, pan, and zoom controls for a focusable canvas.
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
const SETTLE_DISTANCE = 0.001;
const ARROWS = new Map([
    ["ArrowLeft", [-20, 0]],
    ["ArrowRight", [20, 0]],
    ["ArrowUp", [0, -20]],
    ["ArrowDown", [0, 20]],
]);

function ease(value, goal) {
    const difference = goal - value;
    return Math.abs(difference) <= SETTLE_DISTANCE ? goal : value + difference * DAMPING;
}

export class OrbitControls {
    /**
     * @param {HTMLCanvasElement} canvas - Element to attach listeners to.
     * @param {object} [options] - Optional initial camera placement.
     * @param {number[]} [options.target] - Orbit target `[x, y, z]`.
     * @param {number} [options.distance] - Initial orbit distance.
     * @param {number} [options.azimuth] - Initial azimuth angle in radians.
     * @param {number} [options.polar] - Initial polar angle in radians.
     * @param {Function} [options.onChange] - Requests a frame after input.
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
        this._onChange = options.onChange ?? (() => {});

        this._pointerId = null;
        this._dragButton = -1;
        this._lastX = 0;
        this._lastY = 0;

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onWheel = this._onWheel.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);
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
            this._view.addEventListener("pointercancel", this._onPointerUp);
        }
        canvas.addEventListener("wheel", this._onWheel, { passive: false });
        canvas.addEventListener("contextmenu", this._onContextMenu);
        canvas.addEventListener("keydown", this._onKeyDown);
    }

    _onPointerDown(event) {
        if (this._pointerId !== null || (event.button !== 0 && event.button !== 2)) {
            return;
        }
        this._pointerId = event.pointerId;
        this._dragButton = event.button;
        this._lastX = event.clientX;
        this._lastY = event.clientY;
    }

    _onPointerMove(event) {
        if (event.pointerId !== this._pointerId) {
            return;
        }
        const dx = event.clientX - this._lastX;
        const dy = event.clientY - this._lastY;
        this._lastX = event.clientX;
        this._lastY = event.clientY;

        if (this._dragButton === 0) {
            this._orbit(dx, dy);
        } else {
            this._pan(dx, dy);
        }
        this._onChange();
    }

    _onPointerUp(event) {
        if (event.pointerId === this._pointerId) {
            this._pointerId = null;
        }
    }

    _onWheel(event) {
        event.preventDefault();
        this.zoom(Math.exp(event.deltaY * 0.001));
    }

    _onKeyDown(event) {
        if (event.altKey || event.ctrlKey || event.metaKey) {
            return;
        }
        const direction = ARROWS.get(event.key);
        if (direction) {
            if (event.shiftKey) {
                this._pan(...direction);
            } else {
                this._orbit(...direction);
            }
            this._onChange();
        } else if (event.key === "+" || event.key === "=") {
            this.zoom(1 / 1.2);
        } else if (event.key === "-") {
            this.zoom(1.2);
        } else {
            return;
        }
        event.preventDefault();
    }

    /** Set a zoom goal relative to the current goal distance. */
    zoom(factor) {
        this._goalDistance = Math.min(
            MAX_DISTANCE,
            Math.max(MIN_DISTANCE, this._goalDistance * factor)
        );
        this._onChange();
    }

    _onContextMenu(event) {
        // Suppress the browser menu so right-drag panning is usable.
        event.preventDefault();
    }

    _orbit(dx, dy) {
        this._goalAzimuth -= dx * 0.01;
        this._goalPolar = Math.min(MAX_POLAR, Math.max(MIN_POLAR, this._goalPolar - dy * 0.01));
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
        // (fx,fy,fz) and world up (0,1,0) this is (-fz, 0, fx), so dragging
        // horizontally moves the target horizontally regardless of tilt.
        let rx = -fz;
        let rz = fx;
        const rlen = Math.hypot(rx, rz) || 1;
        rx /= rlen;
        rz /= rlen;

        // up = right x forward
        const ux = -rz * fy;
        const uy = rz * fx - rx * fz;
        const uz = rx * fy;

        const speed = this._goalDistance * 0.0015;
        const moveX = -dx * speed;
        const moveY = dy * speed;

        this._goalTarget[0] += rx * moveX + ux * moveY;
        this._goalTarget[1] += uy * moveY;
        this._goalTarget[2] += rz * moveX + uz * moveY;
    }

    /**
     * Advance the damped interpolation toward the goal state. Call once per
     * frame before reading {@link OrbitControls#getEye}.
     * @returns {boolean} Whether another frame is needed to reach the goals.
     */
    update() {
        this.azimuth = ease(this.azimuth, this._goalAzimuth);
        this.polar = ease(this.polar, this._goalPolar);
        this.distance = ease(this.distance, this._goalDistance);
        for (let axis = 0; axis < 3; axis++) {
            this.target[axis] = ease(this.target[axis], this._goalTarget[axis]);
        }
        return (
            this.azimuth !== this._goalAzimuth ||
            this.polar !== this._goalPolar ||
            this.distance !== this._goalDistance ||
            this.target.some((value, axis) => value !== this._goalTarget[axis])
        );
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
     * @param {boolean} [immediate] - Apply the framing before the next draw.
     */
    frame(target, distance, immediate = false) {
        this._goalTarget = [target[0], target[1], target[2]];
        this._goalDistance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, distance));
        if (immediate) {
            this.target = this._goalTarget.slice();
            this.distance = this._goalDistance;
        }
        this._onChange();
    }

    /** Detach all event listeners added by this instance. */
    dispose() {
        this.canvas.removeEventListener("pointerdown", this._onPointerDown);
        if (this._view) {
            this._view.removeEventListener("pointermove", this._onPointerMove);
            this._view.removeEventListener("pointerup", this._onPointerUp);
            this._view.removeEventListener("pointercancel", this._onPointerUp);
        }
        this.canvas.removeEventListener("wheel", this._onWheel);
        this.canvas.removeEventListener("contextmenu", this._onContextMenu);
        this.canvas.removeEventListener("keydown", this._onKeyDown);
    }
}
