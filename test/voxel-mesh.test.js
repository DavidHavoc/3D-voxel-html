import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVoxelMesh } from "../src/voxel-mesh.js";

test("two neighboring voxels omit their shared faces and sit on the ground", () => {
    const mesh = buildVoxelMesh(
        [
            [0, 0, 0],
            [1, 0, 0],
        ],
        2,
        1,
        1
    );
    assert.equal(mesh.length, 10 * 6 * 6);
    for (let i = 0; i < mesh.length; i += 6) {
        const [x, y, z, nx] = mesh.subarray(i, i + 4);
        assert.ok(y === 0 || y === 1);
        assert.ok(Math.abs(z) === 0.5);
        if (nx !== 0) {
            assert.equal(x, nx, "only the outer left and right faces should be drawn");
        }
    }
});

test("voxels on opposite row edges retain all faces", () => {
    const mesh = buildVoxelMesh(
        [
            [0, 0, 1],
            [0, 1, 0],
        ],
        1,
        2,
        2
    );
    assert.equal(mesh.length, 12 * 6 * 6);
});
