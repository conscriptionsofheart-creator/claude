/* wardrobe_core.js: the Wardrobe's working parts, one copy for every couple3d page and for the Atelier (desk ruling 2026-10-03: a shared core,
 * not copies that drift). Moved out of lib/couple3d.html as they were, text unchanged: the index, the retarget field for non-MakeHuman bodies,
 * wear / take off / apply an outfit, layering and the genital cover. Each page keeps its own Wardrobe UI (_wardUI) and starting kind (_wardKind).
 * Loaded as a plain script before the page's own script, so its names are shared with the page the same way they were inside it.
 * It calls the page's own helpers when they exist (_isCloth, _clothBreastPrep, _clothBreastApply, GLB_V, bodyBySlot). */
// WARDROBE (Ruth, 2026-10-02: "a clothes/attachments builder for the bodies"; CCMH: extend, one place for clothes). Pieces are
// MakeHuman CC0/CC-BY garments, hair and glasses fitted once to the female and male bodies (tools/build_wardrobe.py ->
// lib/wardrobe_<gender>_<id>.glb + wardrobe_index.json), each skinned to bones j0..j54 and bound here to the person's own skeleton,
// so it follows every pose, pin and motion. A dressed character's own baked clothes (cloth_* meshes) are listed in the
// same fold and can be hidden or shown. What a person wears lives in bodyLook(b).outfit {worn:[ids], hidden:[mesh names]},
// so Save, Load, undo, look pins, Duplicate and autosave all carry it; export bakes worn pieces like any skinned mesh.
let _WARD=null, _wardSig='';   // the index once loaded; the signature the page's Wardrobe UI redraws on (each page keeps its own _wardKind)
function _wardThumb(b,gen,id){ const k=(typeof _retargetKey==='function')? _retargetKey(b) : null; return '/pe_lib/'+(k? 'wardrobe_thumb_'+k+'_'+id : 'wardrobe_'+gen+'_'+id)+'.png'; }   // the piece on the body it will go on
/* the pieces that come with boots built in are marked from lib/wardrobe_boots.json (Ruth 2026-10-11: "it also placed boots on her I didn't select", then "why are boots bundled into ten outfits? I have no interest in that, quite the opposite actually"): they are worn WITHOUT their boots (see _cutBoots), and boots come only from the Shoes list */
function _wardIndex(){ if(_WARD) return Promise.resolve(_WARD); return fetch('/pe_lib/wardrobe_index.json?'+Date.now()).then(r=>r.json()).then(j=>fetch('/pe_lib/wardrobe_boots.json?'+Date.now()).then(r=>r.json()).catch(()=>({})).then(bt=>{ try{ Object.keys((bt&&bt.pieces)||{}).forEach(id=>{ if(j.pieces&&j.pieces[id]){ j.pieces[id].boots=true; const c=+((bt.pieces[id]||{}).cut_above_ankle_m); if(c>0) j.pieces[id].bootsCut=c; } }); }catch(e){} _WARD=j; return j; })).catch(()=>{ _WARD={pieces:{}}; return _WARD; }); }
// Wardrobe on bodies that are not the MakeHuman mesh: lib/retarget_<glb>.bin = [reference positions][displacements] of the MakeHuman body's vertices (tools/build_wardrobe_retarget.py)
const _RETARGETS=['female_smplx_vscan','female_smplx','male_smplx'], _retargetCache={};
function _retargetKey(b){ const n=b&&b.glbName; return n&&_RETARGETS.indexOf(n)>=0? n : null; }
function _retargetField(key){ return _retargetCache[key]||(_retargetCache[key]=fetch('/pe_lib/retarget_'+key+'.bin?v='+GLB_V).then(r=>{ if(!r.ok) throw new Error('retarget '+key); return r.arrayBuffer(); }).then(buf=>{ const a=new Float32Array(buf), n=(a.length-330)/6, ref=a.subarray(0,3*n), D=a.subarray(3*n,6*n), Mj=a.subarray(6*n,6*n+165), Tj=a.subarray(6*n+165), cell=0.04, grid=new Map();
  for(let i=0;i<n;i++){ const k=Math.floor(ref[3*i]/cell)+','+Math.floor(ref[3*i+1]/cell)+','+Math.floor(ref[3*i+2]/cell); (grid.get(k)||grid.set(k,[]).get(k)).push(i); }
  return {ref,D,grid,cell,n,Mj,Tj}; })); }
function _retargetThen(b,gl,fin,id){ const key=_retargetKey(b); if(!key){ fin(gl); return; }
  _retargetField(key).then(F=>{ try{ _retargetPiece(b,gl,F,id); }catch(e){ console.warn('retarget',e); } fin(gl); },e=>{ console.warn(e); fin(gl); }); }
function _retargetPiece(b,gl,F,id){ let sm=null; gl.scene.traverse(o=>{ if(o.isSkinnedMesh) sm=o; }); if(!sm) return; const bm=_bodyMesh(b), bs=bm&&bm.skeleton; if(!bs) return;
  const rigid=/^face_(eyes|lashes|brows|teeth|tongue)/.test(id||''), PP=sm.geometry.attributes.position;
  if(rigid){ /* eyes, lashes, brows, teeth and tongue are rigid: they ride the target's own eye and jaw joints, not the skin field (the skin of the face differs from body to body, an eyeball must stay a ball) */
    const J=(a,i)=>[a[3*i],a[3*i+1],a[3*i+2]], dl=i=>{ const m=J(F.Mj,i), t=J(F.Tj,i); return [t[0]-m[0],t[1]-m[1],t[2]-m[2]]; }, el=[J(F.Mj,23),J(F.Mj,24)], de=[dl(23),dl(24)], dj=dl(22);
    for(let v=0;v<PP.count;v++){ const x=PP.getX(v), y=PP.getY(v), z=PP.getZ(v); let d=dj; if(/^face_(eyes|lashes|brows)/.test(id)){ const a=(x-el[0][0])**2+(y-el[0][1])**2+(z-el[0][2])**2, c2=(x-el[1][0])**2+(y-el[1][1])**2+(z-el[1][2])**2; d=a<c2? de[0] : de[1]; } PP.setXYZ(v,x+d[0],y+d[1],z+d[2]); }
    PP.needsUpdate=true; sm.geometry.computeVertexNormals(); sm.geometry.computeBoundingSphere(); }
  const P=sm.geometry.attributes.position, c=F.cell, cand=[]; let d1,d2,d3,d4;
  for(let v=0;v<(rigid?0:P.count);v++){ const x=P.getX(v), y=P.getY(v), z=P.getZ(v), cx=Math.floor(x/c), cy=Math.floor(y/c), cz=Math.floor(z/c); let best=[];
    for(let r=1;r<=3&&best.length<4;r++){ best=[]; for(let i=-r;i<=r;i++) for(let j=-r;j<=r;j++) for(let k=-r;k<=r;k++){ const l=F.grid.get((cx+i)+','+(cy+j)+','+(cz+k)); if(!l) continue; for(const m of l){ const dx=F.ref[3*m]-x, dy=F.ref[3*m+1]-y, dz=F.ref[3*m+2]-z; best.push([dx*dx+dy*dy+dz*dz,m]); } } }
    if(!best.length) continue; best.sort((p,q)=>p[0]-q[0]); const use=best.slice(0,4); let sw=0, ox=0, oy=0, oz=0; use.forEach(e=>{ const w=1/(e[0]+1e-5); sw+=w; ox+=w*F.D[3*e[1]]; oy+=w*F.D[3*e[1]+1]; oz+=w*F.D[3*e[1]+2]; });
    P.setXYZ(v,x+ox/sw,y+oy/sw,z+oz/sw); }
  if(!rigid){ P.needsUpdate=true; sm.geometry.computeVertexNormals(); sm.geometry.computeBoundingSphere(); }
  sm.skeleton.bones.forEach((bn,i)=>{ const body=b.byIdx.get(+String(bn.name).replace(/^j/,'')), j=body? bs.bones.indexOf(body) : -1; if(j>=0) sm.skeleton.boneInverses[i].copy(bs.boneInverses[j]); });
  sm.bindMatrix.copy(bm.bindMatrix); if(!rigid) _retargetWeights(b,sm,bm,bs); }
// the piece's skin weights come from the nearest vertex of this body (as they were taken from the MakeHuman body when it was fitted), so it moves with this body's own skinning
function _retargetWeights(b,sm,bm,bs){ const BI=bm.geometry.attributes.skinIndex, BW=bm.geometry.attributes.skinWeight, BP=bm.geometry.attributes.position, CI=sm.geometry.attributes.skinIndex, CW=sm.geometry.attributes.skinWeight, P=sm.geometry.attributes.position; if(!BI||!BW||!CI||!CW) return;
  const c=0.04; if(!b._tgrid){ const g=new Map(); for(let i=0;i<BP.count;i++){ let kept=0; for(let q=0;q<4;q++) if(BI.array[4*i+q]<55) kept+=BW.array[4*i+q]; if(kept<0.6) continue;   /* nipple, genital and eye pieces ride bones a piece does not have */
    const k=Math.floor(BP.getX(i)/c)+','+Math.floor(BP.getY(i)/c)+','+Math.floor(BP.getZ(i)/c); (g.get(k)||g.set(k,[]).get(k)).push(i); } b._tgrid=g; }
  const rev={}; sm.skeleton.bones.forEach((bn,i)=>{ const body=b.byIdx.get(+String(bn.name).replace(/^j/,'')), j=body? bs.bones.indexOf(body) : -1; if(j>=0) rev[j]=i; });
  for(let v=0;v<P.count;v++){ const x=P.getX(v), y=P.getY(v), z=P.getZ(v), cx=Math.floor(x/c), cy=Math.floor(y/c), cz=Math.floor(z/c), cand=[];
    for(let i=-1;i<=1;i++) for(let j=-1;j<=1;j++) for(let k=-1;k<=1;k++){ const l=b._tgrid.get((cx+i)+','+(cy+j)+','+(cz+k)); if(!l) continue; for(const m of l){ const dx=BP.getX(m)-x, dy=BP.getY(m)-y, dz=BP.getZ(m)-z, d=dx*dx+dy*dy+dz*dz; if(d<0.0036) cand.push([d,m]); } }
    if(!cand.length) continue; cand.sort((p,q)=>p[0]-q[0]); const acc=new Map();   /* the 8 nearest body vertices, weighted by distance, so neighbouring vertices of the piece cannot pick different arms of a noisy weight map */
    cand.slice(0,8).forEach(e=>{ const kw=Math.exp(-e[0]/(2*0.012*0.012))+1e-9, m=e[1]; for(let q=0;q<4;q++){ const ci=rev[BI.array[4*m+q]], w=BW.array[4*m+q]; if(ci!=null&&w>0) acc.set(ci,(acc.get(ci)||0)+w*kw); } });
    const top=[...acc.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4), s=top.reduce((a,e)=>a+e[1],0); if(s<=0) continue; for(let q=0;q<4;q++){ const e=top[q]; CI.array[4*v+q]=e?e[0]:0; CW.array[4*v+q]=e? e[1]/s : 0; } }
  CI.needsUpdate=true; CW.needsUpdate=true; }
function _wardFits(b){ if(!b||/anny/.test(b.glbFile||'')) return false; if(_retargetKey(b)) return true; return b.model==='mh'; }   // fitted on MakeHuman's own mesh and skeleton
function _bodyMesh(b){ return b.meshes.find(m=>m.isSkinnedMesh&&!_isCloth(m)&&m.name!=='genitals')||b.meshes[0]; }
function _wardFacePart(m){ const mt=Array.isArray(m.material)?m.material[0]:m.material, part=(mt&&mt.userData&&mt.userData.part)||''; return /eye|teeth|tongue|lash|brow/i.test(part+' '+m.name); }   // eyes, teeth, tongue, lashes, brows: built like clothes, part of the face
function _outfitOf(b){ return { worn:(b._worn||[]).map(w=>w.id), fit:(()=>{ const o={}; (b._worn||[]).forEach(w=>{ if(w.fit) o[w.id]={x:w.fit.x,y:w.fit.y,z:w.fit.z,s:w.fit.s}; }); return Object.keys(o).length?o:undefined; })(), hidden:b.meshes.filter(m=>_isCloth(m)&&!(m.userData&&m.userData.wardrobe)&&m.visible===false&&!(m.userData&&m.userData.dirHid)).map(m=>m.name) }; }   /* a mesh the song hid (direction.js sets userData.dirHid) is not one she hid: never saved as hidden */
// Wardrobe layering: which kind a piece is (the index once it has loaded, else its name), the genital piece hidden under a lower garment, a small outward nudge for what sits on top
function _wardKindOf(id){ const e=_WARD&&_WARD.pieces&&_WARD.pieces[id]; if(e&&e.kind) return e.kind; const n=String(id).toLowerCase();
  if(/dress|gown|robe|kimono|toga|sari|tunic/.test(n)) return 'dress'; if(/suit|overall|jumpsuit|bodysuit|leotard|uniform|armou?r|costume|outfit/.test(n)) return 'full';
  if(/pant|trouser|jean|skirt|short|legging|kilt|briefs|panties|underwear|loincloth/.test(n)) return 'bottom'; if(/shirt|top|sweater|jacket|coat|blouse|vest|bra|bikini|hoodie|cardigan|tank|corset/.test(n)) return 'top'; return ''; }
function _syncGen(b){ if(!b) return; if(!_WARD&&!b._genWait){ b._genWait=1; _wardIndex().then(()=>{ b._genWait=0; _syncGen(b); }); }
  b._genCovered=(b._worn||[]).some(w=>w.mesh&&/^(bottom|dress|full)$/.test(_wardKindOf(w.id))); if(b.genitalMesh) b.genitalMesh.visible=!b.hideGen&&!b._genCovered; }
function _layerNudge(sm,id){ const k=_wardKindOf(id), off=k==='top'? 0.003 : (k==='dress'||k==='full')? 0.0015 : 0; if(!off||!sm||!sm.geometry) return; const g=sm.geometry, P=g.attributes.position, N=g.attributes.normal; if(!P||!N) return;
  const key=i=>Math.round(P.getX(i)*1e4)+','+Math.round(P.getY(i)*1e4)+','+Math.round(P.getZ(i)*1e4), sum=new Map();   /* vertices on a texture seam share a position: they take the same push, or the seam opens */
  for(let i=0;i<P.count;i++){ const k=key(i), s=sum.get(k)||sum.set(k,[0,0,0]).get(k); s[0]+=N.getX(i); s[1]+=N.getY(i); s[2]+=N.getZ(i); }
  const mv=new Float32Array(P.count*3); for(let i=0;i<P.count;i++){ const s=sum.get(key(i)), l=Math.hypot(s[0],s[1],s[2])||1; mv[3*i]=P.getX(i)+s[0]/l*off; mv[3*i+1]=P.getY(i)+s[1]/l*off; mv[3*i+2]=P.getZ(i)+s[2]/l*off; }
  for(let i=0;i<P.count;i++) P.setXYZ(i,mv[3*i],mv[3*i+1],mv[3*i+2]); P.needsUpdate=true; }
/* the ten pieces that come with boots built in (lib/wardrobe_boots.json) go on without them. Two cuts, both read in the piece's own bind pose from the ankle bones j7 and j8 so they hold on every body the piece is fitted to: (1) a boot that is a shell of its own (the three armours: two shells that touch the foot and end below ankle + 0.40 m) is left out whole; (2) in the suits whose boots are part of the leg, every triangle with a point below the ankle bone (plus "cut_above_ankle_m" in that file, for the cyborg's bulky ones) is left out, so the leg ends at the ankle. The drawn index is rebuilt; the file is not changed, and boots from the Shoes list are worn as before. */
function _cutBoots(sm,id){ const e=_WARD&&_WARD.pieces&&_WARD.pieces[id]; if(!e||!e.boots||!sm||!sm.geometry) return 0; const g=sm.geometry, P=g.attributes.position, ix=g.index, sk=sm.skeleton; if(!P||!ix||!sk||(g.groups&&g.groups.length>1)) return 0;
  let ay=1e9; sk.bones.forEach((bn,i)=>{ if(bn&&(bn.name==='j7'||bn.name==='j8')&&sk.boneInverses[i]){ const m=sk.boneInverses[i].clone().invert(); ay=Math.min(ay,m.elements[13]); } }); if(!(ay<1e8)) return 0;
  const cut=ay+(e.bootsCut||0), B=sm.bindMatrix.elements, n=P.count, ys=new Float32Array(n); for(let i=0;i<n;i++) ys[i]=B[1]*P.getX(i)+B[5]*P.getY(i)+B[9]*P.getZ(i)+B[13];
  /* shells: vertices that share a position (texture seams) belong together; triangles join their three corners */
  const canon=new Int32Array(n), seen=new Map(), par=new Int32Array(n); for(let i=0;i<n;i++){ const k=Math.round(P.getX(i)*1e4)+','+Math.round(P.getY(i)*1e4)+','+Math.round(P.getZ(i)*1e4); let c=seen.get(k); if(c===undefined){ seen.set(k,i); c=i; } canon[i]=c; par[i]=i; }
  const find=x=>{ while(par[x]!==x){ par[x]=par[par[x]]; x=par[x]; } return x; }, a=ix.array;
  for(let t=0;t+2<a.length;t+=3){ const r0=find(canon[a[t]]), r1=find(canon[a[t+1]]), r2=find(canon[a[t+2]]); if(r1!==r0) par[r1]=r0; const q=find(r0), r=find(r2); if(r!==q) par[r]=q; }
  const lo=new Map(), hi=new Map(); for(let i=0;i<n;i++){ const r=find(canon[i]); if(!(lo.get(r)<=ys[i])) lo.set(r,ys[i]); if(!(hi.get(r)>=ys[i])) hi.set(r,ys[i]); }
  const boot=new Set(); lo.forEach((l,r)=>{ if(l<ay+0.03&&hi.get(r)<ay+0.40) boot.add(r); });
  const keep=new a.constructor(a.length); let m=0, dropped=0; for(let t=0;t+2<a.length;t+=3){ if(ys[a[t]]<cut||ys[a[t+1]]<cut||ys[a[t+2]]<cut||boot.has(find(canon[a[t]]))){ dropped++; continue; } keep[m++]=a[t]; keep[m++]=a[t+1]; keep[m++]=a[t+2]; }
  if(!dropped) return 0; g.setIndex(new THREE.BufferAttribute(keep.slice(0,m),1)); if(g.clearGroups) g.clearGroups(); sm.userData.bootsCut=dropped; return dropped; }

/* CUTS STAY (Ruth 2026-10-12: "when I modify the clothes by cutting, it doesn't save on refresh or in a scene"). A worn piece whose geometry was cut, carved, erased or healed in the sculpt tools is packed into this browser's IndexedDB under page|figure|piece and put back when the piece is worn again. "Reset this piece" brings the original back. */
const _wardRecs=new Set(); window._wardRecs=_wardRecs;
function _geoDB(){ return window._geoDBp||(window._geoDBp=new Promise((res,rej)=>{ const r=indexedDB.open('ward_geo_v1',1); r.onupgradeneeded=()=>r.result.createObjectStore('g'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); })); }
function _geoKey(b,id){ return location.pathname.split('/').pop()+'|'+(b.slot||b.name||'x')+'|'+id; }
async function _geoPut(k,v){ const db=await _geoDB(); return new Promise((res,rej)=>{ const t=db.transaction('g','readwrite'); if(v==null) t.objectStore('g').delete(k); else t.objectStore('g').put(v,k); t.oncomplete=res; t.onerror=()=>rej(t.error); }); }
async function _geoGet(k){ const db=await _geoDB(); return new Promise((res,rej)=>{ const q=db.transaction('g').objectStore('g').get(k); q.onsuccess=()=>res(q.result); q.onerror=()=>rej(q.error); }); }
function _geoPack(g){ const o={attrs:{},morph:[],index:g.index?{a:g.index.array.slice()}:null,groups:g.groups.map(x=>({start:x.start,count:x.count,materialIndex:x.materialIndex})),rel:!!g.morphTargetsRelative}; for(const n in g.attributes){ const a=g.attributes[n]; o.attrs[n]={a:a.array.slice(),s:a.itemSize,n:!!a.normalized}; } const mp=g.morphAttributes&&g.morphAttributes.position; if(mp) o.morph=mp.map(a=>({a:a.array.slice(),s:a.itemSize})); return o; }
function _geoUnpack(o){ const g=new THREE.BufferGeometry(); for(const n in o.attrs){ const q=o.attrs[n]; g.setAttribute(n,new THREE.BufferAttribute(q.a,q.s,q.n)); } if(o.index) g.setIndex(new THREE.BufferAttribute(o.index.a,1)); if(o.morph.length) g.morphAttributes.position=o.morph.map(m=>new THREE.BufferAttribute(m.a,m.s)); g.morphTargetsRelative=o.rel; (o.groups||[]).forEach(x=>g.addGroup(x.start,x.count,x.materialIndex)); g.computeBoundingSphere(); g.computeBoundingBox(); return g; }
function _wardGeoSaveAll(){ _wardRecs.forEach(e=>{ try{ const m=e.rec.mesh; if(!m||!m.geometry||m.geometry===e.rec.geoSaved) return; e.rec.geoSaved=m.geometry; _geoPut(_geoKey(e.b,e.rec.id),m.geometry===e.rec.geo0?null:_geoPack(m.geometry)); }catch(err){ console.warn('cut save',err); } }); }
window._wardGeoSaveAll=_wardGeoSaveAll;
function _wardGeoReset(b,rec){ try{ const m=rec.mesh; if(m&&rec.geo0&&m.geometry!==rec.geo0){ m.geometry=rec.geo0; rec.geoSaved=rec.geo0; if(m.updateMorphTargets) m.updateMorphTargets(); } _geoPut(_geoKey(b,rec.id),null); }catch(e){} }
function _wear(b,id){ if(!_wardFits(b)) return Promise.resolve(); b._worn=b._worn||[]; if(b._worn.some(w=>w.id===id)) return Promise.resolve();
  const rec={id, mesh:null}, gen=b.gender==='male'?'male':'female'; b._worn.push(rec);
  return new Promise(res=>new THREE.GLTFLoader().load('/pe_lib/wardrobe_'+gen+'_'+id+'.glb', gl0=>_retargetThen(b,gl0,gl=>{ let sm=null; gl.scene.traverse(o=>{ if(o.isSkinnedMesh) sm=o; });
      if(!sm||!b._worn.includes(rec)){ res(); return; } try{ _layerNudge(sm,id); }catch(e){} try{ _cutBoots(sm,id); }catch(e){ console.warn('boots cut',e); }
      const bones=sm.skeleton.bones.map(bn=>b.byIdx.get(+String(bn.name).replace(/^j/,''))); if(bones.some(x=>!x)){ b._worn=b._worn.filter(w=>w!==rec); res(); return; }
      const bm=_bodyMesh(b), skel=new THREE.Skeleton(bones, sm.skeleton.boneInverses.map(m=>m.clone()));
      (Array.isArray(sm.material)?sm.material:[sm.material]).forEach(m=>{ m.userData=Object.assign(m.userData||{}, {role:'cloth'}); m.skinning=true; m.needsUpdate=true; });
      sm.name='cloth_'+id; sm.frustumCulled=false; sm.userData.wardrobe=id; sm.castShadow=true;
      const bind=sm.bindMatrix.clone(); bm.parent.add(sm); sm.position.copy(bm.position); sm.quaternion.copy(bm.quaternion); sm.scale.copy(bm.scale); sm.updateMatrixWorld(true);
      sm.bind(skel, bind); rec.mesh=sm; b.meshes.push(sm); try{ const wf=b._fitWant&&b._fitWant[id]; if(wf){ rec.fit={x:+wf.x||0,y:+wf.y||0,z:+wf.z||0,s:+wf.s||1}; _clothFitApply(rec); } }catch(e){ console.warn('cloth fit',e); } _wardSig=''; try{ _syncGen(b); }catch(e){} try{ _clothBreastPrep(b,rec); _clothBreastApply(b); }catch(e){ console.warn('cloth breast fit',e); }
      try{ if(!rec.fit&&!rec.bind0) _clothFitApply(rec); rec.geo0=sm.geometry; rec.geoSaved=sm.geometry; _wardRecs.add({b,rec}); _geoGet(_geoKey(b,id)).then(o=>{ if(!o||!b._worn.includes(rec)||!rec.mesh) return; const g=_geoUnpack(o); rec.mesh.geometry=g; rec.geoSaved=g; if(rec.mesh.updateMorphTargets) rec.mesh.updateMorphTargets(); }).catch(()=>{}); }catch(e){ console.warn('cut restore',e); }
      res(); }, id), undefined, ()=>{ b._worn=b._worn.filter(w=>w!==rec); res(); })); }
function _unwear(b,id){ const rec=(b._worn||[]).find(w=>w.id===id); if(!rec) return; b._worn=b._worn.filter(w=>w!==rec);
  _wardRecs.forEach(e=>{ if(e.rec===rec) _wardRecs.delete(e); }); const m=rec.mesh; if(m){ if(m.parent) m.parent.remove(m); const i=b.meshes.indexOf(m); if(i>=0) b.meshes.splice(i,1); m.geometry.dispose(); (Array.isArray(m.material)?m.material:[m.material]).forEach(x=>{ if(x.map) x.map.dispose(); x.dispose(); }); }
  _wardSig=''; try{ _syncGen(b); }catch(e){} }

/* CLOTHES FIT (Ruth 2026-10-12: "the jacket came in in a way that doesn't actually fit the body ... add the ability in sculpting, in both apps, to move the clothing and reposition it"). Each worn piece can be moved up/down, forward/back, left/right and resized. It is applied through the piece's skin-binding matrix, so it composes with the breathing, the breast fitting and the retarget (nothing rewrites vertices), and it is saved with the outfit (look.outfit.fit[pieceId] = {x,y,z,s}; x,y,z are fractions of the piece's own height, s is a multiplier). */
function _clothFitApply(rec){ const m=rec&&rec.mesh; if(!m||!m.geometry) return false;
  if(!rec.bind0){ rec.bind0=m.bindMatrix.clone(); m.geometry.computeBoundingBox(); const bb=m.geometry.boundingBox; rec.c=bb.getCenter(new THREE.Vector3()); rec.h=Math.max(1e-6,bb.max.y-bb.min.y); }
  const f=rec.fit||{x:0,y:0,z:0,s:1}, c=rec.c, T=new THREE.Matrix4().makeTranslation(c.x+f.x*rec.h,c.y+f.y*rec.h,c.z+f.z*rec.h).multiply(new THREE.Matrix4().makeScale(f.s,f.s,f.s)).multiply(new THREE.Matrix4().makeTranslation(-c.x,-c.y,-c.z));
  m.bindMatrix.copy(rec.bind0).multiply(T); return true; }
function _clothFit(b,id,f){ const rec=(b._worn||[]).find(w=>w.id===id); if(!rec) return false; if(f===null) _wardGeoReset(b,rec); const on=f&&(Math.abs(f.x||0)>1e-4||Math.abs(f.y||0)>1e-4||Math.abs(f.z||0)>1e-4||Math.abs((f.s==null?1:f.s)-1)>1e-4); rec.fit=on?{x:+f.x||0,y:+f.y||0,z:+f.z||0,s:f.s==null?1:+f.s}:null; return _clothFitApply(rec); }
function _clothNudge(b,id,axis,dir){ const rec=(b._worn||[]).find(w=>w.id===id); if(!rec) return null; const f=Object.assign({x:0,y:0,z:0,s:1},rec.fit||{}); if(axis==='s') f.s=Math.max(0.5,Math.min(1.8,+(f.s*(dir>0?1.03:1/1.03)).toFixed(4))); else f[axis]=Math.max(-0.5,Math.min(0.5,+(f[axis]+dir*0.01).toFixed(4))); _clothFit(b,id,f); try{ window._wardFitSaved&&window._wardFitSaved(b); }catch(e){} return rec.fit||{x:0,y:0,z:0,s:1}; }
if(!window._wardFitSaved) window._wardFitSaved=()=>{ try{ if(typeof persist==='function') persist(); }catch(e){} };   /* the BSA saves its look; the Atelier replaces this with its own saveOutfit */
const _FIT_AXES=[['y','Up / down',-0.3,0.3,0.005],['z','Forward / back',-0.3,0.3,0.005],['x','Left / right',-0.3,0.3,0.005],['s','Size',0.6,1.6,0.01]];
function _wardFitUI(host,b){ try{ const worn=(b._worn||[]).filter(w=>w.mesh&&!/^face_/.test(w.id)); const old=host.querySelector('#wardFit'); if(old) old.remove(); if(!worn.length) return; const P=(_WARD&&_WARD.pieces)||{};
    const box=document.createElement('div'); box.id='wardFit'; box.style.cssText='margin-top:8px;padding:8px;border:1px solid var(--line,#44385a);border-radius:10px;font-size:12px';
    if(!worn.some(w=>w.id===b._fitSel)) b._fitSel=worn[0].id;
    const sel=document.createElement('select'); sel.style.cssText='width:100%;margin:4px 0 6px;padding:4px 6px;background:#20182a;color:inherit;border:1px solid var(--line,#44385a);border-radius:8px'; worn.forEach(w=>{ const o=document.createElement('option'); o.value=w.id; o.textContent=_wardNice(P[w.id],w.id); if(w.id===b._fitSel) o.selected=true; sel.appendChild(o); });
    const head=document.createElement('div'); head.innerHTML='<b>Fit a piece</b> <span style="opacity:.7">move or resize the one you pick; it is saved with the outfit</span>'; box.append(head,sel);
    const cur=()=>(worn.find(w=>w.id===b._fitSel)||{}).fit||{x:0,y:0,z:0,s:1}; const rows=[];
    _FIT_AXES.forEach(([k,label,lo,hi,st])=>{ const row=document.createElement('label'); row.style.cssText='display:flex;align-items:center;gap:8px;margin:3px 0'; const nm=document.createElement('span'); nm.style.cssText='width:96px;flex:none'; nm.textContent=label; const r=document.createElement('input'); r.type='range'; r.min=lo; r.max=hi; r.step=st; r.style.cssText='flex:1;min-width:0'; r.value=cur()[k]==null?(k==='s'?1:0):cur()[k];
      r.addEventListener('pointerdown',()=>{ try{ if(typeof pushUndo==='function') pushUndo(); }catch(e){} });
      r.addEventListener('input',()=>{ const f=Object.assign({x:0,y:0,z:0,s:1},cur()); f[k]=+r.value; _clothFit(b,b._fitSel,f); try{ window._wardFitSaved&&window._wardFitSaved(b); }catch(e){} });
      row.append(nm,r); box.appendChild(row); rows.push([k,r]); });
    const reset=document.createElement('button'); reset.type='button'; reset.textContent='Reset this piece'; reset.style.cssText='margin-top:6px;padding:4px 10px;border-radius:999px;border:1px solid var(--line,#44385a);background:#2a2036;color:inherit;cursor:pointer'; reset.onclick=()=>{ try{ if(typeof pushUndo==='function') pushUndo(); }catch(e){} _clothFit(b,b._fitSel,null); rows.forEach(([k,r])=>{ r.value=k==='s'?1:0; }); try{ window._wardFitSaved&&window._wardFitSaved(b); }catch(e){} };
    sel.onchange=()=>{ b._fitSel=sel.value; rows.forEach(([k,r])=>{ r.value=cur()[k]==null?(k==='s'?1:0):cur()[k]; }); };
    box.appendChild(reset); host.appendChild(box); }catch(e){ console.warn('wardFitUI',e); } }
function _applyOutfit(slot,o){ const b=bodyBySlot(slot); if(!b||!o) return; const want=new Set(o.worn||[]); b._fitWant=o.fit||{};
  (b._worn||[]).map(w=>w.id).filter(id=>!want.has(id)).forEach(id=>_unwear(b,id)); want.forEach(id=>{ if(!(b._worn||[]).some(w=>w.id===id)) _wear(b,id); });
  (b._worn||[]).forEach(w=>{ if(!w.mesh) return; const f=(o.fit||{})[w.id]; w.fit=f?{x:+f.x||0,y:+f.y||0,z:+f.z||0,s:+f.s||1}:null; try{ _clothFitApply(w); }catch(e){} });
  const hid=new Set(o.hidden||[]); b.meshes.forEach(m=>{ if(_isCloth(m)&&!(m.userData&&m.userData.wardrobe)) m.visible=!hid.has(m.name); }); _wardSig=''; }
// a readable name for a piece: the index holds file-style names (mhair02, Dress_Midi_Halter, elvs_ladies_hippyhair1)
function _wardNice(e,id){ let n=String((e&&e.name)||id||''); n=n.replace(/^(elvs|o4saken|cortu|toigo|culturalibre|dali|tbm|mc)[_ -]+/i,'').replace(/^mhair/i,'hair').replace(/[_-]+/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/([A-Za-z])(\d)/g,'$1 $2').replace(/\s+/g,' ').trim();
  if(e&&e.kind==='hair'&&!/hair/i.test(n)) n+=' hair'; n=n.charAt(0).toUpperCase()+n.slice(1); return n; }
