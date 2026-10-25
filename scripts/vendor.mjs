import { mkdir, copyFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
await mkdir(new URL('dist/vendor', root), { recursive: true });
for (const [source, dest] of [
  ['three/build/three.module.js', 'three.module.js'],
  ['three/build/three.core.js', 'three.core.js'],
  ['three/examples/jsm/controls/OrbitControls.js', 'OrbitControls.js'],
  ['three/examples/jsm/environments/RoomEnvironment.js', 'RoomEnvironment.js'],
  ['three/examples/jsm/geometries/RoundedBoxGeometry.js', 'RoundedBoxGeometry.js'],
  ['three/examples/jsm/utils/BufferGeometryUtils.js', 'BufferGeometryUtils.js'],
  ['@dimforge/rapier3d-compat/rapier.mjs', 'rapier.mjs'],
  ['three/LICENSE', 'THREE-LICENSE.txt'],
  ['@dimforge/rapier3d-compat/LICENSE', 'RAPIER-LICENSE.txt'],
]) {
  try { await copyFile(new URL('node_modules/' + source, root), new URL('dist/vendor/' + dest, root)); }
  catch (err) { if (source.endsWith('LICENSE')) continue; throw err; }
}
console.log('Browser dependencies copied locally. dist/ is ready to serve.');
