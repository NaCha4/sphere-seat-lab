import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Auditorium } from './auditorium.js';
import { BUILDING, TIERS, PRESETS, rowPoint, rowPath, sectionAngles, makeLayout, resolveSeat, seatMetrics } from './layout.js';
import { WORLDS, getWorld } from './worlds.js';
import { bandForTier, partitionAmountForLength } from './partition-layout.js';
import { seatEye } from './seating-pose.js';
import { VIDEO_PRESETS, getVideoPreset } from './video-library.js';
import partitionFootprint from './data/partition-footprint.json' with { type: 'json' };
import { SOURCES, CONFIDENCE } from './evidence.js';
import { XR_OVERLAY_ORDER, overlayMaterial, pickTarget, createAimPointer, isMenuButtonPressed, pollMenuToggle } from './interaction.js';

const icon = (name, size = 18) => {
  const paths = {
    sphere: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6c4 3 10 3 14 0M5 18c4-3 10-3 14 0"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    cube: '<path d="m12 2 9 5v10l-9 5-9-5V7l9-5ZM3 7l9 5 9-5M12 12v10"/>',
    vr: '<path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4l-4-4-4 4H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="M6 9v4M18 9v4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>',
    reset: '<path d="M3 10a9 9 0 1 1 1 7M3 4v6h6"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    camera: '<path d="M8 5 6 8H3v12h18V8h-3l-2-3H8Z"/><circle cx="12" cy="14" r="4"/>',
    link: '<path d="m9 15 6-6M8 17l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 7l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.eye}</svg>`;
};

const app = document.querySelector('#app');
app.innerHTML = `
  <div id="viewport" aria-label="Sphere 3D 공연장"></div>
  <div id="veil"></div>
  <header class="masthead">
    <a class="brand" href="./" aria-label="Sphere Seat Lab 홈">${icon('sphere', 31)}<span>SPHERE<span class="brand-sub">SEAT LAB</span></span></a>
    <div class="project-heading"><span class="eyebrow">LAS VEGAS / RESEARCH MODEL 15</span><h1>좌석에서 만나는 스피어</h1></div>
    <div class="header-actions"><button class="icon-button" id="research" aria-label="모델 근거와 출처">${icon('info')}</button><button class="vr-button" id="vr">${icon('vr', 20)}<span>VR 시작</span></button></div>
  </header>
  <aside class="sidebar" aria-label="좌석과 보기 설정">
    <div class="panel-title"><div><span class="eyebrow">FIXED BOWL / RECONSTRUCTION</span><h2>나의 관람 위치</h2></div><span class="live-dot" title="원본 모델"></span></div>
    <div class="world-controls"><label class="field">객석 월드<select id="world">${WORLDS.map(w => `<option value="${w.id}">${w.label}</option>`).join('')}</select></label><p id="world-description"></p></div>
    <label class="field movie-field">재생 영상<select id="movie">${VIDEO_PRESETS.map(v => `<option value="${v.id}">${v.label}</option>`).join('')}</select></label>
    <p class="movie-credit" id="movie-credit" hidden><a id="movie-credit-link" target="_blank" rel="noopener noreferrer"></a></p>
    <section id="partition-controls" class="partition-controls" hidden>
      <h3>상향 차양 · 길이 조절</h3><p>하부 영상 상단: 36m · 기존 24.4m<br>평탄화 구간의 안쪽 끝부터 15° 상승<br>일자 시작선 · 가로 시야 100° 기준 곡선 끝</p>
      <button id="partition-toggle" type="button">차양 수동 전개</button>
      <button id="partition-fit" type="button">완전히 접기 · 0m</button>
      <label class="partition-range">돌출 길이 <input id="partition-amount" type="range" min="0" max="${partitionFootprint.maximumProjectionMetres * 100}" step="5" value="0"><output id="partition-value">0.00m</output></label>
      <div class="partition-length-controls"><button id="partition-shorter" type="button" aria-label="차양 10cm 줄이기">−10cm</button><label>직접 입력 <input id="partition-length" aria-label="차양 길이 (m)" type="number" min="0" max="${partitionFootprint.maximumProjectionMetres}" step="0.05" value="0.00" inputmode="decimal">m</label><button id="partition-longer" type="button" aria-label="차양 10cm 늘리기">+10cm</button><button id="partition-apply" type="button">입력 길이 적용</button></div>
      <p id="partition-status" role="status"></p>
      <div class="partition-views"><button data-band-view="0">1·2층 보기</button><button data-band-view="1">3·4층 보기</button></div>
      <p>평탄화 구간의 객석 쪽 가장 안쪽에서 차양이 시작됩니다. 그 구간까지 한 장의 15° 경사면으로 이어집니다. 길이는 평탄화 구간의 앞끝에서 추가로 뻗는 중앙 기준 거리이며, 0–${partitionFootprint.maximumProjectionMetres}m를 직접 조절합니다. 끝은 양옆으로 둥글어지고 스크린·건물 경계에서 멈추지 않습니다.</p>
    </section>
    <div class="view-tabs" role="group" aria-label="보기 방식"><button id="seat-view" class="active">${icon('eye', 16)}좌석 시점</button><button id="overview">${icon('cube', 16)}전체 구조</button></div>
    <div class="map-wrap"><svg id="seat-map" viewBox="0 0 300 218" role="img" aria-label="좌석 구역 지도"></svg><span class="map-caption">구역을 눌러 이동하세요</span></div>
    <div class="tier-tabs" role="group" aria-label="객석 층">${TIERS.map(t => `<button data-tier="${t.id}" style="--tier-color:${t.color}">${t.id}</button>`).join('')}</div>
    <div class="location-form">
      <label class="field">구역<select id="section" aria-label="구역"></select></label>
      <div class="row-controls"><label class="field">행<select id="row" aria-label="행"></select></label><label class="field">행 내 위치<select id="number" aria-label="행 내 가상 위치"></select></label></div>
    </div>
    <button class="primary-button" id="go-seat">이 좌석에서 보기 ${icon('arrow')}</button>
    <section class="comparison-panel" aria-label="원본과 변형안 시야 비교"><h3>같은 구역에서 전후 비교</h3><div class="compare-seats"><button id="compare-209">209 구역</button><button id="compare-210">210 구역</button></div><p id="comparison-caption"></p><div id="comparison-result" role="status" aria-live="polite">계산 준비 중…</div><p class="comparison-note">방향 차이: 좌석 정면과 전방 기준점의 차이.<br>머리 가림: 전면 LED 표본 광선 중 머리가 가린 수.<br>좌석별 관람 자세 반영 · 내 자리 제외.<br>몸통·난간·구조물은 수치에서 제외합니다.</p></section>
    <div class="section-divider"></div>
    <div class="preset-heading"><h3>다른 시야 살펴보기</h3><span>QUICK VIEWS</span></div>
    <div class="presets">${PRESETS.map((p, i) => `<button data-preset="${i}"><span>${p.label}</span><small>${p.section} · ${p.row}행</small></button>`).join('')}</div>
    <div class="section-divider"></div>
    <label class="field">스크린 콘텐츠<select id="content"><option value="video">Chromatic Flux · 360° 모션그래픽</option><option value="aurora">오로라 · 정지 화면</option><option value="earth">지구 · 공간감 보기</option><option value="grid">격자 · 화면 범위 보기</option><option value="stars">별빛 · 스크린 콘텐츠</option></select></label>
    <div class="playback-controls"><button id="video-playback" type="button">영상 일시정지</button><span id="video-status" role="status" aria-live="polite">20초 반복 · 무음</span></div>
    <div class="display-options"><label><input type="checkbox" id="audience">관객 채우기 · 내 자리 제외</label><label><input type="checkbox" id="labels">구역 번호 표시</label><label><input type="checkbox" id="event-stage">U2 2023 무대 표시</label></div>
    <p class="sidebar-note"><span id="movie-description">회전하는 네온 궤도와 확산하는 링으로 구성한 360° 모션그래픽입니다.</span><br>무음 반복 · 실제 공연 영상 아님<br>VR 메뉴: 오른손 A · 왼손 X<br>구조 구분: 검은 후방 천장 · 회갈색 객석 하부<br>숫자는 행 안의 가상 위치입니다.<br>2023 도면의 하부 평면을 반영했습니다.<br>높이와 상층 좌표는 추정입니다.</p>
  </aside>
  <main class="scene-ui">
    <div class="scene-caption"><span class="tag">RESEARCH 15</span><span id="view-description">1인칭 · 드래그해서 둘러보기</span></div>
    <div class="scene-tools"><button id="reset" class="tool-button" title="시선 초기화">${icon('reset')}<span>시선 초기화</span></button><button id="screenshot" class="icon-button" title="현재 화면 이미지 저장" aria-label="현재 화면 이미지 저장">${icon('camera')}</button><button id="share" class="icon-button" title="현재 좌석 링크 복사" aria-label="현재 좌석 링크 복사">${icon('link')}</button></div>
    <div class="seat-card"><div class="seat-card-main"><span class="eyebrow" id="tier-name">TERRACE / 200 LEVEL</span><div><strong id="selected-section">206</strong><span id="selected-position">10행 · 13번</span></div><span class="seat-description" id="seat-description">중앙에서 무대와 화면을 함께 확인하세요.</span></div><div class="seat-stats"><div><span>전방 기준점까지</span><strong id="distance">—</strong></div><div><span>모델상 눈높이</span><strong id="height">—</strong></div><div><span>기준점 방향 차이</span><strong id="yaw">—</strong></div></div><div class="metrics-note">거리·각도는 추정 좌표의 계산값이며 실측값이 아닙니다.</div></div>
    <div class="bottom-line"><span class="interaction-hint" id="hint">마우스 드래그: 시선 이동 <span>·</span> 휠: 확대 <span>·</span> R: 초기화</span><button id="model-info">공개 자료 기반 재구성 ${icon('info', 13)}</button></div>
  </main>
  <button class="mobile-panel-button" id="mobile-panel">${icon('eye', 16)}좌석 선택</button>
  <div id="toast" role="status" aria-live="polite"></div>
  <dialog id="info-dialog"><button class="dialog-close icon-button" aria-label="닫기">${icon('close')}</button><div class="dialog-kicker">ABOUT THIS RECONSTRUCTION</div><h2>공식 데이터와 추정 구조</h2><p class="dialog-intro">공식 예매 데이터의 39개 구역·숫자 행·행별 좌석 수를 적용했습니다. 13,830개 일반 좌석 위치를 표시하며, 별도 WC 178개 위치와 가변 앞좌석은 좌표 미확보로 생성하지 않습니다. 전체 공식 수용 인원과는 집계 범위가 다릅니다.</p><div class="evidence-levels">${CONFIDENCE.map(([title, body], i) => `<div><span class="level-number">0${i + 1}</span><section><h3>${title}</h3><p>${body}</p></section></div>`).join('')}</div><div class="important-note">V1은 교수 피드백을 적용해 의도적으로 변형한 수업용 설계 실험이며 실제 스피어 구조가 아닙니다. 2023 U2 작업 도면의 축척으로 하부 객석 평면을 다시 맞췄습니다. 두 주요 통로와 꺾이는 열, 발코니 전면, 계단형 LED 끝단과 검은 후방 천장을 반영했습니다. 이 자료는 준공 CAD가 아니며 숨겨진 뒷열·상층 평면·높이·패널 치수는 추정입니다. 300번대 높이는 하층 관객과의 간섭을 없애기 위해 기존 추정에서 1.5m 보정했습니다. 행 내 번호는 실제 티켓 번호가 아닙니다. 이 모델만으로 실제 시야·가림의 정도를 입증할 수 없습니다. U2 무대는 별도로 켤 수 있으며 높이는 추정입니다.</div><h3 class="source-heading">조사 출처 <span>2026.10.20 확인</span></h3><div class="sources">${SOURCES.map((s, i) => `<a href="${s.url}" target="_blank" rel="noopener noreferrer"><span class="source-number">${String(i + 1).padStart(2, '0')}</span><div><small>${s.type}</small><strong>${s.name} ↗</strong><p>${s.note}</p></div></a>`).join('')}</div><p class="educational-note">Independent educational reconstruction. Not affiliated with or endorsed by Sphere Entertainment. 실제 공연 영상과 원본 도면 이미지는 이 사이트에 재배포하지 않습니다.</p></dialog>
`;

const $ = id => document.getElementById(id);
const query = new URLSearchParams(location.search);
let selectedVideoId = getVideoPreset(query.get('video')).id;
let currentWorld = getWorld(query.get('world'));
let comparisonWorld = currentWorld.id === 'original' ? WORLDS[1] : currentWorld;
const layoutCache = new Map();
function worldLayout(world) {
  if (!layoutCache.has(world.id)) {
    if (layoutCache.size >= 3) layoutCache.delete(layoutCache.keys().next().value);
    layoutCache.set(world.id, makeLayout(world.id));
  }
  return layoutCache.get(world.id);
}
let layout = worldLayout(currentWorld);
let currentSeat = resolveSeat(layout, { section: query.get('section') || 206, row: query.get('row') || 10, number: query.get('seat') });
let view = 'seat', contentMode = 'video', labelsVisible = false, audienceEnabled = false;
let renderer, model, orbit;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#030405');
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .05, 550);
const rig = new THREE.Group(); rig.add(camera); scene.add(rig);
const hemisphere = new THREE.HemisphereLight('#afc6ed', '#101d27', 2.2); scene.add(hemisphere);
const keyLight = new THREE.DirectionalLight('#afcde3', 1.25); keyLight.position.set(10, 55, -45); scene.add(keyLight);
const fillLight = new THREE.DirectionalLight('#798aa5', .55); fillLight.position.set(-30, 25, 30); scene.add(fillLight);
const raycaster = new THREE.Raycaster();
let drag = null, yaw = currentSeat.yaw, pitch = .06, framePose = null, pendingVrAlign = false, vrSupported = false;
const controllers = [], xrButtons = [], xrWorldButtons = [];
let xrPanel = null, xrSummary = null, xrPartitionButton = null, xrVideoButton = null, worldPage = Math.floor(WORLDS.indexOf(currentWorld) / 2), lastStick = 0, lastAimUpdate = -Infinity;
const xrPartitionStepButtons = [];
let comparisonWorker = null, comparisonRequest = 0, comparisonResult = null, comparisonError = false;
try {
  comparisonWorker = new Worker(new URL('./comparison-worker.js', import.meta.url), { type: 'module' });
  comparisonWorker.onmessage = ({ data }) => {
    if (data.request !== comparisonRequest) return;
    comparisonResult = data.result ?? null;
    comparisonError = Boolean(data.error); renderComparison(comparisonError); updateXrSummary();
  };
  comparisonWorker.onerror = () => {
    comparisonWorker?.terminate(); comparisonWorker = null; comparisonResult = null; comparisonError = true;
    renderComparison(true); updateXrSummary();
  };
} catch { /* The viewer still works if module workers are unavailable. */ }

function requestComparison() {
  comparisonResult = null;
  $('comparison-caption').textContent = `${currentSeat.section} 구역 · ${currentSeat.row}행 · ${currentSeat.number}번째 / ${comparisonWorld.label}`;
  if (currentWorld.partitions && model?.getPartitionState()?.moving) {
    comparisonRequest++; renderComparison(); updateXrSummary(); return;
  }
  comparisonError = !comparisonWorker;
  renderComparison(!comparisonWorker); updateXrSummary();
  comparisonWorker?.postMessage({ request: ++comparisonRequest, worldId: comparisonWorld.id,
    selection: { section: currentSeat.section, row: currentSeat.row, number: currentSeat.number, worldId: currentWorld.id }, audience: audienceEnabled, partitionAmount: model?.getPartitionState()?.amount ?? 0 });
}

function renderComparison(error = false) {
  if (currentWorld.partitions) {
    const p = comparisonResult?.partition;
    if (!p) { $('comparison-result').textContent = error ? '시야 계산을 사용할 수 없습니다.' : model?.getPartitionState()?.moving ? '차양이 멈추면 시야를 계산합니다.' : '차양 시야 계산 중…'; return; }
    $('comparison-result').innerHTML = `<table><thead><tr><th>영상 구역</th><th>차양 가림</th><th>차양 가림 없음</th></tr></thead><tbody>${p.bands.map(b => `<tr><th>${b.id === 1 ? '1·2층' : '3·4층'}${b.id === p.ownBand ? ' (내 구역)' : ''}</th><td>${b.blocked}/${b.samples}</td><td>${b.visible}/${b.samples}</td></tr>`).join('')}</tbody></table><p>${p.protectionRequired ? `상부 착석 시야에 남는 하부 영상: ${p.leakage}/${p.otherSamples}.` : `하부는 완전 분리 대상이 아닙니다. 상부 영상 노출 ${p.leakage}/${p.otherSamples}은 허용합니다.`} 내 구역 가림 ${p.ownBlocked}. 시선 고도 ${p.pitchDegrees.toFixed(1)}° · 시야 ${p.viewField.horizontalDegrees}° × ${p.viewField.verticalDegrees}°. 좌석·난간·관객 가림과 고개 회전은 제외합니다.</p>`;
    return;
  }
  if (!comparisonResult) { $('comparison-result').textContent = error ? '이 브라우저에서 비교 계산을 실행하지 못했습니다.' : '같은 조건으로 계산 중…'; return; }
  const { original, variant } = comparisonResult;
  $('comparison-result').innerHTML = `<table><thead><tr><th>모델 추정값</th><th>원본</th><th>${comparisonWorld.shortLabel}</th></tr></thead><tbody><tr><th>일반 좌석 수</th><td>${original.seatCount.toLocaleString()}</td><td>${variant.seatCount.toLocaleString()}</td></tr><tr><th>방향 차이</th><td>${original.turnDegrees.toFixed(1)}°</td><td>${variant.turnDegrees.toFixed(1)}°</td></tr><tr><th>머리 가림</th><td>${original.blocked}/${original.samples}</td><td>${variant.blocked}/${variant.samples}</td></tr></tbody></table><p>같은 구역의 가까운 행·상대 위치를 비교합니다. ${original.row}행 ${original.number}번째 ↔ ${variant.row}행 ${variant.number}번째.<br>${audienceEnabled ? '머리 가림은 표본 광선 수이며 실제 가림률·안전성 검증값이 아닙니다.' : '관객을 켜면 자세와 좌석 수를 반영해 머리 가림을 비교합니다.'}</p>`;
}

function setWorld(id) {
  const next = getWorld(id);
  if (next.id === currentWorld.id) return;
  clearAimPreview();
  const selection = { section: currentSeat.section, row: currentSeat.row, number: currentSeat.number };
  const oldRow = layout.bySection.get(currentSeat.section).rows.get(currentSeat.row);
  const fraction = (currentSeat.number-.5)/oldRow.length;
  const nextLayout = worldLayout(next);
  model?.setLayout(nextLayout);
  currentWorld = next; layout = nextLayout;
  if (next.id !== 'original') comparisonWorld = next;
  else if (comparisonWorld.partitions) comparisonWorld = WORLDS[1];
  if (next.partitions) { contentMode = 'video'; $('content').value = 'video'; }
  const near = resolveSeat(layout, selection), newRow = layout.bySection.get(near.section).rows.get(near.row);
  setSeat(resolveSeat(layout, { section: near.section, row: near.row, number: Math.floor(fraction*newRow.length)+1 }), false);
  model?.setOverview(renderer?.xr.isPresenting ? false : view === 'overview', labelsVisible);
  worldPage = Math.floor(WORLDS.indexOf(next) / 2); refreshWorldButtons(); updatePartitionUI(); updatePlaybackUI();
  toast(`${next.label} · 같은 구역의 대응 위치로 전환했습니다.`);
}


function toast(message) {
  $('toast').textContent = message; $('toast').classList.add('visible');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => $('toast').classList.remove('visible'), 3300);
}

function drawMap() {
  const pos = (x, z) => [150 + x * 1.78, 123 + z * 1.5];
  const arcPath = s => {
    const front = sectionAngles(s.tier, s.id, s.range.first), rear = sectionAngles(s.tier, s.id, s.range.last);
    const points = [...rowPath(s.tier, s.range.first - .5, front.start, front.end), ...rowPath(s.tier, s.range.last + .5, rear.start, rear.end).reverse()];
    return 'M' + points.map(p => pos(p.x, p.z).join(',')).join('L') + 'Z';
  };
  let svg = '<text x="150" y="25" text-anchor="middle" fill="#70848d" font-size="8" letter-spacing="2">SCREEN / FRONT</text>';
  for (const s of [...layout.sections].reverse()) {
    const selected = currentSeat.section === s.id;
    svg += `<path d="${arcPath(s)}" fill="${selected ? '#b4ddcd' : s.tier.color}" fill-opacity="${selected ? 1 : .22}" stroke="${selected ? '#d8eee4' : '#68808a'}" stroke-width="${selected ? 1 : .3}" data-map-section="${s.id}" tabindex="0" role="button" aria-label="${s.id} 구역"/>`;
    if (selected) { const point = rowPoint(s.tier, (s.range.first + s.range.last) / 2, s.center), p = pos(point.x, point.z); svg += `<text x="${p[0]}" y="${p[1] + 3}" text-anchor="middle" font-size="8" font-weight="700" fill="#071512" pointer-events="none">${s.id}</text>`; }
  }
  const marker = pos(currentSeat.x, currentSeat.z);
  svg += `<circle cx="${marker[0]}" cy="${marker[1]}" r="2.4" fill="#edcc91" stroke="#111b1d" stroke-width="1"/>`;
  $('seat-map').innerHTML = svg;
  $('seat-map').querySelectorAll('[data-map-section]').forEach(el => {
    const activate = () => setSeat(resolveSeat(layout, { section: el.dataset.mapSection, row: currentSeat.row }));
    el.addEventListener('click', activate); el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
  });
}

function populateInputs() {
  const t = TIERS.find(tier => tier.id === currentSeat.tier), group = layout.bySection.get(currentSeat.section);
  $('section').innerHTML = Array.from({ length: t.last - t.first + 1 }, (_, i) => `<option value="${t.first + i}">${t.first + i} 구역</option>`).join('');
  $('section').value = String(currentSeat.section);
  $('row').innerHTML = Array.from(group.rows.keys(), r => `<option value="${r}">${r}행</option>`).join(''); $('row').value = String(currentSeat.row);
  $('number').innerHTML = group.rows.get(currentSeat.row).map(s => `<option value="${s.number}">${s.number}번째</option>`).join(''); $('number').value = String(currentSeat.number);
  document.querySelectorAll('[data-tier]').forEach(b => { b.classList.toggle('active', Number(b.dataset.tier) === currentSeat.tier); b.setAttribute('aria-pressed', String(Number(b.dataset.tier) === currentSeat.tier)); });
}

function updateInfo() {
  const tier = TIERS.find(t => t.id === currentSeat.tier), metrics = seatMetrics(currentSeat);
  $('selected-section').textContent = currentSeat.section; $('selected-position').textContent = `${currentSeat.row}행 · ${currentSeat.number}번째`;
  $('tier-name').textContent = `${tier.name.toUpperCase()} / ${tier.id} LEVEL`;
  $('distance').innerHTML = `${metrics.distance.toFixed(1)}<small>m</small>`;
  $('height').innerHTML = `${metrics.elevation.toFixed(1)}<small>m</small>`;
  $('yaw').innerHTML = `${Math.abs(metrics.yawDifference * 180 / Math.PI).toFixed(1)}<small>°</small>`;
  const isRear = currentSeat.tier === 100 && currentSeat.row >= 24;
  $('seat-description').textContent = currentWorld.partitions ? `${currentSeat.tier < 300 ? '하부 · 전방을 보는 자세' : '상부 · 천장을 보는 자세'} / 시선 고도 ${(currentSeat.viewPitch * 180 / Math.PI).toFixed(1)}°` : isRear ? '하부 후방에서 상부 구조의 가림을 살펴보세요.' : currentSeat.tier === 400 ? '상부에서 화면과 객석의 관계를 확인하세요.' : Math.abs(currentSeat.theta) > .42 ? '측면에서 화면과 좌석 방향의 관계를 비교하세요.' : '중앙에서 화면과 객석의 관계를 확인하세요.';
  $('world').value = currentWorld.id; $('world-description').textContent = `${currentWorld.description} 일반 좌석 ${layout.seats.length.toLocaleString()}석.`;
  const params = new URLSearchParams({ world: currentWorld.id, section: currentSeat.section, row: currentSeat.row, seat: currentSeat.number, video: selectedVideoId });
  history.replaceState(null, '', `${location.pathname}?${params}`);
  populateInputs(); drawMap(); updatePartitionUI(); requestComparison();
}

function alignVr() {
  if (!framePose) { pendingVrAlign = true; return; }
  const p = framePose.transform.position, q = framePose.transform.orientation;
  const headEuler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w), 'YXZ');
  rig.rotation.set(0, currentSeat.yaw - headEuler.y, 0);
  const offset = new THREE.Vector3(p.x, p.y, p.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), rig.rotation.y);
  const eye = seatEye(currentSeat, BUILDING.eyeHeight);
  rig.position.set(eye.x, eye.y, eye.z).sub(offset);
  pendingVrAlign = false; placeXrPanel();
}

function setSeat(seat, changeView = true) {
  clearAimPreview();
  currentSeat = seat; model?.select(seat); updateInfo();
  if (renderer?.xr.isPresenting) { alignVr(); return; }
  if (changeView) setView('seat');
  if (view === 'seat') resetView();
}

function resetView() {
  if (!renderer) return;
  if (renderer.xr.isPresenting) { alignVr(); return; }
  rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
  if (view === 'seat') {
    const eye = seatEye(currentSeat, BUILDING.eyeHeight);
    camera.position.set(eye.x, eye.y, eye.z);
    yaw = currentSeat.yaw; pitch = currentSeat.viewPitch ?? .06; camera.rotation.set(pitch, yaw, 0, 'YXZ'); camera.fov = 72;
  } else {
    camera.position.set(108, 111, 123); orbit.target.set(0, 26, -5); orbit.update(); camera.fov = 55;
  }
  camera.updateProjectionMatrix();
}

function setView(next) {
  if (renderer?.xr.isPresenting) return;
  view = next; $('seat-view').classList.toggle('active', next === 'seat'); $('overview').classList.toggle('active', next === 'overview');
  document.body.classList.toggle('overview-mode', next === 'overview');
  hemisphere.intensity = next === 'overview' ? 4 : 2.2;
  keyLight.intensity = next === 'overview' ? 1.8 : 1.25;
  fillLight.intensity = next === 'overview' ? 1.1 : .55;
  clearAimPreview();
  $('view-description').textContent = next === 'seat' ? '1인칭 · 드래그해서 둘러보기' : '전체 구조 · 드래그 회전 / 휠 확대';
  $('hint').innerHTML = next === 'seat' ? '마우스 드래그: 시선 이동 <span>·</span> 휠: 확대 <span>·</span> R: 초기화' : '좌석을 클릭하면 그 위치로 이동합니다 <span>·</span> 반투명 면: 내부 LED';
  orbit.enabled = next === 'overview'; model?.setOverview(next === 'overview', labelsVisible); resetView();
}

function moveRelative({ section = 0, row = 0, number = 0 } = {}) {
  const tier = TIERS.find(t => t.id === currentSeat.tier);
  const nextSection = THREE.MathUtils.clamp(currentSeat.section + section, tier.first, tier.last);
  const rows = [...layout.bySection.get(nextSection).rows.keys()];
  const index = rows.indexOf(resolveSeat(layout,{section:nextSection,row:currentSeat.row}).row);
  setSeat(resolveSeat(layout, { section: nextSection, row: rows[Math.max(0,Math.min(rows.length-1,index+row))], number: section ? null : currentSeat.number + number }));
}

function setAudienceEnabled(enabled) {
  audienceEnabled = enabled; $('audience').checked = enabled;
  model?.setAudience(enabled, currentSeat); requestComparison();
}

function updatePlaybackUI() {
  const state = model?.getVideoState(), active = contentMode === 'video';
  const playing = state?.playing || (state?.status === 'loading' && state?.requested);
  $('video-playback').disabled = !active;
  $('video-playback').textContent = playing ? '영상 일시정지' : '영상 재생';
  $('video-playback').setAttribute('aria-label', playing ? '스크린 영상 일시정지' : '스크린 영상 재생');
  const duration = Math.round(state?.duration || getVideoPreset(selectedVideoId).duration);
  const messages = { loading: '영상을 불러오는 중…', buffering: '영상 버퍼링 중…', blocked: '재생 버튼을 눌러 시작하세요', error: state?.error, paused: `일시정지 · ${duration}초 반복 · 무음`, playing: `재생 중 · ${duration}초 반복 · 무음` };
  $('video-status').textContent = active ? messages[state?.status] || '무음 반복 영상' : '정지 화면';
}

function updateVideoUI() {
  const video = getVideoPreset(selectedVideoId);
  $('movie').value = video.id;
  $('content').options[0].textContent = `${video.shortLabel} · 동영상`;
  $('movie-description').textContent = video.description;
  $('movie-credit').hidden = !video.credit;
  $('movie-credit-link').textContent = video.credit ? `영상 출처: ${video.credit} ↗` : '';
  if (video.creditUrl) $('movie-credit-link').href = video.creditUrl;
  if (xrVideoButton) {
    const text = `다음 영상 · ${video.shortLabel}`;
    if (xrVideoButton.userData.caption !== text) {
      const ctx = xrVideoButton.userData.canvas.getContext('2d');
      ctx.fillStyle = '#15292f'; ctx.fillRect(0,0,384,144); ctx.strokeStyle = '#698d86'; ctx.lineWidth = 3; ctx.strokeRect(3,3,378,138);
      ctx.fillStyle = '#e3f0e9'; ctx.font = '500 37px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text,192,72,360);
      xrVideoButton.material.map.needsUpdate = true; xrVideoButton.userData.caption = text;
    }
  }
}

function setVideoPreset(id) {
  selectedVideoId = getVideoPreset(id).id;
  model?.setVideo(selectedVideoId);
  if (contentMode !== 'video') setContentMode('video');
  else updatePlaybackUI();
  updateVideoUI();
  const params = new URLSearchParams(location.search); params.set('video',selectedVideoId);
  history.replaceState(null,'',`${location.pathname}?${params}`);
}

function cycleVideoPreset() {
  const index = VIDEO_PRESETS.findIndex(v => v.id === selectedVideoId);
  setVideoPreset(VIDEO_PRESETS[(index+1)%VIDEO_PRESETS.length].id);
}

function setContentMode(mode) {
  if (currentWorld.partitions) mode = 'video';
  contentMode = mode; $('content').value = mode;
  model?.setScreen(mode); updatePlaybackUI();
}

function toggleVideoPlayback() {
  if (contentMode !== 'video') { setContentMode('video'); void model?.setVideoPlaying(true); return; }
  const state = model.getVideoState();
  void model.setVideoPlaying(!(state.playing || (state.status === 'loading' && state.requested)));
  updatePlaybackUI();
}

function createXrPanel() {
  xrPanel = new THREE.Group(); xrPanel.visible = false; scene.add(xrPanel);
  xrPanel.renderOrder = XR_OVERLAY_ORDER;
  const actions = [
    ...[0, 1].map(slot => ['', () => { const world = WORLDS[worldPage * 2 + slot]; if (world) setWorld(world.id); }]),
    [WORLDS.length > 2 ? '다음 월드 목록' : '209 ↔ 210', () => {
      if (WORLDS.length > 2) { worldPage = (worldPage + 1) % Math.ceil(WORLDS.length / 2); refreshWorldButtons(); }
      else setSeat(resolveSeat(layout, { section: currentSeat.section === 209 ? 210 : 209, row: currentSeat.row }));
    }],
    ['이전 구역', () => moveRelative({ section: -1 })], ['다음 구역', () => moveRelative({ section: 1 })],
    ['앞 행', () => moveRelative({ row: -1 })], ['뒤 행', () => moveRelative({ row: 1 })],
    ['다른 층', () => { if (currentWorld.partitions) { visitBand(bandForTier(currentSeat.tier).id % 2); return; } const i = TIERS.findIndex(t => t.id === currentSeat.tier); const t = TIERS[(i + 1) % TIERS.length]; setSeat(resolveSeat(layout, { section: Math.floor((t.first + t.last) / 2), row: 10 })); }],
    ['VR 종료', () => renderer.xr.getSession()?.end()],
    ['관객 켜기/끄기', () => setAudienceEnabled(!audienceEnabled)],
    ['영상 재생/정지', toggleVideoPlayback],
    ['다음 영상', cycleVideoPreset],
    ['차양 접기/펼치기', togglePartitions],
    ['차양 −25cm', shortenPartition],
    ['차양 +25cm', lengthenPartition],
  ];
  actions.forEach(([text, action], i) => {
    const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 144;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#15292f'; ctx.fillRect(0, 0, 384, 144); ctx.strokeStyle = '#698d86'; ctx.lineWidth = 3; ctx.strokeRect(3, 3, 378, 138);
    ctx.fillStyle = '#e3f0e9'; ctx.font = '500 47px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 192, 72, 360);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.43, .16), overlayMaterial({ map }));
    const column = i % 3;
    mesh.position.set((column - 1) * .46, Math.floor(i / 3) * -.19, 0); mesh.userData.action = action; mesh.renderOrder = XR_OVERLAY_ORDER;
    xrPanel.add(mesh); xrButtons.push(mesh);
    if (action === togglePartitions) { xrPartitionButton = mesh; mesh.userData.canvas = canvas; }
    if (action === shortenPartition || action === lengthenPartition) xrPartitionStepButtons.push(mesh);
    if (action === cycleVideoPreset) { xrVideoButton = mesh; mesh.userData.canvas = canvas; }
    if (i < 2) { mesh.userData.canvas = canvas; mesh.userData.slot = i; xrWorldButtons.push(mesh); }
  });
  const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 100;
  // Keep this texture static during XR. Repainting a dark foreground panel on
  // every target change can flash/stall on the headset. The chair itself gives
  // live target feedback; this line is a background-free, fixed instruction.
  const ctx = canvas.getContext('2d');
  ctx.font = '500 33px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#baffdf';
  ctx.fillText('A / X : 메뉴 켜기·끄기  ·  핀치·트리거 : 좌석 이동', 500, 50, 940);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  const caption = new THREE.Mesh(new THREE.PlaneGeometry(1.36, .136), overlayMaterial({ map }));
  caption.position.set(0, .17, 0); caption.renderOrder = XR_OVERLAY_ORDER;
  xrPanel.add(caption);
  const summaryCanvas = document.createElement('canvas'); summaryCanvas.width = 1400; summaryCanvas.height = 210;
  const summaryTexture = new THREE.CanvasTexture(summaryCanvas); summaryTexture.colorSpace = THREE.SRGBColorSpace;
  xrSummary = new THREE.Mesh(new THREE.PlaneGeometry(1.36, .204), overlayMaterial({ map: summaryTexture }));
  xrSummary.position.set(0, -Math.ceil(actions.length / 3) * .19 - .01, 0);
  xrSummary.renderOrder = XR_OVERLAY_ORDER; xrSummary.userData.canvas = summaryCanvas; xrPanel.add(xrSummary);
  refreshWorldButtons(); updateXrSummary(); updateVideoUI();
}

function refreshWorldButtons() {
  for (const button of xrWorldButtons) {
    const world = WORLDS[worldPage * 2 + button.userData.slot];
    button.visible = Boolean(world); if (!world) continue;
    const canvas = button.userData.canvas, ctx = canvas.getContext('2d'), selected = world.id === currentWorld.id;
    ctx.fillStyle = selected ? '#305747' : '#15292f'; ctx.fillRect(0, 0, 384, 144);
    ctx.strokeStyle = selected ? '#baffdf' : '#698d86'; ctx.lineWidth = 5; ctx.strokeRect(3, 3, 378, 138);
    ctx.fillStyle = '#e3f0e9'; ctx.font = '500 43px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${selected ? '● ' : ''}${world.shortLabel}`, 192, 72, 360);
    button.material.map.needsUpdate = true;
  }
}

function updateXrSummary() {
  if (!xrSummary) return;
  // Refresh only on a real seat/world/setting change or completed calculation,
  // never while a pointer merely hovers over another chair.
  const canvas = xrSummary.userData.canvas, ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#d9f5e6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '500 42px system-ui';
  ctx.fillText(`${currentWorld.label} | ${currentSeat.section} · ${currentSeat.row}행 · ${currentSeat.number}번째`, 700, 35, 1360);
  if (comparisonResult?.partition) {
    const p = comparisonResult.partition; ctx.font = '38px system-ui';
    ctx.fillText(`${p.ownBand === 1 ? '1·2층' : '3·4층'} 영상 구역 · 차양 돌출 ${(p.amount * partitionFootprint.maximumProjectionMetres).toFixed(2)}m`, 700, 99, 1360);
    ctx.fillText(`${p.protectionRequired ? '상부 차광 대상' : '하부 노출 허용'}: 다른 영상 ${p.leakage}/${p.otherSamples} · 내 구역 가림 ${p.ownBlocked}`, 700, 162, 1360);
  } else if (comparisonResult) {
    const a = comparisonResult.original, b = comparisonResult.variant;
    ctx.font = '38px system-ui';
    ctx.fillText(`원본 → ${comparisonWorld.shortLabel}   방향 ${a.turnDegrees.toFixed(1)}° → ${b.turnDegrees.toFixed(1)}°`, 700, 99, 1360);
    ctx.fillText(audienceEnabled ? `머리 가림 표본 ${a.blocked} → ${b.blocked} / ${a.samples} (추정)` : '관객 켜기: 머리 가림 비교 · 눈높이 1.18m (추정)', 700, 162, 1360);
  } else { ctx.font = '36px system-ui'; ctx.fillText(comparisonError ? '비교 계산을 사용할 수 없습니다.' : model?.getPartitionState()?.moving ? `차양 돌출 ${model.getPartitionState().projectionMetres.toFixed(2)}m` : '같은 좌석 조건으로 비교 계산 중…', 700, 114, 1360); }
  xrSummary.material.map.needsUpdate = true;
}

function clearAimPreview() {
  for (const state of controllers) { state.target = null; state.dot.visible = false; state.ray.scale.z = 6; }
  for (const button of xrButtons) button.material.color.set('#ffffff');
  model?.setHoverSeats([]); lastAimUpdate = -Infinity;
}

function updateAimTarget(state) {
  state.controller.updateWorldMatrix(true, false);
  controllerRay(state.controller);
  state.target = pickTarget(raycaster, xrButtons, model.pickables, layout.seats, model.fans?.membranes.map(p => p.mesh) ?? []);
  const distance = state.target?.distance ?? 6;
  state.ray.scale.z = distance;
  state.dot.visible = Boolean(state.target);
  state.dot.position.z = -distance;
  state.dot.scale.setScalar(Math.max(1, distance * .1));
  state.ray.material.color.set(state.target ? '#77ffe0' : '#badfcf');
}

function showAimPreview() {
  model.setHoverSeats(controllers.map(s => s.target?.seat).filter(Boolean));
  for (const button of xrButtons) button.material.color.set(controllers.some(s => s.target?.object === button) ? '#baffdf' : '#ffffff');
}

function setXrMenuVisible(visible) {
  if (!xrPanel) return;
  xrPanel.visible = visible;
  clearAimPreview();
  if (visible) placeXrPanel(true);
}

function placeXrPanel(faceViewer = false) {
  if (!xrPanel) return;
  const direction = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), currentSeat.yaw);
  const seatedEye = seatEye(currentSeat);
  const eye = new THREE.Vector3(seatedEye.x, seatedEye.y, seatedEye.z);
  if (faceViewer && framePose) {
    const { position: p, orientation: q } = framePose.transform;
    rig.updateWorldMatrix(true, false);
    eye.set(p.x, p.y, p.z).applyMatrix4(rig.matrixWorld);
    direction.set(0, 0, -1).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w)).applyQuaternion(rig.quaternion);
    direction.y = 0;
    if (direction.lengthSq() < 1e-6) direction.set(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), currentSeat.yaw);
    direction.normalize();
  }
  // Centre the taller world-selection menu in the seated field of view.
  xrPanel.position.copy(eye).addScaledVector(direction, 1.9); xrPanel.position.y += .12;
  xrPanel.rotation.set(0, Math.atan2(-direction.x, -direction.z), 0);
}

function controllerRay(controller) {
  const rotation = new THREE.Matrix4().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation);
}

function setupXr() {
  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i); rig.add(controller);
    const { group, ray, dot } = createAimPointer(); controller.add(group);
    const state = { controller, ray, dot, gamepad: null, target: null, menuWasPressed: false };
    controllers.push(state);
    controller.addEventListener('connected', e => {
      state.gamepad = e.data.gamepad;
      state.menuWasPressed = isMenuButtonPressed(state.gamepad);
    });
    controller.addEventListener('disconnected', () => { state.gamepad = null; state.menuWasPressed = false; clearAimPreview(); });
    controller.addEventListener('selectstart', () => {
      updateAimTarget(state);
      if (state.target?.type === 'button') state.target.object.userData.action();
      else if (state.target?.seat) setSeat(state.target.seat);
    });
    const grip = renderer.xr.getControllerGrip(i);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(.018, .024, .12, 8), new THREE.MeshStandardMaterial({ color: '#c3d5d1', roughness: .6 }));
    handle.rotation.x = Math.PI / 4; grip.add(handle); rig.add(grip);
  }
  createXrPanel();
  renderer.xr.addEventListener('sessionstart', () => {
    clearAimPreview();
    for (const state of controllers) state.menuWasPressed = isMenuButtonPressed(state.gamepad);
    orbit.enabled = false; camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0);
    model.setOverview(false, labelsVisible); pendingVrAlign = true; xrPanel.visible = true;
    document.body.classList.add('in-vr');
  });
  renderer.xr.addEventListener('sessionend', () => {
    clearAimPreview();
    for (const state of controllers) state.menuWasPressed = false;
    framePose = null; pendingVrAlign = false; xrPanel.visible = false; document.body.classList.remove('in-vr'); setView('seat');
  });
  if (navigator.xr && isSecureContext) navigator.xr.isSessionSupported('immersive-vr').then(supported => {
    vrSupported = supported; $('vr').classList.toggle('ready', supported);
    $('vr').title = supported ? 'Meta Quest에서 몰입형 VR 시작' : 'Meta Quest 브라우저에서 이 주소를 열어주세요';
  }).catch(() => {});
}

async function startVr() {
  if (!vrSupported) { toast('Meta Quest 3의 브라우저에서 이 사이트를 열면 VR로 입장할 수 있습니다.'); return; }
  try {
    // Reuse this user gesture if muted autoplay was blocked by the browser.
    if (contentMode === 'video' && model.getVideoState().requested) void model.setVideoPlaying(true);
    const session = await navigator.xr.requestSession('immersive-vr', { requiredFeatures: ['local-floor'], optionalFeatures: ['bounded-floor', 'hand-tracking'] });
    await renderer.xr.setSession(session);
  } catch (e) { toast(`VR을 시작하지 못했습니다. ${e.name === 'NotAllowedError' ? '브라우저 권한을 확인해 주세요.' : '다시 VR 시작을 눌러 주세요.'}`); }
}

function initRenderer() {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (error) {
    $('viewport').innerHTML = '<div class="render-error"><h2>3D 화면을 열 수 없습니다</h2><p>WebGL 2를 지원하는 브라우저에서 하드웨어 가속을 켜고 다시 접속해 주세요.</p></div>';
    updateInfo(); return;
  }
  renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local-floor'); renderer.xr.setFramebufferScaleFactor(.9);
  $('viewport').append(renderer.domElement);
  orbit = new OrbitControls(camera, renderer.domElement); orbit.enableDamping = true; orbit.minDistance = 12; orbit.maxDistance = 290; orbit.maxPolarAngle = Math.PI * .85; orbit.enabled = false;
  model = new Auditorium(scene, layout, { screenMode: contentMode, videoId: selectedVideoId });
  model.onPlaybackChange = updatePlaybackUI;
  model.select(currentSeat); setupXr(); setView('seat'); updateInfo(); updatePlaybackUI();
  renderer.domElement.addEventListener('pointerdown', e => { if (e.button !== 0) return; drag = { x: e.clientX, y: e.clientY, moved: false }; renderer.domElement.setPointerCapture(e.pointerId); });
  renderer.domElement.addEventListener('pointermove', e => {
    if (renderer.xr.isPresenting) return;
    if (!drag) {
      if (view === 'overview') {
        raycaster.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
        const target = pickTarget(raycaster, [], model.pickables, layout.seats, model.fans?.membranes.map(p => p.mesh) ?? []);
        model.setHoverSeats(target ? [target.seat] : []);
        renderer.domElement.style.cursor = target ? 'pointer' : '';
      }
      return;
    }
    model.setHoverSeats([]);
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    if (view === 'seat') { yaw -= dx * .003; pitch = THREE.MathUtils.clamp(pitch - dy * .003, -1.48, 1.48); camera.rotation.set(pitch, yaw, 0, 'YXZ'); }
    drag.x = e.clientX; drag.y = e.clientY;
  });
  renderer.domElement.addEventListener('pointerup', e => {
    if (drag && !drag.moved && view === 'overview') {
      raycaster.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
      const hit = pickTarget(raycaster, [], model.pickables, layout.seats, model.fans?.membranes.map(p => p.mesh) ?? []); if (hit?.seat) setSeat(hit.seat);
    }
    drag = null;
  });
  renderer.domElement.addEventListener('pointercancel', () => { drag = null; });
  renderer.domElement.addEventListener('pointerleave', () => { if (!renderer.xr.isPresenting) model.setHoverSeats([]); });
  renderer.domElement.addEventListener('wheel', e => { if (view !== 'seat') return; e.preventDefault(); camera.fov = THREE.MathUtils.clamp(camera.fov + e.deltaY * .025, 35, 100); camera.updateProjectionMatrix(); }, { passive: false });
  let previousFrame = 0, lastPartitionUI = 0;
  renderer.setAnimationLoop((time, xrFrame) => {
    const wasMoving = model.getPartitionState()?.moving;
    const changed = model.update(previousFrame ? (time - previousFrame) / 1000 : 0); previousFrame = time;
    if (changed && time - lastPartitionUI > 100) { updatePartitionUI(); updateXrSummary(); lastPartitionUI = time; }
    if (wasMoving && !model.getPartitionState()?.moving) { updatePartitionUI(); requestComparison(); }
    if (renderer.xr.isPresenting && xrFrame) {
      framePose = xrFrame.getViewerPose(renderer.xr.getReferenceSpace()); if (pendingVrAlign && framePose) alignVr();
      if (pollMenuToggle(controllers)) setXrMenuVisible(!xrPanel.visible);
      if (time - lastAimUpdate >= 50) {
        for (const state of controllers) {
          if (state.controller.visible) updateAimTarget(state);
          else { state.target = null; state.dot.visible = false; }
        }
        showAimPreview(); lastAimUpdate = time;
      }
      for (const { gamepad } of controllers) {
        if (gamepad && time - lastStick > 450) {
          const axes = gamepad.axes, x = axes[axes.length - 2] || 0, y = axes[axes.length - 1] || 0;
          if (Math.abs(x) > .75) { moveRelative({ number: x > 0 ? 1 : -1 }); lastStick = time; }
          else if (Math.abs(y) > .75) { moveRelative({ row: y > 0 ? 1 : -1 }); lastStick = time; }
        }
      }
    } else if (orbit.enabled) orbit.update();
    renderer.render(scene, camera);
  });
  // Small, read-only diagnostic surface for manual browser/Quest validation.
  window.sphereLab = { getState: () => ({ seat: currentSeat, view, seats: layout.seats.length, sections: layout.sections.length, hoveredSeats: model.hovered.map(s => s.id), contentMode, video: model.getVideoState(), partitions: model.getPartitionState(), audienceEnabled, world: currentWorld.id, comparisonWorld: comparisonWorld.id, comparison: comparisonResult, modelRevision: 'research-15', menuVisible: Boolean(xrPanel?.visible), stageVisible: model.stageGroup.visible, accessibleInventory: 178, audienceCount: audienceEnabled ? layout.seats.length - 1 : 0, vrSupported, renderer: renderer.info, meters: true }), selectSeat: options => setSeat(resolveSeat(layout, options)), setWorld, setPartitions: deployed => { model.setPartitions(deployed, true); updatePartitionUI(); requestComparison(); }, setAudience: setAudienceEnabled, setView };
}

function visitBand(index) {
  const views = [{ section: 206, row: 10 }, { section: 306, row: 10 }];
  setSeat(resolveSeat(layout, views[index]));
}

function updatePartitionUI() {
  const active = Boolean(currentWorld.partitions), state = model?.getPartitionState();
  for (const button of xrPartitionStepButtons) button.visible = active;
  if (xrPartitionButton) {
    xrPartitionButton.visible = active;
    const text = state?.deployed ? '차양 접기' : '차양 수동 전개';
    if (active && xrPartitionButton.userData.caption !== text) {
      const ctx = xrPartitionButton.userData.canvas.getContext('2d');
      ctx.fillStyle = '#3f3451'; ctx.fillRect(0,0,384,144); ctx.strokeStyle = '#a493b9'; ctx.lineWidth = 3; ctx.strokeRect(3,3,378,138);
      ctx.fillStyle = '#f1e7ff'; ctx.font = '500 43px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text,192,72,360);
      xrPartitionButton.material.map.needsUpdate = true; xrPartitionButton.userData.caption = text;
    }
  }
  $('partition-controls').hidden = !active; $('content').disabled = active;
  document.querySelector('.comparison-panel h3').textContent = active ? '착석 시야와 차양 가림' : '같은 구역에서 전후 비교';
  updateVideoUI();
  document.querySelector('.compare-seats').hidden = active;
  document.querySelector('.comparison-note').hidden = active;
  if (!active) return;
  const band = bandForTier(currentSeat.tier), projection = state?.projectionMetres ?? 0;
  $('partition-toggle').textContent = state?.deployed ? '차양 접기' : '차양 수동 전개';
  $('partition-amount').value = Math.round(projection * 100); $('partition-value').value = `${projection.toFixed(2)}m`;
  $('partition-length').value = projection.toFixed(2);
  $('partition-shorter').disabled = projection <= 0;
  $('partition-longer').disabled = projection >= partitionFootprint.maximumProjectionMetres;
  $('partition-status').textContent = `${band.label} · 현재 ${projection.toFixed(2)}m · 상향 ${state?.slopeDegrees ?? 15}°${state?.moving ? ' · 움직이는 중' : ''}`;
}

function togglePartitions() {
  if (!currentWorld.partitions) { toast('V2 객석 차양 월드에서 사용할 수 있습니다.'); return; }
  model.setPartitions(!model.getPartitionState().deployed);
  updatePartitionUI(); requestComparison();
}

function setManualProjection(metres) {
  if (!currentWorld.partitions) return;
  const amount = partitionAmountForLength(metres);
  if (amount !== null) model.setPartitionAmount(amount);
  updatePartitionUI(); requestComparison(); updateXrSummary();
}

function changePartitionProjection(delta) {
  const length = model?.getPartitionState()?.projectionMetres;
  if (length != null) setManualProjection(Math.round((length + delta) * 100) / 100);
}

function shortenPartition() { changePartitionProjection(-.25); }
function lengthenPartition() { changePartitionProjection(.25); }

$('partition-toggle').addEventListener('click', togglePartitions);
$('partition-fit').addEventListener('click', () => setManualProjection(0));
$('partition-amount').addEventListener('input', () => { model?.setPartitionAmount(Number($('partition-amount').value) / (partitionFootprint.maximumProjectionMetres * 100)); comparisonRequest++; comparisonResult = null; updatePartitionUI(); renderComparison(); updateXrSummary(); });
$('partition-amount').addEventListener('change', requestComparison);
$('partition-length').addEventListener('change', () => setManualProjection($('partition-length').valueAsNumber));
$('partition-length').addEventListener('keydown', event => { if (event.key === 'Enter') setManualProjection($('partition-length').valueAsNumber); });
$('partition-apply').addEventListener('click', () => setManualProjection($('partition-length').valueAsNumber));
$('partition-shorter').addEventListener('click', () => changePartitionProjection(-.1));
$('partition-longer').addEventListener('click', () => changePartitionProjection(.1));
document.querySelectorAll('[data-band-view]').forEach(button => button.addEventListener('click', () => visitBand(Number(button.dataset.bandView))));

$('world').addEventListener('change', () => setWorld($('world').value));
$('movie').addEventListener('change', () => setVideoPreset($('movie').value));
for (const section of [209, 210]) $(`compare-${section}`).addEventListener('click', () => { setAudienceEnabled(true); setSeat(resolveSeat(layout, { section, row: currentSeat.row })); });
$('section').addEventListener('change', () => setSeat(resolveSeat(layout, { section: $('section').value, row: currentSeat.row })));
$('row').addEventListener('change', () => setSeat(resolveSeat(layout, { section: currentSeat.section, row: $('row').value, number: currentSeat.number })));
$('number').addEventListener('change', () => setSeat(resolveSeat(layout, { section: currentSeat.section, row: currentSeat.row, number: $('number').value })));
document.querySelectorAll('[data-tier]').forEach(b => b.addEventListener('click', () => { const t = TIERS.find(t => t.id === Number(b.dataset.tier)); setSeat(resolveSeat(layout, { section: Math.floor((t.first + t.last) / 2), row: currentSeat.row })); }));
document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => setSeat(resolveSeat(layout, PRESETS[Number(b.dataset.preset)]))));
$('go-seat').addEventListener('click', () => { setView('seat'); document.body.classList.remove('panel-open'); });
$('seat-view').addEventListener('click', () => setView('seat')); $('overview').addEventListener('click', () => setView('overview')); $('reset').addEventListener('click', resetView);
$('content').addEventListener('change', () => setContentMode($('content').value));
$('video-playback').addEventListener('click', toggleVideoPlayback);
$('audience').addEventListener('change', () => setAudienceEnabled($('audience').checked));
$('labels').addEventListener('change', () => { labelsVisible = $('labels').checked; model?.setOverview(view === 'overview', labelsVisible); });
$('event-stage').addEventListener('change', () => model?.setStage($('event-stage').checked));
$('vr').addEventListener('click', startVr);
const openInfo = () => $('info-dialog').showModal(); $('research').addEventListener('click', openInfo); $('model-info').addEventListener('click', openInfo);
document.querySelector('.dialog-close').addEventListener('click', () => $('info-dialog').close());
$('info-dialog').addEventListener('click', e => { if (e.target === $('info-dialog')) { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close(); } });
$('mobile-panel').addEventListener('click', () => document.body.classList.toggle('panel-open'));
$('share').addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); toast('현재 좌석 링크를 복사했습니다.'); } catch { toast(`현재 좌석: ${currentSeat.section}구역 ${currentSeat.row}행 ${currentSeat.number}번. 주소창의 링크를 복사하세요.`); } });
$('screenshot').addEventListener('click', () => {
  if (!renderer || renderer.xr.isPresenting) return;
  renderer.render(scene, camera); renderer.domElement.toBlob(blob => { if (!blob) return; const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `sphere-${currentWorld.id}-${currentSeat.id}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
});
addEventListener('keydown', e => { if (/input|select|textarea/i.test(document.activeElement.tagName) || $('info-dialog').open) return; if (e.key.toLowerCase() === 'r') resetView(); if (e.key === 'Escape') document.body.classList.remove('panel-open'); });
addEventListener('resize', () => { if (!renderer) return; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
initRenderer();
