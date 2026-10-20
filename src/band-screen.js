import * as THREE from 'three';
import { PARTITIONS, SCREEN_BANDS, bandFrame } from './partition-layout.js';

export function createBandScreenMaterial(texture, ready, screen) {
  const frames = SCREEN_BANDS.map(b => bandFrame(b, screen));
  return new THREE.ShaderMaterial({
    name: 'Three synchronized copies / one video decoder',
    uniforms: {
      uMovie: { value: texture }, uReady: { value: ready ? 1 : 0 }, uOpacity: { value: 1 },
      uBoundaries: { value: new THREE.Vector2(...PARTITIONS.levels) },
      uFrames: { value: frames.map(f => new THREE.Vector3(f.center, f.height, f.width)) },
    },
    vertexShader: `varying vec3 vPoint;
      void main() { vPoint = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D uMovie;
      uniform float uReady;
      uniform float uOpacity;
      uniform vec3 uFrames[3];
      uniform vec2 uBoundaries;
      varying vec3 vPoint;
      void main() {
        int band = vPoint.y < uBoundaries.x ? 0 : vPoint.y < uBoundaries.y ? 1 : 2;
        vec3 frame = uFrames[band];
        vec2 uv = vec2(vPoint.x / frame.z + 0.5, (vPoint.y-frame.x) / frame.y + 0.5);
        vec3 color = vec3(0.003,0.005,0.009);
        if (vPoint.z < 0.0 && uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
          // Sample the complete source frame. VideoTexture's spherical repeat/
          // offset is intentionally not used for these front projections.
          if (uReady > 0.5) {
            vec3 srgb = texture2D(uMovie, uv).rgb;
            color = mix(srgb/12.92, pow((srgb+0.055)/1.055,vec3(2.4)), step(vec3(0.04045),srgb));
          } else color = mix(vec3(0.01,0.04,0.08),vec3(0.04,0.4,0.23),uv.y);
        }
        gl_FragColor = vec4(color,uOpacity);
        #include <colorspace_fragment>
      }`,
    side: THREE.DoubleSide, transparent: true, toneMapped: false,
  });
}
