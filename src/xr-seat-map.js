import * as THREE from 'three';
import { XR_OVERLAY_ORDER, overlayMaterial } from './interaction.js';

const WIDTH = 1536, HEIGHT = 1200;
export const MAP_ROWS = 6, MAP_COLUMNS = 24;
const rect = (x, y, width, height) => ({ x, y, width, height });
const contains = (r, x, y) => x >= r.x && x <= r.x+r.width && y >= r.y && y <= r.y+r.height;

function inPolygon(points, x, y) {
  let inside = false;
  for (let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i],b=points[j];
    if ((a.y>y)!==(b.y>y) && x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x) inside=!inside;
  }
  return inside;
}

// Hit regions and pagination use actual selectable rows/seats. Only the
// overview's separated tier arcs are schematic, so stacked floors stay usable.
export class SeatMapNavigator {
  constructor(layout, seat) { this.mode='overview'; this.update(layout,seat); }
  update(layout, seat) {
    const changed=this.layout!==layout;
    this.layout=layout; this.currentSeat=seat;
    if (changed || !layout.bySection.has(this.sectionId)) this.sectionId=seat.section;
    if (changed) { this.mode='overview'; this.rowPage=0; this.seatPage=0; }
  }
  openSection(id, focusCurrent = true) {
    const section=this.layout.bySection.get(id);
    if (!section) return;
    this.sectionId=id; this.mode='seats'; this.rowPage=0; this.seatPage=0;
    if (focusCurrent && id===this.currentSeat.section) {
      this.rowPage=Math.floor([...section.rows.keys()].indexOf(this.currentSeat.row)/MAP_ROWS);
      this.seatPage=Math.floor((this.currentSeat.number-1)/MAP_COLUMNS);
    }
  }
  get pages() {
    const section=this.layout.bySection.get(this.sectionId);
    return { rows:Math.ceil(section.rows.size/MAP_ROWS), seats:Math.ceil(Math.max(...[...section.rows.values()].map(r=>r.length))/MAP_COLUMNS) };
  }
  get columns() {
    const section=this.layout.bySection.get(this.sectionId);
    return Math.min(MAP_COLUMNS,Math.max(...[...section.rows.values()].map(r=>r.length))-this.seatPage*MAP_COLUMNS);
  }
  regions() {
    const regions=[];
    const button=(id,label,bounds,action,enabled=true)=>regions.push({id,label,bounds,action,enabled,kind:'control'});
    button('current','내 좌석',rect(1100,25,190,72),{kind:'current'});
    button('close','메뉴',rect(1310,25,190,72),{kind:'close'});
    if (this.mode==='overview') {
      const tiers=[...new Set(this.layout.sections.map(s=>s.tier.id))];
      tiers.forEach((tier,tierIndex)=>{
        const sections=this.layout.sections.filter(s=>s.tier.id===tier), inner=220+tierIndex*125, outer=inner+110;
        sections.forEach((section,i)=>{
          const start=(-60+i*120/sections.length+.6)*Math.PI/180;
          const end=(-60+(i+1)*120/sections.length-.6)*Math.PI/180;
          const point=(r,a)=>({x:WIDTH/2+r*Math.sin(a),y:195+r*Math.cos(a)});
          const points=[];
          for(let j=0;j<=8;j++)points.push(point(outer,start+(end-start)*j/8));
          for(let j=8;j>=0;j--)points.push(point(inner,start+(end-start)*j/8));
          const center=point((inner+outer)/2,(start+end)/2);
          const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
          regions.push({id:`section-${section.id}`,kind:'section',label:String(section.id),points,center,
            bounds:rect(Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)),
            color:section.tier.color,selected:section.id===this.currentSeat.section,enabled:true,action:{kind:'section',id:section.id}});
        });
      });
    } else {
      const section=this.layout.bySection.get(this.sectionId), rows=[...section.rows.entries()].slice(this.rowPage*MAP_ROWS,(this.rowPage+1)*MAP_ROWS);
      const pitch=Math.min(132,1296/this.columns),start=170+(1296-pitch*this.columns)/2;
      rows.forEach(([row,seats],rowIndex)=>{
        seats.slice(this.seatPage*MAP_COLUMNS,(this.seatPage+1)*MAP_COLUMNS).forEach((seat,i)=>{
          regions.push({id:`seat-${seat.id}`,kind:'seat',label:String(seat.number),row,
            bounds:rect(start+i*pitch,325+rowIndex*100,pitch-8,72),enabled:true,selected:seat.id===this.currentSeat.id,
            seat,action:{kind:'seat',seat}});
        });
      });
      const p=this.pages;
      button('rows-prev','앞 행',rect(50,1050,210,88),{kind:'rows',delta:-1},this.rowPage>0);
      button('rows-next','뒤 행',rect(280,1050,210,88),{kind:'rows',delta:1},this.rowPage<p.rows-1);
      button('seats-prev','← 좌석',rect(540,1050,230,88),{kind:'seats',delta:-1},this.seatPage>0);
      button('seats-next','좌석 →',rect(790,1050,230,88),{kind:'seats',delta:1},this.seatPage<p.seats-1);
      button('overview','전체 구역',rect(1090,1050,380,88),{kind:'overview'});
    }
    return regions;
  }
  hitUV(uv) {
    if (!uv || uv.x<0 || uv.x>1 || uv.y<0 || uv.y>1) return null;
    const x=uv.x*WIDTH,y=(1-uv.y)*HEIGHT;
    return this.regions().reverse().find(r=>r.enabled && contains(r.bounds,x,y) && (!r.points || inPolygon(r.points,x,y)))??null;
  }
  activate(region) {
    if (!region?.enabled) return null;
    const action=region.action;
    if (action.kind==='section') this.openSection(action.id);
    else if(action.kind==='current') this.openSection(this.currentSeat.section);
    else if(action.kind==='overview') this.mode='overview';
    else if(action.kind==='rows') this.rowPage=Math.max(0,Math.min(this.pages.rows-1,this.rowPage+action.delta));
    else if(action.kind==='seats') this.seatPage=Math.max(0,Math.min(this.pages.seats-1,this.seatPage+action.delta));
    return action;
  }
}

export class XrSeatMap extends THREE.Group {
  constructor({layout,seat,onSelectSeat,onClose,createCanvas=()=>document.createElement('canvas')}) {
    super(); this.name='vr-seat-map'; this.visible=false; this.renderOrder=XR_OVERLAY_ORDER;
    this.navigator=new SeatMapNavigator(layout,seat); this.onSelectSeat=onSelectSeat; this.onClose=onClose;
    const canvas=createCanvas(); canvas.width=WIDTH; canvas.height=HEIGHT; this.canvas=canvas;
    this.texture=new THREE.CanvasTexture(canvas); this.texture.colorSpace=THREE.SRGBColorSpace;
    this.texture.generateMipmaps=false; this.texture.minFilter=THREE.LinearFilter;
    this.surface=new THREE.Mesh(new THREE.PlaneGeometry(1.36,1.0625),overlayMaterial({map:this.texture}));
    this.surface.name='vr-seat-map-surface'; this.surface.renderOrder=XR_OVERLAY_ORDER;
    this.surface.position.y=-.42; this.add(this.surface); this.pickables=[this.surface];
    this.surface.userData.resolveHit=hit=>{
      const region=this.navigator.hitUV(hit.uv);
      if (!region) return {type:'panel'}; // Do not select physical chairs through blank map space.
      return {type:'map',map:this,region,seat:region.seat,action:()=>this.activate(region)};
    };
    const highlightGeometry=new THREE.BufferGeometry();
    highlightGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(12),3));
    this.highlight=new THREE.LineLoop(highlightGeometry,new THREE.LineBasicMaterial({color:'#ffe0a3',transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));
    this.highlight.renderOrder=XR_OVERLAY_ORDER+1; this.highlight.visible=false; this.add(this.highlight);
    this.redraw();
  }
  open() { this.visible=true; this.navigator.mode='overview'; this.setHover(null); this.redraw(); }
  update(layout,seat) { this.navigator.update(layout,seat); this.setHover(null); this.redraw(); }
  activate(region) {
    const action=this.navigator.activate(region); this.setHover(null);
    if(action?.kind==='seat') this.onSelectSeat(action.seat);
    else if(action?.kind==='close') this.onClose();
    this.redraw();
  }
  setHover(region) {
    this.highlight.visible=Boolean(region) && this.visible;
    if(!region) return;
    const {x,y,width,height}=region.bounds,vertices=this.highlight.geometry.attributes.position;
    [[x,y],[x+width,y],[x+width,y+height],[x,y+height]].forEach(([px,py],i)=>vertices.setXYZ(i,(px/WIDTH-.5)*1.36,(.5-py/HEIGHT)*1.0625+this.surface.position.y,.002));
    vertices.needsUpdate=true; this.highlight.geometry.computeBoundingSphere();
  }
  redraw() {
    const ctx=this.canvas.getContext('2d'), nav=this.navigator,seat=nav.currentSeat;
    ctx.fillStyle='#10232b'; ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.strokeStyle='#73978d';ctx.lineWidth=3;ctx.strokeRect(2,2,WIDTH-4,HEIGHT-4);
    const text=(value,x,y,size=32,color='#deeee6',align='left')=>{
      ctx.font=`500 ${size}px system-ui`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(value,x,y);
    };
    text(nav.mode==='overview'?'좌석 지도 · 구역 선택':`${nav.sectionId} 구역 · 좌석 선택`,40,60,45);
    text(`현재 위치  ${seat.section} 구역 · ${seat.row}행 · ${seat.number}번째`,40,130,30,'#a0cdb9');
    ctx.fillStyle='#29463f';ctx.fillRect(460,185,616,70);text('스크린 / 앞쪽',WIDTH/2,220,32,'#cee9dc','center');
    const regions=nav.regions();
    for(const r of regions) {
      if(r.kind==='section') {
        ctx.beginPath();r.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
        ctx.fillStyle=r.selected?'#b7e6ce':r.color;ctx.globalAlpha=r.selected?1:.55;ctx.fill();ctx.globalAlpha=1;
        ctx.strokeStyle=r.selected?'#effff6':'#91abae';ctx.lineWidth=r.selected?4:2;ctx.stroke();
        text(r.label,r.center.x,r.center.y,31,r.selected?'#112f26':'#e9f2ec','center');
      } else {
        const b=r.bounds;ctx.globalAlpha=r.enabled?1:.3;
        ctx.fillStyle=r.selected?'#b7e6ce':r.kind==='seat'?'#2a444d':'#31544d';ctx.fillRect(b.x,b.y,b.width,b.height);
        ctx.strokeStyle=r.selected?'#ffffff':'#6c918e';ctx.lineWidth=r.selected?4:2;ctx.strokeRect(b.x,b.y,b.width,b.height);
        text(r.label,b.x+b.width/2,b.y+b.height/2,r.kind==='seat'&&b.width<60?24:32,r.selected?'#102c22':'#eff5ed','center');ctx.globalAlpha=1;
      }
    }
    if(nav.mode==='overview') {
      text('구역을 선택하면 행과 개별 좌석이 표시됩니다.',WIDTH/2,1015,36,'#e8e5c7','center');
      text('연두색: 현재 구역 · 구역 배치는 층을 구분한 개략도입니다.',WIDTH/2,1080,29,'#9bb8b7','center');
    } else {
      const section=nav.layout.bySection.get(nav.sectionId),rows=[...section.rows.keys()].slice(nav.rowPage*MAP_ROWS,(nav.rowPage+1)*MAP_ROWS);
      rows.forEach((row,i)=>text(`${row}행`,65,361+i*100,30,'#c2d9ce'));
      text(`${nav.seatPage*MAP_COLUMNS+1}–${nav.seatPage*MAP_COLUMNS+nav.columns}번째 좌석`,WIDTH/2,287,29,'#9bb8b7','center');
      text(`행 페이지 ${nav.rowPage+1}/${nav.pages.rows} · 좌석 페이지 ${nav.seatPage+1}/${nav.pages.seats} · 빈칸은 좌석 없음`,WIDTH/2,975,29,'#9bb8b7','center');
      text('원하는 좌석에 포인터를 대고 트리거 또는 핀치로 이동',WIDTH/2,1170,28,'#e8e5c7','center');
    }
    this.texture.needsUpdate=true;
  }
  dispose() { this.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});this.texture.dispose(); }
}
