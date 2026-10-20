import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BUILDING } from '../src/layout.js';
import { makeLayout } from '../src/layout.js';
import { Auditorium } from '../src/auditorium.js';
import { createScreenGeometry } from '../src/screen-geometry.js';
import { DomeMovie, fitSphericalVideo } from '../src/screen-video.js';

class FakeVideo extends EventTarget {
  paused = true; ended = false; readyState = 0; duration = 20; currentTime = 0;
  playError = null; plays = 0; pauses = 0;
  setAttribute(name,value) { this[name] = value; }
  removeAttribute(name) { delete this[name]; }
  load() { this.readyState = 0; }
  async play() {
    this.plays++;
    if (this.playError) throw this.playError;
    this.paused = false; this.dispatchEvent(new Event('playing'));
  }
  pause() { this.pauses++; this.paused = true; this.dispatchEvent(new Event('pause')); }
  decode() { this.readyState = 2; this.dispatchEvent(new Event('loadeddata')); }
}

test('the full-sphere movie maps to the cap without stretching its latitude', () => {
  const texture = fitSphericalVideo(new THREE.Texture(), BUILDING.screen);
  const { geometry, boundary } = createScreenGeometry(), positions = geometry.attributes.position, uv = geometry.attributes.uv;
  for (let i = 0; i < positions.count; i++) {
    const sourceV = uv.getY(i) * texture.repeat.y + texture.offset.y;
    const meshPolar = Math.acos(Math.max(-1,Math.min(1,(positions.getY(i)-BUILDING.screen.centerY)/BUILDING.screen.radius)));
    assert.ok(Math.abs(Math.PI*(1-sourceV)-meshPolar)<.002, 'movie and mesh latitude must agree');
  }
  assert.equal(texture.wrapS,THREE.RepeatWrapping);
  assert.equal(texture.generateMipmaps,false);
  texture.dispose(); geometry.dispose(); boundary.dispose();
});

test('movie controls preserve pause, stop decoding on static modes, and recover from blocked autoplay', async () => {
  const video = new FakeVideo(), movie = new DomeMovie({screen:BUILDING.screen,video});
  assert.equal(video.muted,true); assert.equal(video.loop,true);
  video.decode(); assert.equal(movie.getState().ready,true);
  await movie.setActive(true); assert.equal(movie.getState().playing,true);
  await movie.setPlaying(false); assert.equal(movie.getState().playing,false);
  await movie.setActive(false); await movie.setActive(true);
  assert.equal(movie.getState().playing,false,'switching modes must preserve explicit pause');
  video.playError = new DOMException('autoplay denied','NotAllowedError');
  await movie.setPlaying(true); assert.equal(movie.getState().status,'blocked');
  video.playError = null; await movie.setPlaying(true);
  assert.equal(movie.getState().playing,true);
  await movie.setActive(false); assert.equal(video.paused,true);
  movie.dispose(); assert.equal(video.src,undefined);
});

test('an in-flight play request cannot restart video after pause or mode exit', async () => {
  const video = new FakeVideo(), movie = new DomeMovie({screen:BUILDING.screen,video});
  let finish;
  video.play = () => new Promise(resolve => { finish = () => { video.paused = false; resolve(); }; });
  const request = movie.setActive(true);
  await movie.setPlaying(false); finish(); await request;
  assert.equal(video.paused,true);
  assert.equal(movie.getState().requested,false);
  movie.dispose();
});

test('the decoded movie replaces the loading image without resetting overview or recreating the player', () => {
  const video = new FakeVideo(), original = globalThis.document;
  const ctx = { fillRect(){},roundRect(){},fill(){},fillText(){} };
  let players = 0, model;
  globalThis.document = { createElement(tag) {
    if (tag === 'video') { players++; return video; }
    return { width:0,height:0,getContext(){return ctx;} };
  } };
  try {
    model = new Auditorium(new THREE.Scene(),makeLayout(),{screenMode:'video'});
    assert.ok(model.screenMaterial.isShaderMaterial,'retain the existing aurora until the first frame decodes');
    model.setOverview(true); video.decode();
    assert.equal(model.screenMaterial.map,model.movie.texture);
    assert.equal(model.screenMaterial.opacity,.16);
    assert.equal(model.screenMaterial.depthWrite,false);
    model.setScreen('aurora'); assert.equal(video.paused,true);
    model.setScreen('video'); assert.equal(players,1,'reuse the player when changing screen contents');
    assert.equal(model.screenMaterial.map,model.movie.texture);
  } finally { model?.dispose(); globalThis.document = original; }
});
