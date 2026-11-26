/**
 * Unit tests for the camera math in `src/controls.js`.
 *
 * These run headlessly under Node's built-in test runner (`node --test`) with
 * zero third-party dependencies and no DOM. `OrbitControls` is constructed with
 * a minimal fake canvas that implements `addEventListener`/`removeEventListener`
 * as no-ops, which is all the constructor touches; the window-level listeners
 * are skipped automatically when no global `window` exists. Browser behavior is
 * unchanged.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { OrbitControls } from "../src/controls.js";

/** Assert two numbers are equal within a small tolerance. */
function near(actual, expected, msg) {
    assert.ok(
        Math.abs(actual - expected) < 1e-6,
        `${msg ?? ""} expected ${expected}, got ${actual}`
    );
}

/** Minimal canvas stub: records listeners, runs nothing. */
function fakeCanvas() {
    return {
        listeners: [],
        handlers: new Map(),
        addEventListener(type, handler) {
            this.listeners.push(type);
            this.handlers.set(type, handler);
        },
        removeEventListener(type) {
            const i = this.listeners.indexOf(type);
            if (i >= 0) {
                this.listeners.splice(i, 1);
            }
            this.handlers.delete(type);
        },
        emit(type, event) {
            this.handlers.get(type)?.(event);
        },
    };
}

test("getEye places the camera from spherical state", () => {
    const controls = new OrbitControls(fakeCanvas(), {
        target: [1, 2, 3],
        distance: 10,
        azimuth: Math.PI / 2,
        polar: Math.PI / 2,
    });

    const eye = controls.getEye();
    near(eye[0], 11, "eye x");
    near(eye[1], 2, "eye y");
    near(eye[2], 3, "eye z");

    // Eye sits exactly `distance` away from the target.
    const dx = eye[0] - 1;
    const dy = eye[1] - 2;
    const dz = eye[2] - 3;
    near(Math.hypot(dx, dy, dz), 10, "eye is `distance` from target");

    controls.dispose();
});

test("update eases current state toward the goals", () => {
    const controls = new OrbitControls(fakeCanvas(), {
        target: [0, 0, 0],
        distance: 10,
        azimuth: 0,
        polar: Math.PI / 2,
    });

    // Set goals directly to a new distance and target, then ease once.
    controls.frame([10, 0, 0], 30);

    const startDistance = controls.distance;
    const startTargetX = controls.target[0];

    controls.update();

    // One step of damping moves part-way toward each goal, not all the way.
    assert.ok(
        controls.distance > startDistance && controls.distance < 30,
        `distance eased part-way: ${controls.distance}`
    );
    assert.ok(
        controls.target[0] > startTargetX && controls.target[0] < 10,
        `target eased part-way: ${controls.target[0]}`
    );

    // Repeated updates converge toward the goal.
    for (let i = 0; i < 300; i++) {
        controls.update();
    }
    near(controls.distance, 30, "distance converges to goal");
    near(controls.target[0], 10, "target converges to goal");

    controls.dispose();
});

test("frame sets the goal target and clamps the goal distance", () => {
    const controls = new OrbitControls(fakeCanvas());

    controls.frame([4, 5, 6], 42);
    assert.deepEqual(controls._goalTarget, [4, 5, 6], "goal target set");
    near(controls._goalDistance, 42, "goal distance set");

    // Distances are clamped to the controls' allowed range (2..500).
    controls.frame([0, 0, 0], 100000);
    near(controls._goalDistance, 500, "goal distance clamped to max");

    controls.frame([0, 0, 0], 0);
    near(controls._goalDistance, 2, "goal distance clamped to min");

    controls.dispose();
});

test("immediate framing shows the new model at its fitted distance on the first frame", () => {
    const controls = new OrbitControls(fakeCanvas());
    controls.frame([0, 13, 0], 60, true);
    assert.deepEqual(controls.target, [0, 13, 0]);
    assert.equal(controls.distance, 60);
    assert.equal(controls.update(), false);
});

test("camera updates signal when the damped animation has settled", () => {
    const controls = new OrbitControls(fakeCanvas());
    controls.frame([1, 2, 3], 20);
    assert.equal(controls.update(), true);
    for (let i = 0; i < 300; i++) {
        controls.update();
    }
    assert.equal(controls.update(), false);
    assert.deepEqual(controls.target, [1, 2, 3]);
    assert.equal(controls.distance, 20);
});

test("keyboard navigation wakes the camera and moves it in screen space", () => {
    const canvas = fakeCanvas();
    let changed = false;
    const controls = new OrbitControls(canvas, {
        azimuth: 0,
        polar: Math.PI / 2,
        onChange: () => {
            changed = true;
        },
    });
    canvas.emit("keydown", { key: "ArrowRight", shiftKey: true, preventDefault() {} });
    controls.update();
    assert.equal(changed, true);
    assert.ok(controls.target[0] < 0, "panning right moves the model to screen right");
    near(controls.target[1], 0);
    near(controls.target[2], 0);
});

test("dispose detaches the canvas listeners it added", () => {
    const canvas = fakeCanvas();
    const controls = new OrbitControls(canvas);

    assert.ok(canvas.listeners.length > 0, "listeners attached on construct");
    controls.dispose();
    assert.equal(canvas.listeners.length, 0, "listeners removed on dispose");
});
