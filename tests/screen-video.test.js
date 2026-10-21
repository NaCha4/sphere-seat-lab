import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BUILDING } from '../src/layout.js';
import { makeLayout, resolveSeat } from '../src/layout.js';
import { Auditorium } from '../src/auditorium.js';
import { createScreenGeometry } from '../src/screen-geometry.js';
import { DomeMovie, fitSphericalVideo, SCREEN_MOVIE_URL, BAND_MOVIE_URL } from '../src/screen-video.js';
import { VIDEO_PRESETS, getVideoPreset } from '../src/video-library.js';

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
    const selected = model.layout.byId.get('210-10-10');
    model.select(selected); model.setAudience(true); model.setStage(true);
    model.setOverview(false); video.currentTime = 7.25;
    const movie = model.movie, screen = model.screen, texture = model.screenMaterial.map;
    for (const world of ['curvature-v1','original']) {
      const oldGroup = model.worldGroup, oldMesh = model.chairMeshes[0];
      let disposed = false; oldMesh.geometry.addEventListener('dispose', () => { disposed = true; });
      model.setLayout(makeLayout(world));
      assert.ok(disposed, 'old seat geometry must be released');
      assert.ok(!model.group.children.includes(oldGroup), 'only one world is rendered at a time');
      assert.equal(model.selected.section,selected.section);
      assert.ok(model.layout.byId.has(model.selected.id),'retain a valid selection when row counts change');
      assert.equal(model.layout.world.id,world);
      assert.equal(model.movie,movie); assert.equal(model.screen,screen); assert.equal(model.screenMaterial.map,texture);
      assert.equal(video.currentTime,7.25); assert.equal(players,1,'switching worlds must not restart/download the video');
      assert.equal(model.stageGroup.visible,true); assert.equal(model.audience.visible,true);
      const matrix = new THREE.Matrix4(); model.audience.meshes[0].getMatrixAt(model.selected.index,matrix);
      assert.equal(matrix.determinant(),0,'the same current seat remains empty');
      const hover = resolveSeat(model.layout,{section:209,row:10,number:10});
      model.setHoverSeats([hover]);
      assert.equal(model.hovered[0].id,hover.id,'picking uses the replacement world');
    }
    model.setLayout(makeLayout('fan-v2'));
    assert.equal(model.getPartitionState().amount,0,'the fan starts folded');
    assert.equal(model.movie,movie); assert.equal(model.screen,screen); assert.equal(video.currentTime,7.25);
    assert.equal(model.screenMaterial.uniforms.uMovie.value,texture);
    assert.equal(video.src,BAND_MOVIE_URL);
    assert.equal(model.screenMaterial.uniforms.uReady.value,0);
    video.dispatchEvent(new Event('loadedmetadata'));video.decode();
    assert.equal(model.screenMaterial.uniforms.uReady.value,1);
    assert.equal(video.currentTime,7.25);
    const material = model.screenMaterial;
    for (const id of ['106-16-8','206-10-8','306-10-8']) {
      const seat = model.layout.byId.get(id);
      if (seat) model.select(seat);
      assert.equal(model.screenMaterial,material,'every floor sees the same three rendered frames; no camera-dependent screen hiding');
    }
    model.setPartitions(true,true); assert.equal(model.getPartitionState().amount,1);
    model.setScreen('aurora'); assert.equal(model.screenMode,'video','this experimental world keeps three synchronized videos');
    model.setLayout(makeLayout('original'));
    assert.equal(model.getPartitionState(),null);
    assert.equal(video.src,SCREEN_MOVIE_URL);
    video.dispatchEvent(new Event('loadedmetadata'));video.decode();
    assert.equal(model.screenMaterial.map,texture);
    assert.equal(players,1,'switching between triple and full-dome playback uses one decoder');
  } finally { model?.dispose(); globalThis.document = original; }
});

test('switching wide/full-dome movies preserves pause and restores the timeline after metadata', async () => {
  const video=new FakeVideo(),movie=new DomeMovie({screen:BUILDING.screen,video});
  video.decode();await movie.setActive(true);video.currentTime=11.5;
  await movie.setPlaying(false);movie.setSource('bands');
  assert.equal(video.src,BAND_MOVIE_URL);assert.equal(movie.getState().ready,false);
  video.currentTime=0;video.dispatchEvent(new Event('loadedmetadata'));video.decode();
  assert.equal(video.currentTime,11.5);assert.equal(movie.getState().requested,false);
  assert.equal(video.paused,true);movie.dispose();
});

test('choosing another movie resets its timeline but retains pause and uses the same decoder', async () => {
  const video=new FakeVideo(),movie=new DomeMovie({screen:BUILDING.screen,video});
  video.decode();await movie.setActive(true);video.currentTime=17;
  await movie.setPlaying(false);movie.setSource('sphere','sunset');
  assert.equal(video.src,getVideoPreset('sunset').sphere.url);
  assert.equal(video.poster,getVideoPreset('sunset').sphere.poster);
  assert.equal(movie.getState().clipId,'sunset');
  assert.equal(movie.getState().currentTime,0);
  video.dispatchEvent(new Event('loadedmetadata'));video.decode();
  assert.equal(video.currentTime,0);assert.equal(video.paused,true);
  video.currentTime=3;movie.setSource('bands');
  video.dispatchEvent(new Event('loadedmetadata'));video.decode();
  assert.equal(video.src,getVideoPreset('sunset').bands.url);
  assert.equal(video.currentTime,3,'layout change preserves progress within the chosen movie');
  movie.setSource('bands','motion');video.dispatchEvent(new Event('loadedmetadata'));
  assert.equal(video.src,BAND_MOVIE_URL);assert.equal(video.currentTime,0);
  assert.equal(movie.video,video);assert.equal(movie.getState().requested,false);
  assert.equal(getVideoPreset('untrusted-query-value').id,'motion');
  assert.equal(new Set(VIDEO_PRESETS.map(v=>v.id)).size,VIDEO_PRESETS.length);
  movie.dispose();
});

test('the selected movie survives all world changes and selection from static content', () => {
  const video=new FakeVideo(),original=globalThis.document;
  const ctx={fillRect(){},roundRect(){},fill(){},fillText(){}};
  let model,players=0;
  globalThis.document={createElement(tag){if(tag==='video'){players++;return video;}return {width:0,height:0,getContext(){return ctx;}};}};
  try {
    model=new Auditorium(new THREE.Scene(),makeLayout(),{screenMode:'aurora'});
    model.setVideo('sunset');model.setScreen('video');video.decode();
    for(const id of ['curvature-v1','fan-v2','original']) {
      model.setLayout(makeLayout(id));
      assert.equal(model.videoId,'sunset');assert.equal(model.movie.getState().clipId,'sunset');
      assert.equal(video.src,getVideoPreset('sunset')[id==='fan-v2'?'bands':'sphere'].url);
      video.dispatchEvent(new Event('loadedmetadata'));video.decode();
      assert.equal(model.screenMaterial.uniforms.uReady.value,1);
      if(id!=='fan-v2') {
        assert.equal(model.screenMaterial.uniforms.uVerticalExponent.value,.5);
        assert.ok(model.screenMaterial.uniforms.uBands.value.every(b=>b.x===0&&Math.abs(b.y-BUILDING.screenApex)<.001));
        assert.ok(model.screenMaterial.uniforms.uAtlas.value.every(b=>b.x===0&&b.y===1));
      }
    }
    assert.equal(players,1);
  } finally {model?.dispose();globalThis.document=original;}
});
