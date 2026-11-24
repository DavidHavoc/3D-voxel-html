/**
 * Unit tests for the pure matrix/vector helpers in `src/math.js`.
 *
 * These run under Node's built-in test runner (`node --test`) with zero
 * third-party dependencies. They lock the camera math that the renderer and
 * controls rely on: a known perspective matrix, identity/known matrix
 * products, look-at invariants, and vector normalization.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
    mat4Identity,
    mat4Perspective,
    mat4LookAt,
    mat4Multiply,
    vec3Normalize,
} from "../src/math.js";

/** Assert two numbers are equal within a small tolerance. */
function near(actual, expected, msg) {
    assert.ok(
        Math.abs(actual - expected) < 1e-6,
        `${msg ?? ""} expected ${expected}, got ${actual}`
    );
}

test("mat4Identity is the column-major identity", () => {
    const m = mat4Identity();
    assert.equal(m.length, 16);
    const expected = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    for (let i = 0; i < 16; i++) {
        near(m[i], expected[i], `identity[${i}]`);
    }
});

test("mat4Perspective produces known entries for a sample frustum", () => {
    // fov = 90deg, aspect = 2, near = 1, far = 101.
    const m = mat4Perspective(Math.PI / 2, 2, 1, 101);

    near(m[0], 0.5, "m[0] = f/aspect"); // f = 1/tan(45deg) = 1
    near(m[5], 1, "m[5] = f");
    near(m[10], -1.02, "m[10] = (far+near)/(near-far)");
    near(m[11], -1, "m[11]");
    near(m[14], -2.02, "m[14] = 2*far*near/(near-far)");

    // Every other entry is zero.
    const nonZero = new Set([0, 5, 10, 11, 14]);
    for (let i = 0; i < 16; i++) {
        if (!nonZero.has(i)) {
            near(m[i], 0, `m[${i}] should be zero`);
        }
    }
});

test("mat4Multiply by identity returns the original matrix", () => {
    const id = mat4Identity();
    const a = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);

    const left = mat4Multiply(id, a); // I * a
    const right = mat4Multiply(a, id); // a * I
    for (let i = 0; i < 16; i++) {
        near(left[i], a[i], `(I*a)[${i}]`);
        near(right[i], a[i], `(a*I)[${i}]`);
    }
});

test("mat4Multiply computes a known product", () => {
    // A pure translation (column-major: translation in the last column).
    const t = mat4Identity();
    t[12] = 10;
    t[13] = 20;
    t[14] = 30;

    // A uniform scale of 2.
    const s = mat4Identity();
    s[0] = 2;
    s[5] = 2;
    s[10] = 2;

    // out = t * s: scales, then translates. Column-major, so the translation
    // column stays and the scale lands on the diagonal.
    const out = mat4Multiply(t, s);
    near(out[0], 2, "scale x");
    near(out[5], 2, "scale y");
    near(out[10], 2, "scale z");
    near(out[12], 10, "translate x");
    near(out[13], 20, "translate y");
    near(out[14], 30, "translate z");
    near(out[15], 1, "w");

    // Order matters: s * t differs because the translation is also scaled.
    const swapped = mat4Multiply(s, t);
    near(swapped[12], 20, "s*t scales the translation x");
    near(swapped[13], 40, "s*t scales the translation y");
    near(swapped[14], 60, "s*t scales the translation z");
});

test("mat4LookAt satisfies basic view-matrix invariants", () => {
    // Camera on +z looking at the origin, world up +y.
    const view = mat4LookAt([0, 0, 10], [0, 0, 0], [0, 1, 0]);

    // The upper-left 3x3 rows are the camera basis (right, up, -forward);
    // each is a unit vector and they are mutually orthogonal.
    const right = [view[0], view[4], view[8]];
    const up = [view[1], view[5], view[9]];
    const back = [view[2], view[6], view[10]];

    near(Math.hypot(...right), 1, "right is unit length");
    near(Math.hypot(...up), 1, "up is unit length");
    near(Math.hypot(...back), 1, "back is unit length");

    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    near(dot(right, up), 0, "right . up");
    near(dot(right, back), 0, "right . back");
    near(dot(up, back), 0, "up . back");

    // Looking down -z from +z: the view's back axis (eye - center) is +z.
    near(back[0], 0, "back x");
    near(back[1], 0, "back y");
    near(back[2], 1, "back z");

    // The eye maps to the origin in view space (translation cancels it).
    // view * [0,0,10,1] => z component should be -10 (in front of camera).
    const ez = view[2] * 0 + view[6] * 0 + view[10] * 10 + view[14];
    near(ez, 0, "eye maps to view-space origin (z)");
});

test("vec3Normalize yields a unit vector and leaves zero unchanged", () => {
    const v = [3, 0, 4];
    const out = vec3Normalize(v);
    assert.equal(out, v, "normalizes in place and returns the same array");
    near(Math.hypot(out[0], out[1], out[2]), 1, "unit length");
    near(out[0], 0.6, "x");
    near(out[2], 0.8, "z");

    const zero = [0, 0, 0];
    const zeroOut = vec3Normalize(zero);
    assert.deepEqual(zeroOut, [0, 0, 0], "zero vector is left unchanged");
});
