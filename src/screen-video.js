import * as THREE from 'three';
import { getVideoPreset, videoSource } from './video-library.js';

export const SCREEN_MOVIE_URL = './media/sphere-motion-loop.mp4';
export const BAND_MOVIE_URL = './media/sphere-motion-bands.mp4';

// The mesh UV covers only the spherical cap. Sample the corresponding latitude
// range of a complete 2:1 equirectangular movie, rather than stretch 180° into it.
export function fitSphericalVideo(texture, screen) {
  const polarMax = Math.acos(-screen.centerY / screen.radius);
  texture.repeat.set(1, polarMax / Math.PI);
  texture.offset.set(0, 1 - polarMax / Math.PI);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  return texture;
}

export class DomeMovie {
  constructor({ screen, video = document.createElement('video'), onChange = () => {}, mode = 'sphere', clipId = 'motion' }) {
    this.video = video; this.onChange = onChange;
    this.mode = mode; this.clipId = getVideoPreset(clipId).id; this.sourceGeneration = 0; this.seekTime = null;
    this.active = false; this.wantsPlayback = true; this.ready = false;
    this.blocked = false; this.buffering = false; this.error = ''; this.disposed = false;
    video.muted = true; video.defaultMuted = true; video.loop = true;
    video.playsInline = true; video.preload = 'auto';
    video.setAttribute('playsinline', '');
    video.poster = videoSource(mode,this.clipId).poster;
    this.texture = fitSphericalVideo(new THREE.VideoTexture(video), screen);
    this.listeners = new Map();
    const listen = (name, fn) => { video.addEventListener(name,fn); this.listeners.set(name,fn); };
    listen('loadedmetadata', () => {
      if (this.seekTime !== null) {
        video.currentTime = this.seekTime % (Number.isFinite(video.duration) && video.duration > 0 ? video.duration : getVideoPreset(this.clipId).duration);
        this.seekTime = null;
      }
    });
    const ready = () => {
      this.ready = video.readyState >= 2;
      if (this.ready) { this.error = ''; this.texture.needsUpdate = true; }
      this.emit();
    };
    listen('loadeddata',ready); listen('canplay',ready);
    listen('playing',() => { this.buffering = false; this.blocked = false; this.error = ''; this.emit(); });
    listen('pause',() => this.emit());
    listen('waiting',() => { this.buffering = true; this.emit(); });
    listen('error',() => { this.error = '영상을 불러오지 못했습니다. 재생 버튼으로 다시 시도하세요.'; this.emit(); });
    video.src = videoSource(mode,this.clipId).url;
  }

  setSource(mode, clipId = this.clipId) {
    const next = getVideoPreset(clipId), source = videoSource(mode,next.id);
    if (mode === this.mode && next.id === this.clipId) return;
    this.seekTime = next.id === this.clipId ? this.seekTime ?? (this.video.currentTime || 0) : 0;
    this.sourceGeneration++;
    this.mode = mode; this.clipId = next.id; this.ready = false; this.blocked = false; this.buffering = false; this.error = '';
    this.video.pause(); this.video.poster = source.poster; this.video.src = source.url;
    this.video.load(); this.emit();
  }

  emit() { if (!this.disposed) this.onChange(this.getState()); }

  getState() {
    const playing = this.active && !this.video.paused && !this.video.ended;
    return {
      active: this.active, requested: this.wantsPlayback, ready: this.ready, playing,
      status: this.error ? 'error' : this.blocked ? 'blocked' : !this.ready ? 'loading' : this.buffering && playing ? 'buffering' : playing ? 'playing' : 'paused',
      duration: Number.isFinite(this.video.duration) ? this.video.duration : getVideoPreset(this.clipId).duration,
      currentTime: this.seekTime ?? (this.video.currentTime || 0), error: this.error, source: this.mode, clipId: this.clipId,
    };
  }

  async resume() {
    if (this.disposed || !this.active || !this.wantsPlayback) return false;
    const generation = this.sourceGeneration;
    try {
      if (this.error) { this.error = ''; this.video.load(); }
      await this.video.play();
      if (generation !== this.sourceGeneration) return false;
      if (this.disposed || !this.active || !this.wantsPlayback) { this.video.pause(); return false; }
      this.blocked = false; this.emit(); return true;
    } catch (error) {
      if (generation === this.sourceGeneration && error.name !== 'AbortError' && this.active && this.wantsPlayback) {
        this.blocked = true; this.emit();
      }
      return false;
    }
  }

  setActive(active) {
    this.active = active;
    if (active && this.wantsPlayback) return this.resume();
    this.video.pause(); this.emit(); return Promise.resolve(false);
  }

  setPlaying(playing) {
    this.wantsPlayback = playing;
    if (playing) return this.resume();
    this.video.pause(); this.emit(); return Promise.resolve(false);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.active = false;
    for (const [name,listener] of this.listeners) this.video.removeEventListener(name,listener);
    this.video.pause(); this.video.removeAttribute('src'); this.video.load(); this.texture.dispose();
  }
}
