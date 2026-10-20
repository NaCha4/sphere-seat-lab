export const HEAD = Object.freeze({ x: .105, y: .145, z: .11, height: 1.21, forward: -.025 });

export function audienceVariation(seat) {
  const value = Math.sin(seat.section * 738.13 + seat.row * 37.71 + seat.number * 3.17) * 43758.5453;
  return value - Math.floor(value);
}

export const audienceStature = seat => .94 + audienceVariation(seat) * .12;

export function audienceHead(seat) {
  const stature = audienceStature(seat);
  return {
    x: seat.x + Math.sin(seat.yaw) * HEAD.forward,
    y: seat.y + HEAD.height * stature,
    z: seat.z + Math.cos(seat.yaw) * HEAD.forward,
    rx: HEAD.x, ry: HEAD.y * stature, rz: HEAD.z,
    cos: Math.cos(seat.yaw), sin: Math.sin(seat.yaw),
  };
}
