/**
 * Unit tests for the pure voxel generators.
 *
 * These run under Node's built-in test runner (`node --test`) with zero
 * third-party dependencies. Every assertion is tied to the real generator
 * math: concrete voxel counts, geometric properties (flatness, tapering,
 * circular cross-sections), and exact coordinates. Reverting a generator's
 * math (for example breaking the sphere radius check) makes at least one of
 * these tests fail.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
    generateCube,
    generateSphere,
    generateCircle,
    generateCylinder,
    generateCone,
    generatePyramid,
    generateVoxels,
} from "../src/voxel-generators.js";

/** Count voxels in a single y-layer. */
function layerCount(voxels, y) {
    return voxels.filter((v) => v[1] === y).length;
}

/** True when a voxel with the given coordinates exists. */
function has(voxels, x, y, z) {
    return voxels.some((v) => v[0] === x && v[1] === y && v[2] === z);
}

/** Assert every coordinate falls within [0,width) x [0,height) x [0,depth). */
function assertInBounds(voxels, width, height, depth) {
    for (const [x, y, z] of voxels) {
        assert.ok(
            x >= 0 && x < width && y >= 0 && y < height && z >= 0 && z < depth,
            `voxel [${x},${y},${z}] out of bounds for ${width}x${height}x${depth}`
        );
    }
}

test("generateCube fills the whole volume", () => {
    assert.deepEqual(generateCube(1, 1, 1), [[0, 0, 0]]);
    assert.equal(generateCube(5, 5, 5).length, 125);
    assert.equal(generateCube(3, 2, 4).length, 24);

    const cube = generateCube(3, 2, 4);
    assertInBounds(cube, 3, 2, 4);

    // Every cell is unique, so the count equals the product of dimensions.
    const unique = new Set(cube.map((v) => v.join(",")));
    assert.equal(unique.size, cube.length);
});

test("generateCircle is a flat disc that excludes the corners", () => {
    const width = 7;
    const depth = 7;
    const circle = generateCircle(width, 1, depth);

    // Flat: everything sits on the y = 0 plane.
    assert.ok(circle.every((v) => v[1] === 0));

    // Bounded between non-empty and the full square footprint.
    assert.ok(circle.length > 0);
    assert.ok(circle.length <= width * depth);
    assert.equal(circle.length, 37);

    // Center is inside the disc; all four extreme corners are outside it.
    assert.ok(has(circle, 3, 0, 3));
    assert.ok(!has(circle, 0, 0, 0));
    assert.ok(!has(circle, width - 1, 0, 0));
    assert.ok(!has(circle, 0, 0, depth - 1));
    assert.ok(!has(circle, width - 1, 0, depth - 1));
});

test("generateSphere includes the center and stays within the volume", () => {
    const sphere = generateSphere(5, 5, 5, true);

    assert.ok(has(sphere, 2, 2, 2));
    assert.ok(sphere.length <= 5 * 5 * 5);
    assert.equal(sphere.length, 81);
    assertInBounds(sphere, 5, 5, 5);

    // Corners of the bounding box lie outside the inscribed ellipsoid.
    assert.ok(!has(sphere, 0, 0, 0));
    assert.ok(!has(sphere, 4, 4, 4));
});

test("generateSphere low-detail path subsamples large volumes", () => {
    const highDetail = generateSphere(40, 40, 40, true);
    const lowDetail = generateSphere(40, 40, 40, false);

    // Low detail must be a strict, smaller subset of the full-resolution set.
    assert.ok(lowDetail.length > 0);
    assert.ok(lowDetail.length < highDetail.length);

    const highSet = new Set(highDetail.map((v) => v.join(",")));
    for (const v of lowDetail) {
        assert.ok(highSet.has(v.join(",")), `low-detail voxel ${v} missing from full set`);
    }

    // step = ceil(40 / 10) = 4, so every sampled coordinate is a multiple of 4.
    for (const [x, y, z] of lowDetail) {
        assert.equal(x % 4, 0);
        assert.equal(y % 4, 0);
        assert.equal(z % 4, 0);
    }
});

test("generateCylinder uses full height with a circular cross-section", () => {
    const width = 7;
    const height = 5;
    const depth = 7;
    const cylinder = generateCylinder(width, height, depth, true);

    assert.ok(cylinder.length <= width * height * depth);
    assert.equal(cylinder.length, 185);
    assertInBounds(cylinder, width, height, depth);

    // Full height: a voxel exists at the top layer y = height - 1.
    const maxY = Math.max(...cylinder.map((v) => v[1]));
    assert.equal(maxY, height - 1);
    assert.ok(has(cylinder, 3, height - 1, 3));

    // Circular cross-section: center column present at mid-height, corners out.
    const midY = Math.floor(height / 2);
    assert.ok(has(cylinder, 3, midY, 3));
    assert.ok(!has(cylinder, 0, midY, 0));
    assert.ok(!has(cylinder, width - 1, midY, depth - 1));

    // Constant cross-section: every layer has the same filled-column count.
    const base = layerCount(cylinder, 0);
    for (let y = 0; y < height; y++) {
        assert.equal(layerCount(cylinder, y), base);
    }
});

test("generateCone tapers from a full base to a single apex", () => {
    const size = 9;
    const cone = generateCone(size, size, size, true);

    assert.ok(cone.length <= size * size * size);
    assertInBounds(cone, size, size, size);

    const base = layerCount(cone, 0);
    const top = layerCount(cone, size - 1);

    // Base layer is non-empty and strictly wider than the top.
    assert.ok(base > 0);
    assert.equal(base, 69);
    assert.ok(top < base);
    assert.equal(top, 1);

    // Monotonic narrowing: each layer has no more voxels than the one below.
    for (let y = 1; y < size; y++) {
        assert.ok(layerCount(cone, y) <= layerCount(cone, y - 1));
    }
});

test("shape generation defaults to full detail for large volumes", () => {
    const counts = { sphere: 10260, cylinder: 15340, cone: 5402 };
    for (const [shape, count] of Object.entries(counts)) {
        assert.equal(generateVoxels(shape, 25, 26, 30).length, count, shape);
    }
});

test("the 25 × 26 × 30 cone stays symmetric throughout the full-height taper", () => {
    const cone = generateVoxels("cone", 25, 26, 30);
    const coordinates = new Set(cone.map(String));
    for (const [x, y, z] of cone) {
        assert.ok(coordinates.has(String([24 - x, y, z])));
        assert.ok(coordinates.has(String([x, y, 29 - z])));
    }
    assert.equal(layerCount(cone, 0), 590);
    assert.deepEqual(
        cone.filter((voxel) => voxel[1] === 25),
        [
            [12, 25, 14],
            [12, 25, 15],
        ]
    );
});

test("a narrow cone reaches the requested height with a centered tip", () => {
    const cone = generateCone(4, 32, 4, true);
    assert.deepEqual(
        cone.filter((voxel) => voxel[1] === 31),
        [
            [1, 31, 1],
            [1, 31, 2],
            [2, 31, 1],
            [2, 31, 2],
        ]
    );
});

test("generatePyramid tapers from a wide base to a narrow apex", () => {
    const size = 9;
    const pyramid = generatePyramid(size, size, size);

    assert.ok(pyramid.length <= size * size * size);
    assertInBounds(pyramid, size, size, size);

    const base = layerCount(pyramid, 0);
    const apex = layerCount(pyramid, size - 1);

    assert.ok(base > 0);
    assert.equal(base, 81);
    assert.ok(apex < base);

    assert.deepEqual(
        pyramid.filter((voxel) => voxel[1] === size - 1),
        [[4, 8, 4]]
    );
    for (const [x, y, z] of pyramid) {
        assert.ok(has(pyramid, size - 1 - x, y, z));
        assert.ok(has(pyramid, x, y, size - 1 - z));
    }

    // Monotonic narrowing with height.
    for (let y = 1; y < size; y++) {
        assert.ok(layerCount(pyramid, y) <= layerCount(pyramid, y - 1));
    }
});

test("a pyramid with mixed parity has a centered rectangular base and tip", () => {
    const pyramid = generatePyramid(4, 32, 3);
    assert.equal(layerCount(pyramid, 0), 12);
    assert.deepEqual(
        pyramid.filter((voxel) => voxel[1] === 31),
        [
            [1, 31, 1],
            [2, 31, 1],
        ]
    );
});

test("generateVoxels dispatches to the matching generator", () => {
    assert.deepEqual(generateVoxels("cube", 2, 2, 2), generateCube(2, 2, 2));
    assert.deepEqual(generateVoxels("circle", 7, 1, 7), generateCircle(7, 1, 7));
    assert.deepEqual(generateVoxels("sphere", 5, 5, 5, true), generateSphere(5, 5, 5, true));
    assert.deepEqual(generateVoxels("cylinder", 7, 5, 7, true), generateCylinder(7, 5, 7, true));
    assert.deepEqual(generateVoxels("cone", 9, 9, 9, true), generateCone(9, 9, 9, true));
    assert.deepEqual(generateVoxels("pyramid", 9, 9, 9), generatePyramid(9, 9, 9));
});

test("generateVoxels returns an empty array for unknown shapes", () => {
    assert.deepEqual(generateVoxels("not-a-shape", 2, 2, 2), []);
    assert.deepEqual(generateVoxels("", 2, 2, 2), []);
});
