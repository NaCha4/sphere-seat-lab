import * as THREE from 'three';

// A 3D directional field stays continuous across the cap seam and pole.
// It avoids stretching flat artwork and stays static for seated VR.
export function createAuroraMaterial(center) {
  return new THREE.ShaderMaterial({
    name: 'Dome-native aurora',
    uniforms: {
      uCenter: { value: new THREE.Vector3(0, center.centerY, center.centerZ) },
      uOpacity: { value: 1 },
    },
    vertexShader: `
      uniform vec3 uCenter;
      varying vec3 vDomeDirection;
      void main() {
        vDomeDirection = position - uCenter;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vDomeDirection;
      void main() {
        vec3 d = normalize(vDomeDirection);
        float sweep = sin(d.x * 5.0 + d.z * 4.0)
                    + 0.32 * sin(d.x * 13.0 - d.z * 8.0);
        float height = d.y - 0.16 - 0.19 * sweep;
        float curtain = exp(-height * height * 19.0);
        float folds = 0.46 + 0.54 * pow(0.5 + 0.5 * sin(
          d.x * 48.0 + d.z * 35.0 + 4.0 * sweep + d.y * 6.0), 2.0);
        float crownHeight = d.y - 0.73 - 0.07 * sin(d.x * 8.0 - d.z * 6.0);
        float crown = exp(-crownHeight * crownHeight * 45.0);
        float hue = 0.5 + 0.5 * sin(d.x * 3.5 - d.z * 3.0);
        vec3 background = mix(vec3(0.016, 0.024, 0.075),
                              vec3(0.033, 0.080, 0.120),
                              smoothstep(-0.4, 1.0, d.y));
        vec3 ribbon = mix(vec3(0.045, 0.68, 0.40),
                          vec3(0.12, 0.38, 0.85), hue);
        vec3 color = background + ribbon * curtain * folds * 0.78;
        color += vec3(0.34, 0.12, 0.55) * crown * 0.48;
        float softCore = exp(-height * height * 210.0);
        color += vec3(0.19, 0.32, 0.23) * softCore * 0.34;
        gl_FragColor = vec4(color, uOpacity);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide, transparent: true, toneMapped: false,
  });
}
