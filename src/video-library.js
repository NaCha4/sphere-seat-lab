export const VIDEO_PRESETS = Object.freeze([
  Object.freeze({
    id: 'motion', label: 'Chromatic Flux · 모션그래픽', shortLabel: '네온 모션', duration: 20,
    description: '회전하는 네온 궤도와 확산하는 링으로 구성한 모션그래픽입니다.',
    sphere: { url: './media/sphere-motion-loop.mp4', poster: './media/sphere-motion-loop.jpg' },
    bands: { url: './media/sphere-motion-bands.mp4', poster: './media/sphere-motion-bands.jpg' },
  }),
  Object.freeze({
    id: 'sunset', label: '산맥의 노을 · 4K 타임랩스', shortLabel: '산맥 노을', duration: 8,
    projection: 'landscape',
    description: '산맥 위로 노을과 구름이 흐르는 실사 타임랩스입니다. 일반 영상을 곡면에 맞춘 것으로 360° 촬영은 아닙니다.',
    credit: 'Giuseppe Paoletti / Pexels', creditUrl: 'https://www.pexels.com/video/sweeping-timelapse-of-mountains-and-clouds-at-sunset-36753274/',
    sphere: { url: './media/sphere-sunset-loop.mp4', poster: './media/sphere-sunset-loop.jpg' },
    bands: { url: './media/sphere-sunset-bands.mp4', poster: './media/sphere-sunset-bands.jpg' },
  }),
]);

export function getVideoPreset(id) {
  return VIDEO_PRESETS.find(video => video.id === id) ?? VIDEO_PRESETS[0];
}

export function videoSource(mode, id) {
  const video = getVideoPreset(id);
  if (mode !== 'sphere' && mode !== 'bands') throw new Error(`Unknown screen movie layout: ${mode}`);
  return video[mode];
}
