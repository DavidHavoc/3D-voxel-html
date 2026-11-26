# 3D Voxel Sculptor

Generate and inspect 3D shapes built from voxels. The app runs locally in a WebGL-capable browser, with no build step, runtime dependencies, or external assets.

## Run locally

With Node.js and Python 3 available, start the static file server:

```sh
npm run serve
```

Open [3D Voxel Sculptor](http://localhost:8000/) in your browser. Stop the server with Ctrl+C in the terminal.

## Build a shape

1. Select a cube, sphere, circle, cylinder, cone, or pyramid.
2. Set the width, height, and depth from 1 to 32 voxels using the sliders or number fields. Circles are one voxel high and use only width and depth.
3. Select **Generate shape**. The preview shows the generated dimensions and voxel count.

All shapes generate at full detail throughout the supported range. Unequal dimensions can stretch a sphere into an ellipsoid, give a circle, cylinder, or cone an elliptical profile, or give a pyramid a rectangular base.

| Action | Controls |
| --- | --- |
| Orbit | Drag or swipe the preview, or focus it and use the arrow keys |
| Pan | Right-drag the preview, or focus it and use Shift + arrow keys |
| Zoom | Scroll in the preview, use its zoom buttons, or focus it and press + or − |
| Recenter | Select **Fit view** to frame the model at the current viewing angle |

## Development

- `npm test` runs Node's built-in test runner and covers geometry, mesh construction, and camera math.
- `npm run lint` uses ESLint if installed.
- `npm run format:check` uses Prettier if installed.

The generators in `src/voxel-generators.js` produce integer coordinates. `src/voxel-mesh.js` turns the exposed faces into a single mesh. `src/renderer.js` draws that mesh on a reference grid and schedules new frames as needed. `src/controls.js` handles camera input, and `src/app.js` connects the editor to the preview.

## License

[MIT](./LICENSE)
