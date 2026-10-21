import footprint from './data/partition-footprint.json' with {type:'json'};
import { SCREEN } from './screen-spec.js';

export const CANOPY_SLOPE_DEGREES = 25;
const angle=CANOPY_SLOPE_DEGREES*Math.PI/180;
const cos=Math.cos(angle),sin=Math.sin(angle);
const cut=(footprint.lowerLineY-SCREEN.centerY)*cos+(footprint.rearBaselineZ-SCREEN.centerZ)*sin;
const radius=Math.sqrt(SCREEN.radius**2-cut**2);
const clipAngle=(SCREEN.tiltDegrees+CANOPY_SLOPE_DEGREES)*Math.PI/180;

export function screenHalfAngle(height,screen=SCREEN) {
  const r=Math.sqrt(Math.max(1e-8,screen.radius**2-height**2));
  const tilt=(screen.tiltDegrees+CANOPY_SLOPE_DEGREES)*Math.PI/180;
  const clip=(screen.clipOffset-Math.cos(tilt)*height)/(Math.sin(tilt)*r);
  const floor=(-screen.centerY-height*cos)/(r*sin);
  return Math.acos(Math.max(-1,Math.min(1,Math.max(clip,floor))));
}

export const CANOPY = Object.freeze({
  slopeDegrees:CANOPY_SLOPE_DEGREES,cos,sin,cut,radius,
  minimum:-SCREEN.centerY*cos-Math.sqrt(SCREEN.radius**2-SCREEN.centerY**2)*sin,
  maximum:SCREEN.radius,
  halfAngle:Math.acos((SCREEN.clipOffset-Math.cos(clipAngle)*cut)/(Math.sin(clipAngle)*radius)),
  rootY:footprint.lowerLineY,rootZ:footprint.rearBaselineZ,
  centerProjection:footprint.rearBaselineZ-(SCREEN.centerZ+cut*sin-radius*cos),
  overlap:.08,
});

export function toCanopyFrame(point,screen=SCREEN) {
  const y=point.y-screen.centerY,z=point.z-screen.centerZ;
  return {x:point.x,y:y*cos+z*sin,z:z*cos-y*sin};
}
export function fromCanopyFrame(point,screen=SCREEN) {
  return {x:point.x,y:screen.centerY+point.y*cos-point.z*sin,z:screen.centerZ+point.y*sin+point.z*cos};
}
export function screenContact(fraction,overlap=0) {
  const a=fraction*CANOPY.halfAngle,r=CANOPY.radius+overlap;
  return fromCanopyFrame({x:r*Math.sin(a),y:CANOPY.cut,z:-r*Math.cos(a)});
}
