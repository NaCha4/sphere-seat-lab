import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Auditorium } from './auditorium.js';
import { BUILDING, TIERS, PRESETS, rowGeometry, makeLayout, resolveSeat, seatMetrics } from './layout.js';
import { SOURCES, CONFIDENCE } from './evidence.js';
import { XR_OVERLAY_ORDER, overlayMaterial, pickTarget, createAimPointer } from './interaction.js';

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
    <div class="project-heading"><span class="eyebrow">LAS VEGAS / RESEARCH MODEL 02</span><h1>좌석에서 만나는 스피어</h1></div>
    <div class="header-actions"><button class="icon-button" id="research" aria-label="모델 근거와 출처">${icon('info')}</button><button class="vr-button" id="vr">${icon('vr', 20)}<span>VR 시작</span></button></div>
  </header>
  <aside class="sidebar" aria-label="좌석과 보기 설정">
    <div class="panel-title"><div><span class="eyebrow">FIXED BOWL / RECONSTRUCTION</span><h2>나의 관람 위치</h2></div><span class="live-dot" title="원본 모델"></span></div>
    <div class="view-tabs" role="group" aria-label="보기 방식"><button id="seat-view" class="active">${icon('eye', 16)}좌석 시점</button><button id="overview">${icon('cube', 16)}전체 구조</button></div>
    <div class="map-wrap"><svg id="seat-map" viewBox="0 0 300 218" role="img" aria-label="좌석 구역 지도"></svg><span class="map-caption">구역을 눌러 이동하세요</span></div>
    <div class="tier-tabs" role="group" aria-label="객석 층">${TIERS.map(t => `<button data-tier="${t.id}" style="--tier-color:${t.color}">${t.id}</button>`).join('')}</div>
    <div class="location-form">
      <label class="field">구역<select id="section" aria-label="구역"></select></label>
      <div class="row-controls"><label class="field">행<select id="row" aria-label="행"></select></label><label class="field">행 내 위치<select id="number" aria-label="행 내 가상 위치"></select></label></div>
    </div>
    <button class="primary-button" id="go-seat">이 좌석에서 보기 ${icon('arrow')}</button>
    <div class="section-divider"></div>
    <div class="preset-heading"><h3>다른 시야 살펴보기</h3><span>QUICK VIEWS</span></div>
    <div class="presets">${PRESETS.map((p, i) => `<button data-preset="${i}"><span>${p.label}</span><small>${p.section} · ${p.row}행</small></button>`).join('')}</div>
    <div class="section-divider"></div>
    <label class="field">스크린 콘텐츠<select id="content"><option value="aurora">오로라 · 구면 전용 화면</option><option value="earth">지구 · 공간감 보기</option><option value="grid">격자 · 화면 범위 보기</option><option value="stars">별빛 · 스크린 콘텐츠</option></select></label>
    <div class="display-options"><label><input type="checkbox" id="audience">관객 채우기 · 내 자리 제외</label><label><input type="checkbox" id="labels">구역 번호 표시</label><label><input type="checkbox" id="event-stage">예시 공연 무대 표시</label></div>
    <p class="sidebar-note">오로라는 구면 좌표에 맞춰 생성한 화면입니다.<br>구조 구분: 회색 천장 · 회갈색 객석 하부<br>숫자는 행 안의 가상 위치입니다.<br>실제 티켓 번호·준공 좌표는 미확보입니다.</p>
  </aside>
  <main class="scene-ui">
    <div class="scene-caption"><span class="tag">RESEARCH 02</span><span id="view-description">1인칭 · 드래그해서 둘러보기</span></div>
    <div class="scene-tools"><button id="reset" class="tool-button" title="시선 초기화">${icon('reset')}<span>시선 초기화</span></button><button id="screenshot" class="icon-button" title="현재 화면 이미지 저장" aria-label="현재 화면 이미지 저장">${icon('camera')}</button><button id="share" class="icon-button" title="현재 좌석 링크 복사" aria-label="현재 좌석 링크 복사">${icon('link')}</button></div>
    <div class="seat-card"><div class="seat-card-main"><span class="eyebrow" id="tier-name">TERRACE / 200 LEVEL</span><div><strong id="selected-section">206</strong><span id="selected-position">10행 · 13번</span></div><span class="seat-description" id="seat-description">중앙에서 무대와 화면을 함께 확인하세요.</span></div><div class="seat-stats"><div><span>전방 기준점까지</span><strong id="distance">—</strong></div><div><span>모델상 눈높이</span><strong id="height">—</strong></div><div><span>기준점 방향 차이</span><strong id="yaw">—</strong></div></div><div class="metrics-note">거리·각도는 추정 좌표의 계산값이며 실측값이 아닙니다.</div></div>
    <div class="bottom-line"><span class="interaction-hint" id="hint">마우스 드래그: 시선 이동 <span>·</span> 휠: 확대 <span>·</span> R: 초기화</span><button id="model-info">공개 자료 기반 재구성 ${icon('info', 13)}</button></div>
  </main>
  <button class="mobile-panel-button" id="mobile-panel">${icon('eye', 16)}좌석 선택</button>
  <div id="toast" role="status" aria-live="polite"></div>
  <dialog id="info-dialog"><button class="dialog-close icon-button" aria-label="닫기">${icon('close')}</button><div class="dialog-kicker">ABOUT THIS RECONSTRUCTION</div><h2>공식 데이터와 추정 구조</h2><p class="dialog-intro">공식 예매 데이터의 39개 구역·숫자 행·행별 좌석 수를 적용했습니다. 13,830개 일반 좌석 위치를 표시하며, 별도 WC 178개 위치와 가변 앞좌석은 좌표 미확보로 생성하지 않습니다. 전체 공식 수용 인원과는 집계 범위가 다릅니다.</p><div class="evidence-levels">${CONFIDENCE.map(([title, body], i) => `<div><span class="level-number">0${i + 1}</span><section><h3>${title}</h3><p>${body}</p></section></div>`).join('')}</div><div class="important-note">준공 CAD/BIM은 확보하지 못했습니다. 스크린·객석 단면은 2019 설계 그림을 이후 공개 수치로 환산한 추정이며 현재 준공 구조와 일치하는지는 미검증입니다. 행 내 번호는 실제 티켓 번호가 아닙니다. 이 모델만으로 실제 시야·가림의 정도를 입증할 수 없습니다. 예시 무대는 기본적으로 꺼져 있습니다.</div><h3 class="source-heading">조사 출처 <span>2026.10.20 확인</span></h3><div class="sources">${SOURCES.map((s, i) => `<a href="${s.url}" target="_blank" rel="noopener noreferrer"><span class="source-number">${String(i + 1).padStart(2, '0')}</span><div><small>${s.type}</small><strong>${s.name} ↗</strong><p>${s.note}</p></div></a>`).join('')}</div><p class="educational-note">Independent educational reconstruction. Not affiliated with or endorsed by Sphere Entertainment. 실제 공연 영상과 원본 도면 이미지는 이 사이트에 재배포하지 않습니다.</p></dialog>
`;

const $ = id => document.getElementById(id);
let layout = makeLayout();
const query = new URLSearchParams(location.search);
let currentSeat = resolveSeat(layout, { section: query.get('section') || 206, row: query.get('row') || 10, number: query.get('seat') });
let view = 'seat', contentMode = 'aurora', labelsVisible = false, audienceEnabled = false;
let renderer, model, orbit;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#030405');
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .05, 550);
const rig = new THREE.Group(); rig.add(camera); scene.add(rig);
const hemisphere = new THREE.HemisphereLight('#afc6ed', '#101d27', 2.2); scene.add(hemisphere);
const keyLight = new THREE.DirectionalLight('#afcde3', 1.25); keyLight.position.set(10, 55, -45); scene.add(keyLight);
const fillLight = new THREE.DirectionalLight('#798aa5', .55); fillLight.position.set(-30, 25, 30); scene.add(fillLight);
const raycaster = new THREE.Raycaster();
let drag = null, yaw = currentSeat.yaw, pitch = .06, framePose = null, pendingVrAlign = false, vrSupported = false;
const controllers = [], xrButtons = []; let xrPanel = null, lastStick = 0, lastAimUpdate = -Infinity, hoverCaption = null;

function toast(message) {
  $('toast').textContent = message; $('toast').classList.add('visible');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => $('toast').classList.remove('visible'), 3300);
}

function drawMap() {
  const pos = (x, z) => [150 + x * 1.78, 123 + z * 1.5];
  const arcPath = (s, r0, r1) => {
    const points = [];
    for (let i = 0; i <= 16; i++) { const a = s.start + (s.end - s.start) * i / 16; points.push(pos(Math.sin(a) * r0, s.tier.centerZ + Math.cos(a) * r0)); }
    for (let i = 16; i >= 0; i--) { const a = s.start + (s.end - s.start) * i / 16; points.push(pos(Math.sin(a) * r1, s.tier.centerZ + Math.cos(a) * r1)); }
    return 'M' + points.map(p => p.join(',')).join('L') + 'Z';
  };
  let svg = '<text x="150" y="25" text-anchor="middle" fill="#70848d" font-size="8" letter-spacing="2">SCREEN / FRONT</text>';
  for (const s of [...layout.sections].reverse()) {
    const r0 = rowGeometry(s.tier, s.range.first).radius - .35;
    const r1 = rowGeometry(s.tier, s.range.last).radius + .35;
    const selected = currentSeat.section === s.id;
    svg += `<path d="${arcPath(s, r0, r1)}" fill="${selected ? '#b4ddcd' : s.tier.color}" fill-opacity="${selected ? 1 : .22}" stroke="${selected ? '#d8eee4' : '#68808a'}" stroke-width="${selected ? 1 : .3}" data-map-section="${s.id}" tabindex="0" role="button" aria-label="${s.id} 구역"/>`;
    if (selected) { const r = (r0 + r1) / 2, p = pos(Math.sin(s.center) * r, s.tier.centerZ + Math.cos(s.center) * r); svg += `<text x="${p[0]}" y="${p[1] + 3}" text-anchor="middle" font-size="8" font-weight="700" fill="#071512" pointer-events="none">${s.id}</text>`; }
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
  $('seat-description').textContent = isRear ? '하부 후방에서 상부 구조의 가림을 살펴보세요.' : currentSeat.tier === 400 ? '상부에서 화면과 객석의 관계를 확인하세요.' : Math.abs(currentSeat.theta) > .42 ? '측면에서 화면과 좌석 방향의 관계를 비교하세요.' : '중앙에서 화면과 객석의 관계를 확인하세요.';
  const params = new URLSearchParams({ section: currentSeat.section, row: currentSeat.row, seat: currentSeat.number });
  history.replaceState(null, '', `${location.pathname}?${params}`);
  populateInputs(); drawMap();
}

function alignVr() {
  if (!framePose) { pendingVrAlign = true; return; }
  const p = framePose.transform.position, q = framePose.transform.orientation;
  const headEuler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w), 'YXZ');
  rig.rotation.set(0, currentSeat.yaw - headEuler.y, 0);
  const offset = new THREE.Vector3(p.x, p.y, p.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), rig.rotation.y);
  rig.position.set(currentSeat.x, currentSeat.y + BUILDING.eyeHeight, currentSeat.z).sub(offset);
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
    camera.position.set(currentSeat.x, currentSeat.y + BUILDING.eyeHeight, currentSeat.z);
    yaw = currentSeat.yaw; pitch = .06; camera.rotation.set(pitch, yaw, 0, 'YXZ'); camera.fov = 72;
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
  setSeat(resolveSeat(layout, { section: nextSection, row: currentSeat.row + row, number: section ? null : currentSeat.number + number }));
}

function setAudienceEnabled(enabled) {
  audienceEnabled = enabled; $('audience').checked = enabled;
  model?.setAudience(enabled, currentSeat);
}

function createXrPanel() {
  xrPanel = new THREE.Group(); xrPanel.visible = false; scene.add(xrPanel);
  xrPanel.renderOrder = XR_OVERLAY_ORDER;
  const actions = [
    ['이전 구역', () => moveRelative({ section: -1 })], ['다음 구역', () => moveRelative({ section: 1 })],
    ['앞 행', () => moveRelative({ row: -1 })], ['뒤 행', () => moveRelative({ row: 1 })],
    ['다른 층', () => { const i = TIERS.findIndex(t => t.id === currentSeat.tier); const t = TIERS[(i + 1) % TIERS.length]; setSeat(resolveSeat(layout, { section: Math.floor((t.first + t.last) / 2), row: 10 })); }],
    ['VR 종료', () => renderer.xr.getSession()?.end()],
    ['관객 켜기/끄기', () => setAudienceEnabled(!audienceEnabled)],
  ];
  actions.forEach(([text, action], i) => {
    const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 144;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#15292f'; ctx.fillRect(0, 0, 384, 144); ctx.strokeStyle = '#698d86'; ctx.lineWidth = 3; ctx.strokeRect(3, 3, 378, 138);
    ctx.fillStyle = '#e3f0e9'; ctx.font = '500 47px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 192, 72);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.43, .16), overlayMaterial({ map }));
    const column = i === actions.length - 1 && actions.length % 3 === 1 ? 1 : i % 3;
    mesh.position.set((column - 1) * .46, Math.floor(i / 3) * -.19, 0); mesh.userData.action = action; mesh.renderOrder = XR_OVERLAY_ORDER;
    xrPanel.add(mesh); xrButtons.push(mesh);
  });
  const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 100;
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  const caption = new THREE.Mesh(new THREE.PlaneGeometry(1.36, .136), overlayMaterial({ map }));
  caption.position.set(0, .17, 0); caption.renderOrder = XR_OVERLAY_ORDER;
  xrPanel.add(caption);
  hoverCaption = { canvas, map, text: null };
  updateHoverCaption(null);
}

function updateHoverCaption(seat) {
  if (!hoverCaption) return;
  const text = seat ? `${seat.section} 구역 · ${seat.row}행 · ${seat.number}번째  /  핀치·트리거로 이동` : '좌석을 가리키면 민트색으로 빛납니다 · 핀치·트리거로 이동';
  if (hoverCaption.text === text) return;
  hoverCaption.text = text;
  const ctx = hoverCaption.canvas.getContext('2d');
  ctx.fillStyle = '#122b2d'; ctx.fillRect(0, 0, 1000, 100);
  ctx.font = '500 33px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#baffdf';
  ctx.fillText(text, 500, 50); hoverCaption.map.needsUpdate = true;
}

function clearAimPreview() {
  for (const state of controllers) { state.target = null; state.dot.visible = false; state.ray.scale.z = 6; }
  for (const button of xrButtons) button.material.color.set('#ffffff');
  model?.setHoverSeats([]); updateHoverCaption(null); lastAimUpdate = -Infinity;
}

function updateAimTarget(state) {
  state.controller.updateWorldMatrix(true, false);
  controllerRay(state.controller);
  state.target = pickTarget(raycaster, xrButtons, model.pickables, layout.seats);
  const distance = state.target?.distance ?? 6;
  state.ray.scale.z = distance;
  state.dot.visible = Boolean(state.target);
  state.dot.position.z = -distance;
  state.dot.scale.setScalar(Math.max(1, distance * .1));
  state.ray.material.color.set(state.target ? '#77ffe0' : '#badfcf');
}

function showAimPreview() {
  model.setHoverSeats(controllers.map(s => s.target?.seat).filter(Boolean));
  updateHoverCaption(controllers.find(s => s.target?.seat)?.target.seat);
  for (const button of xrButtons) button.material.color.set(controllers.some(s => s.target?.object === button) ? '#baffdf' : '#ffffff');
}

function placeXrPanel() {
  if (!xrPanel) return;
  const direction = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), currentSeat.yaw);
  xrPanel.position.set(currentSeat.x, currentSeat.y + BUILDING.eyeHeight - .38, currentSeat.z).addScaledVector(direction, 1.9);
  xrPanel.rotation.set(0, currentSeat.yaw, 0);
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
    const state = { controller, ray, dot, gamepad: null, target: null };
    controllers.push(state);
    controller.addEventListener('connected', e => { controllers[i].gamepad = e.data.gamepad; });
    controller.addEventListener('disconnected', () => { state.gamepad = null; clearAimPreview(); });
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
    orbit.enabled = false; camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0);
    model.setOverview(false, labelsVisible); pendingVrAlign = true; xrPanel.visible = true;
    document.body.classList.add('in-vr');
  });
  renderer.xr.addEventListener('sessionend', () => {
    clearAimPreview();
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
  model = new Auditorium(scene, layout, { screenMode: contentMode }); model.select(currentSeat); setupXr(); setView('seat'); updateInfo();
  renderer.domElement.addEventListener('pointerdown', e => { if (e.button !== 0) return; drag = { x: e.clientX, y: e.clientY, moved: false }; renderer.domElement.setPointerCapture(e.pointerId); });
  renderer.domElement.addEventListener('pointermove', e => {
    if (renderer.xr.isPresenting) return;
    if (!drag) {
      if (view === 'overview') {
        raycaster.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
        const target = pickTarget(raycaster, [], model.pickables, layout.seats);
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
      const hit = raycaster.intersectObjects(model.pickables, false)[0]; if (hit?.instanceId != null) setSeat(layout.seats[hit.instanceId]);
    }
    drag = null;
  });
  renderer.domElement.addEventListener('pointercancel', () => { drag = null; });
  renderer.domElement.addEventListener('pointerleave', () => { if (!renderer.xr.isPresenting) model.setHoverSeats([]); });
  renderer.domElement.addEventListener('wheel', e => { if (view !== 'seat') return; e.preventDefault(); camera.fov = THREE.MathUtils.clamp(camera.fov + e.deltaY * .025, 35, 100); camera.updateProjectionMatrix(); }, { passive: false });
  renderer.setAnimationLoop((time, xrFrame) => {
    if (renderer.xr.isPresenting && xrFrame) {
      framePose = xrFrame.getViewerPose(renderer.xr.getReferenceSpace()); if (pendingVrAlign && framePose) alignVr();
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
  window.sphereLab = { getState: () => ({ seat: currentSeat, view, seats: layout.seats.length, sections: layout.sections.length, hoveredSeats: model.hovered.map(s => s.id), contentMode, audienceEnabled, modelRevision: 'research-02', stageVisible: model.stageGroup.visible, accessibleInventory: 178, audienceCount: audienceEnabled ? layout.seats.length - 1 : 0, vrSupported, renderer: renderer.info, meters: true }), selectSeat: options => setSeat(resolveSeat(layout, options)), setView };
}

$('section').addEventListener('change', () => setSeat(resolveSeat(layout, { section: $('section').value, row: currentSeat.row })));
$('row').addEventListener('change', () => setSeat(resolveSeat(layout, { section: currentSeat.section, row: $('row').value, number: currentSeat.number })));
$('number').addEventListener('change', () => setSeat(resolveSeat(layout, { section: currentSeat.section, row: currentSeat.row, number: $('number').value })));
document.querySelectorAll('[data-tier]').forEach(b => b.addEventListener('click', () => { const t = TIERS.find(t => t.id === Number(b.dataset.tier)); setSeat(resolveSeat(layout, { section: Math.floor((t.first + t.last) / 2), row: currentSeat.row })); }));
document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => setSeat(resolveSeat(layout, PRESETS[Number(b.dataset.preset)]))));
$('go-seat').addEventListener('click', () => { setView('seat'); document.body.classList.remove('panel-open'); });
$('seat-view').addEventListener('click', () => setView('seat')); $('overview').addEventListener('click', () => setView('overview')); $('reset').addEventListener('click', resetView);
$('content').addEventListener('change', () => { contentMode = $('content').value; model?.setScreen(contentMode); });
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
  renderer.render(scene, camera); renderer.domElement.toBlob(blob => { if (!blob) return; const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `sphere-${currentSeat.id}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
});
addEventListener('keydown', e => { if (/input|select|textarea/i.test(document.activeElement.tagName) || $('info-dialog').open) return; if (e.key.toLowerCase() === 'r') resetView(); if (e.key === 'Escape') document.body.classList.remove('panel-open'); });
addEventListener('resize', () => { if (!renderer) return; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
initRenderer();
