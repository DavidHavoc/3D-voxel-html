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

const TRIANGLE_CORNERS = [0, 1, 2, 0, 2, 3];

/** Build interleaved position and normal data for the faces exposed to air. */
export function buildVoxelMesh(voxels, width, height, depth) {
    const occupied = new Uint8Array(width * height * depth);
    const index = (x, y, z) => (x * height + y) * depth + z;
    for (const [x, y, z] of voxels) {
        occupied[index(x, y, z)] = 1;
    }

    const data = [];
    for (const [x, y, z] of voxels) {
        for (const {
            n: [nx, ny, nz],
            v: corners,
        } of CUBE_FACES) {
            const neighborX = x + nx;
            const neighborY = y + ny;
            const neighborZ = z + nz;
            if (
                neighborX >= 0 &&
                neighborX < width &&
                neighborY >= 0 &&
                neighborY < height &&
                neighborZ >= 0 &&
                neighborZ < depth &&
                occupied[index(neighborX, neighborY, neighborZ)]
            ) {
                continue;
            }

            for (const cornerIndex of TRIANGLE_CORNERS) {
                const [cx, cy, cz] = corners[cornerIndex];
                data.push(x + cx - width / 2, y + cy, z + cz - depth / 2, nx, ny, nz);
            }
        }
    }
    return new Float32Array(data);
}
