/**
 * Minimal column-major 4x4 matrix and 3-vector math for the renderer.
 *
 * This is a tiny, dependency-free replacement for the matrix helpers a
 * library such as gl-matrix would provide. Matrices are plain
 * `Float32Array(16)` in column-major order, matching the layout WebGL's
 * `uniformMatrix4fv` expects when `transpose` is false.
 */

/**
 * Create a new 4x4 identity matrix.
 * @returns {Float32Array} A column-major identity matrix.
 */
export function mat4Identity() {
    const out = new Float32Array(16);
    out[0] = 1;
    out[5] = 1;
    out[10] = 1;
    out[15] = 1;
    return out;
}

/**
 * Build a perspective projection matrix.
 *
 * @param {number} fovY - Vertical field of view in radians.
 * @param {number} aspect - Viewport aspect ratio (width / height).
 * @param {number} near - Near clip plane distance (> 0).
 * @param {number} far - Far clip plane distance (> near).
 * @returns {Float32Array} The projection matrix.
 */
export function mat4Perspective(fovY, aspect, near, far) {
    const out = new Float32Array(16);
    const f = 1.0 / Math.tan(fovY / 2);
    const nf = 1 / (near - far);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[14] = 2 * far * near * nf;
    return out;
}

/** Distance that keeps a sphere inside both the horizontal and vertical field of view. */
export function perspectiveFitDistance(radius, fovY, aspect) {
    const halfFov = fovY / 2;
    const halfFovX = Math.atan(Math.tan(halfFov) * aspect);
    return radius / Math.sin(Math.min(halfFov, halfFovX));
}

/**
 * Build a right-handed look-at view matrix.
 *
 * @param {number[]} eye - Camera position `[x, y, z]`.
 * @param {number[]} center - Point the camera looks at `[x, y, z]`.
 * @param {number[]} up - World up direction `[x, y, z]`.
 * @returns {Float32Array} The view matrix.
 */
export function mat4LookAt(eye, center, up) {
    const out = new Float32Array(16);

    let z0 = eye[0] - center[0];
    let z1 = eye[1] - center[1];
    let z2 = eye[2] - center[2];
    let len = Math.hypot(z0, z1, z2);
    if (len === 0) {
        z2 = 1;
    } else {
        z0 /= len;
        z1 /= len;
        z2 /= len;
    }

    let x0 = up[1] * z2 - up[2] * z1;
    let x1 = up[2] * z0 - up[0] * z2;
    let x2 = up[0] * z1 - up[1] * z0;
    len = Math.hypot(x0, x1, x2);
    if (len === 0) {
        x0 = 0;
        x1 = 0;
        x2 = 0;
    } else {
        x0 /= len;
        x1 /= len;
        x2 /= len;
    }

    const y0 = z1 * x2 - z2 * x1;
    const y1 = z2 * x0 - z0 * x2;
    const y2 = z0 * x1 - z1 * x0;

    out[0] = x0;
    out[1] = y0;
    out[2] = z0;
    out[3] = 0;
    out[4] = x1;
    out[5] = y1;
    out[6] = z1;
    out[7] = 0;
    out[8] = x2;
    out[9] = y2;
    out[10] = z2;
    out[11] = 0;
    out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
    out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
    out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
    out[15] = 1;

    return out;
}

/**
 * Multiply two 4x4 matrices: `out = a * b`.
 *
 * @param {Float32Array} a - Left-hand matrix.
 * @param {Float32Array} b - Right-hand matrix.
 * @returns {Float32Array} The product as a new matrix.
 */
export function mat4Multiply(a, b) {
    const out = new Float32Array(16);
    for (let col = 0; col < 4; col++) {
        const b0 = b[col * 4 + 0];
        const b1 = b[col * 4 + 1];
        const b2 = b[col * 4 + 2];
        const b3 = b[col * 4 + 3];
        out[col * 4 + 0] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
        out[col * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
        out[col * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
        out[col * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
    }
    return out;
}

/**
 * Normalize a 3-vector in place.
 * @param {number[]} v - The vector `[x, y, z]` to normalize.
 * @returns {number[]} The same array, normalized (unchanged if zero length).
 */
export function vec3Normalize(v) {
    const len = Math.hypot(v[0], v[1], v[2]);
    if (len > 0) {
        v[0] /= len;
        v[1] /= len;
        v[2] /= len;
    }
    return v;
}
