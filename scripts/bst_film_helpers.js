/* bst_film_helpers.js: page helpers for the film cards of BST's lessons (lib/lesson_films/<id>.json use them in "js" moments and camera targets).
   Loaded by the first moment of each card:  (window.__bf||new Promise(r=>{const s=document.createElement('script');s.src='/pe_lib/bst_film_helpers.js';s.onload=r;document.head.appendChild(s);}))
   Everything here goes through the page's own hooks (VRCore.lesson, VRCore._sculptFrame, VRObjects, the Atelier room pieces). World metres. Film work only; nothing in the app calls this. */
(()=>{ if(window.__bf) return; const wait=ms=>new Promise(r=>setTimeout(r,ms)); const SI=()=>VRCore.sceneInfo();
const bf=window.__bf={ wait,
  fig(){ return __gal.bodies[0].group; },
  box(){ const T=SI().THREE, b=new T.Box3().setFromObject(bf.fig()); return b; },
  center(){ const b=bf.box(); return [(b.min.x+b.max.x)/2,(b.min.y+b.max.y)/2,(b.min.z+b.max.z)/2]; },
  head(){ const b=bf.box(); return [(b.min.x+b.max.x)/2,b.max.y-0.12,(b.min.z+b.max.z)/2]; },
  setup(){ if(window.__stroke) return true; const vs=VRCore._sculpt().vs, fig=bf.fig(); let mesh=null; fig.traverse(o=>{ if(o.isSkinnedMesh&&!(o.userData&&o.userData._bfx)&&!/^_/.test(o.name||'')&&(!mesh||o.geometry.attributes.position.count>mesh.geometry.attributes.position.count)) mesh=o; });
    const en=vs.entryOf(mesh), P=en.posed, n=P.length/3; let top=-1e9, bot=1e9; for(let i=0;i<n;i++){ top=Math.max(top,P[i*3+1]); bot=Math.min(bot,P[i*3+1]); }
    const h=bot+(top-bot)*0.58; let best=-1, mz=-1e9, left=-1, lx=-1e9; for(let i=0;i<n;i++){ if(Math.abs(P[i*3+1]-h)<0.02&&P[i*3+2]>mz&&Math.abs(P[i*3])<0.05){ mz=P[i*3+2]; best=i; } }
    for(let i=0;i<n;i++){ if(Math.abs(P[i*3+1]-h)<0.02&&P[i*3+2]>mz-0.07&&P[i*3]>lx){ lx=P[i*3]; left=i; } }
    window.__m=mesh; window.__pt=(i,off)=>{ const v=new (mesh.position.constructor)(P[i*3],P[i*3+1],P[i*3+2]+off); return v.applyMatrix4(mesh.matrixWorld); }; window.__belly=best; window.__side=left;
    window.__stroke=(i,frames)=>{ const t=window.__pt(i,0.01); for(let f=0;f<frames;f++){ const q=t.clone(); q.x+=f*0.002; VRCore._sculptFrame([{id:'r',tip:q,pinch:true}],0.016); } VRCore._sculptFrame([{id:'r',tip:t,pinch:false}],0.016); }; return true; },
  async sculpt(){ VRCore.lesson.sculptOpen(); for(let i=0;i<40&&!(VRCore._sculpt().vs&&VRCore._sculpt().vs.cfg.on);i++) await wait(250); await wait(1200); bf.setup(); return true; },
  faceFront(){ const b=bf.box(); return [(b.min.x+b.max.x)/2,b.max.y-0.115,(b.min.z+b.max.z)/2+0.08]; },
  async strokeAt(p,n){ bf.setup(); const T=SI().THREE; for(let f=0;f<(n||10);f++){ VRCore._sculptFrame([{id:'r',tip:new T.Vector3(p[0]+f*0.002,p[1],p[2]),pinch:true}],0.016); } VRCore._sculptFrame([{id:'r',tip:new T.Vector3(p[0],p[1],p[2]),pinch:false}],0.016); await wait(300); return true; },
  belly(){ bf.setup(); return window.__pt(window.__belly,0.01).toArray(); },
  side(){ bf.setup(); return window.__pt(window.__side,0.01).toArray(); },
  async stroke(which,n){ bf.setup(); window.__stroke(which==='side'?window.__side:window.__belly,n||18); await wait(300); return true; },
  async stick(dir){ for(let i=0;i<60;i++){ VRCore._sculptStick(dir,0.016); await wait(16); } return true; },
  async act(id,i){ const s=AtelierVRTour.lessons[id].steps[i]; if(s&&s.action) s.action.fn(); await wait(500); return true; },
  async room(name){ __gal.setTab('rooms'); await wait(800); __gal.selectRoom(name||'woodshop'); for(let i=0;i<60&&!window.__room;i++) await wait(250); await wait(1500); return true; },
  piece(k){ const o=[]; VRObjects.entries(o); const e=o.filter(x=>x.kind==='room')[k||0]; if(!e) return bf.center(); const T=SI().THREE; return e.object.getWorldPosition(new T.Vector3()).toArray(); },
  roomCenter(){ const T=SI().THREE, b=new T.Box3(); const o=[]; VRObjects.entries(o); o.filter(x=>x.kind==='room').forEach(e=>b.expandByObject(e.object)); if(b.isEmpty()) return bf.center(); return [(b.min.x+b.max.x)/2,(b.min.y+b.max.y)/2,(b.min.z+b.max.z)/2]; },
  move(dx){ const o=[]; VRObjects.entries(o); const e=o.find(x=>x.kind==='room'); if(!e) return false; e.object.position.x+=dx; e.object.updateMatrixWorld(true); e.commit(); return true; },
  click(sel){ const el=document.querySelector(sel); if(el) el.click(); return !!el; },
  slide(sel,v){ const x=document.querySelector(sel); if(!x) return false; x.value=v; x.dispatchEvent(new Event('input',{bubbles:true})); return true; } };
})();
