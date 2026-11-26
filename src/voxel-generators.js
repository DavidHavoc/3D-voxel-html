/**
 * Pure voxel-generation logic for the 3D Voxel Sculptor.
 *
 * This module is intentionally free of any DOM, WebGL, or third-party
 * dependency so it can be unit tested directly under Node's built-in test
 * runner. Every generator returns an array of `[x, y, z]` integer
 * coordinates describing which unit cells are filled for a given shape.
 */

/**
 * Generate a solid rectangular box filling the entire volume.
 *
 * @param {number} width - Volume width (number of cells along x).
 * @param {number} height - Volume height (number of cells along y).
 * @param {number} depth - Volume depth (number of cells along z).
 * @returns {Array<[number, number, number]>} Filled voxel coordinates.
 */
export function generateCube(width, height, depth) {
    const result = [];
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            for (let z = 0; z < depth; z++) {
                result.push([x, y, z]);
            }
        }
    }
    return result;
}

/**
 * Generate a solid ellipsoid ("sphere") inscribed in the volume.
 *
 * @param {number} width - Volume width (number of cells along x).
 * @param {number} height - Volume height (number of cells along y).
 * @param {number} depth - Volume depth (number of cells along z).
 * @param {boolean} [highDetail] - When false, large volumes are subsampled.
 * @returns {Array<[number, number, number]>} Filled voxel coordinates.
 */
export function generateSphere(width, height, depth, highDetail = true) {
    const result = [];

    const centerX = (width - 1) / 2;
    const centerY = (height - 1) / 2;
    const centerZ = (depth - 1) / 2;

    const radiusX = width / 2;
    const radiusY = height / 2;
    const radiusZ = depth / 2;

    const step = highDetail ? 1 : Math.max(1, Math.ceil(Math.min(width, height, depth) / 10));

    for (let x = 0; x < width; x += step) {
        for (let y = 0; y < height; y += step) {
            for (let z = 0; z < depth; z += step) {
                const dx = (x - centerX) / radiusX;
                const dy = (y - centerY) / radiusY;
                const dz = (z - centerZ) / radiusZ;

                if (dx * dx + dy * dy + dz * dz <= 1.0) {
                    result.push([x, y, z]);
                }
            }
        }
    }

    return result;
}

/**
 * Generate a flat filled disc ("circle") on the y = 0 plane.
 *
 * @param {number} width - Volume width (number of cells along x).
 * @param {number} height - Unused; kept for signature consistency.
 * @param {number} depth - Volume depth (number of cells along z).
 * @returns {Array<[number, number, number]>} Filled voxel coordinates.
 */
export function generateCircle(width, height, depth) {
    const result = [];

    const centerX = (width - 1) / 2;
    const centerZ = (depth - 1) / 2;

    const radiusX = width / 2;
    const radiusZ = depth / 2;

    for (let x = 0; x < width; x++) {
        for (let z = 0; z < depth; z++) {
            const dx = (x - centerX) / radiusX;
            const dz = (z - centerZ) / radiusZ;

            if (dx * dx + dz * dz <= 1.0) {
                result.push([x, 0, z]);
            }
        }
    }

    return result;
}

/**
 * Generate a solid vertical cylinder with an elliptical cross-section.
 *
 * @param {number} width - Volume width (number of cells along x).
 * @param {number} height - Volume height (number of cells along y).
 * @param {number} depth - Volume depth (number of cells along z).
 * @param {boolean} [highDetail] - When false, large volumes are subsampled.
 * @returns {Array<[number, number, number]>} Filled voxel coordinates.
 */
export function generateCylinder(width, height, depth, highDetail = true) {
    const result = [];

    const centerX = (width - 1) / 2;
    const centerZ = (depth - 1) / 2;

    const radiusX = width / 2;
    const radiusZ = depth / 2;

    const step = highDetail ? 1 : Math.max(1, Math.ceil(Math.min(width, depth) / 10));

    for (let x = 0; x < width; x += step) {
        for (let y = 0; y < height; y++) {
            for (let z = 0; z < depth; z += step) {
                const dx = (x - centerX) / radiusX;
                const dz = (z - centerZ) / radiusZ;

                if (dx * dx + dz * dz <= 1.0) {
                    result.push([x, y, z]);
                }
            }
        }
    }

    return result;
}

/**
 * Generate a solid cone that tapers to a point at the top of the volume.
 *
 * @param {number} width - Volume width (number of cells along x).
 * @param {number} height - Volume height (number of cells along y).
 * @param {number} depth - Volume depth (number of cells along z).
 * @param {boolean} [highDetail] - When false, large volumes are subsampled.
 * @returns {Array<[number, number, number]>} Filled voxel coordinates.
 */
export function generateCone(width, height, depth, highDetail = true) {
    const result = [];

    const centerX = (width - 1) / 2;
    const centerZ = (depth - 1) / 2;

    const radiusX = width / 2;
    const radiusZ = depth / 2;

    const step = highDetail ? 1 : Math.max(1, Math.ceil(Math.min(width, depth) / 10));
    // An even-sized axis has its center between cells. Keep all equally close
    // cells when the last layers get too narrow to contain a voxel center.
    const nearestX = (centerX - Math.floor(centerX)) / radiusX;
    const nearestZ = (centerZ - Math.floor(centerZ)) / radiusZ;
    const minRadiusSquared = nearestX * nearestX + nearestZ * nearestZ;

    for (let x = 0; x < width; x += step) {
        const dx = (x - centerX) / radiusX;
        for (let y = 0; y < height; y++) {
            const taper = (height - y) / height;
            const threshold = Math.max(taper * taper, minRadiusSquared);
            for (let z = 0; z < depth; z += step) {
                const dz = (z - centerZ) / radiusZ;
                if (dx * dx + dz * dz <= threshold) {
                    result.push([x, y, z]);
                }
            }
        }
    }

    return result;
}

/**
 * Generate a solid pyramid with a rectangular base and a centered tip.
 *
 * @param {number} width - Volume width (number of cells along x).
 * @param {number} height - Volume height (number of cells along y).
 * @param {number} depth - Volume depth (number of cells along z).
 * @returns {Array<[number, number, number]>} Filled voxel coordinates.
 */
export function generatePyramid(width, height, depth) {
    const result = [];

    const centerX = (width - 1) / 2;
    const centerZ = (depth - 1) / 2;
    const minBoundX = centerX - Math.floor(centerX);
    const minBoundZ = centerZ - Math.floor(centerZ);

    for (let x = 0; x < width; x++) {
        const dx = Math.abs(x - centerX);
        for (let y = 0; y < height; y++) {
            const taper = (height - y) / (2 * height);
            if (dx > Math.max(width * taper, minBoundX)) {
                continue;
            }
            const depthBound = Math.max(depth * taper, minBoundZ);
            for (let z = 0; z < depth; z++) {
                if (Math.abs(z - centerZ) <= depthBound) {
                    result.push([x, y, z]);
                }
            }
        }
    }

    return result;
}

/**
 * Dispatch to the correct generator for a given shape type.
 *
 * @param {string} shapeType - One of cube, sphere, circle, cylinder, cone,
 *   pyramid. Any unknown value yields an empty array.
 * @param {number} width - Volume width (number of cells along x).
 * @param {number} height - Volume height (number of cells along y).
 * @param {number} depth - Volume depth (number of cells along z).
 * @param {boolean} [highDetail] - Explicitly pass false to subsample large
 *   spheres, cylinders, and cones. Defaults to full detail.
 * @returns {Array<[number, number, number]>} Filled voxel coordinates.
 */
export function generateVoxels(shapeType, width, height, depth, highDetail) {
    switch (shapeType) {
        case "cube":
            return generateCube(width, height, depth);
        case "sphere":
            return generateSphere(width, height, depth, highDetail);
        case "circle":
            return generateCircle(width, height, depth);
        case "cylinder":
            return generateCylinder(width, height, depth, highDetail);
        case "cone":
            return generateCone(width, height, depth, highDetail);
        case "pyramid":
            return generatePyramid(width, height, depth);
        default:
            return [];
    }
}
