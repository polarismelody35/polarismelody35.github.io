# polarismelody35.github.io

## 3D universe on the home screen

The 3D space on the first screen, and the 3D song spheres in "Every star is a song", are made with [Three.js](https://threejs.org/).

- Source: `src/hero3d.js`
- The site loads the bundled file: `assets/js/hero3d.min.js`

After editing `src/hero3d.js`, rebuild the bundle:

```bash
npm i three esbuild
npx esbuild src/hero3d.js --bundle --minify --format=esm --outfile=assets/js/hero3d.min.js
```

Songs added in `index.html` (`window.PM35_MUSIC.songs`) appear as planets automatically —
no rebuild needed for that.
