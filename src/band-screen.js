import * as THREE from 'three';
import { PARTITIONS, SCREEN_BANDS } from './partition-layout.js';
import atlas from './data/band-video.json' with { type: 'json' };

export function createBandScreenMaterial(texture, ready, screen, { panoramic = false } = {}) {
  const tilt = screen.tiltDegrees * Math.PI / 180;
  return new THREE.ShaderMaterial({
    name: panoramic ? 'Full-width landscape / horizon fit' : 'Full-width curved bands / one synchronized video atlas',
    uniforms: {
      uMovie: { value: texture }, uReady: { value: ready ? 1 : 0 }, uOpacity: { value: 1 },
      uBoundary: { value: PARTITIONS.levels[0] },
      uBands: { value: SCREEN_BANDS.map(b => new THREE.Vector2(panoramic ? 0 : b.bottom, panoramic ? screen.centerY+screen.radius : b.top)) },
      uAtlas: { value: atlas.bands.map(b => new THREE.Vector2(panoramic ? 0 : b.offset, panoramic ? 1 : b.scale)) },
      uVideoSize: { value: new THREE.Vector2(panoramic ? 3840 : atlas.width, panoramic ? 1920 : atlas.height) },
      // Place the landscape horizon closer to seated eye level, spreading the
      // sky over the upper dome rather than wrapping a flat shot at the pole.
      uVerticalExponent: { value: panoramic ? .5 : 1 },
      uCanopy: { value: panoramic ? 0 : 1 },
      uScreen: { value: new THREE.Vector4(screen.centerY, screen.centerZ, screen.radius, screen.clipOffset) },
      uTilt: { value: new THREE.Vector2(Math.cos(tilt), Math.sin(tilt)) },
    },
    vertexShader: `varying vec3 vPoint;
      void main() { vPoint = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D uMovie;
      uniform float uReady;
      uniform float uOpacity;
      uniform vec2 uBands[2];
      uniform vec2 uAtlas[2];
      uniform vec2 uVideoSize;
      uniform vec4 uScreen;
      uniform vec2 uTilt;
      uniform float uBoundary;
      uniform float uVerticalExponent;
      uniform float uCanopy;
      varying vec3 vPoint;
      void main() {
        int band = vPoint.y < uBoundary ? 0 : 1;
        vec2 bounds = uBands[band];
        float dy = vPoint.y - uScreen.x;
        float radius = sqrt(max(0.00000001, uScreen.z*uScreen.z - dy*dy));
        float limit = (uScreen.w - uTilt.x*dy) / (uTilt.y*radius);
        float halfAngle = max(0.00001, acos(clamp(limit, -1.0, 1.0)));
        float angle = atan(vPoint.x, -(vPoint.z-uScreen.y));
        float rawV = clamp((vPoint.y-bounds.x)/(bounds.y-bounds.x), 0.0, 1.0);
        float u = 0.5 + angle/(2.0*halfAngle);
        if (band == 1 && uCanopy > 0.5) {
          float capU = 0.5 + vPoint.x/(2.0*uScreen.z);
          u = mix(u,capU,smoothstep(0.45,0.75,rawV));
        }
        u = clamp(u,0.5/uVideoSize.x,1.0-0.5/uVideoSize.x);
        float v = pow(rawV,uVerticalExponent);
        vec2 strip = uAtlas[band];
        // Half-texel inset prevents a neighbouring atlas strip from bleeding
        // across a partition boundary, without introducing black margins.
        float atlasV = clamp(strip.x+v*strip.y, strip.x+0.5/uVideoSize.y, strip.x+strip.y-0.5/uVideoSize.y);
        vec3 color;
        if (uReady > 0.5) {
          vec3 srgb = texture2D(uMovie, vec2(u,atlasV)).rgb;
          color = mix(srgb/12.92, pow((srgb+0.055)/1.055,vec3(2.4)), step(vec3(0.04045),srgb));
        } else color = mix(vec3(0.01,0.04,0.08),vec3(0.04,0.4,0.23),v);
        gl_FragColor = vec4(color,uOpacity);
        #include <colorspace_fragment>
      }`,
    side: THREE.DoubleSide, transparent: true, toneMapped: false,
  });
}
