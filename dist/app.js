import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';
import {Simulation,RAPIER} from './simulation.js';
import {SCENES,DEFAULT_WORLD,PALETTES,MAX_BODIES,launchVelocity,validRecipe,dropProperties,towerTop} from './model.js';

const $=s=>document.querySelector(s);
const icons={
  tower:'<rect x="5" y="19" width="8" height="8" rx="2"/><rect x="15" y="19" width="8" height="8" rx="2"/><rect x="10" y="9" width="8" height="8" rx="2"/><path d="M24 4l3 3m-6-1 4 4"/>',
  marbles:'<circle cx="10" cy="9" r="5"/><circle cx="23" cy="12" r="4"/><circle cx="16" cy="24" r="6"/>',
  domino:'<rect x="5" y="10" width="7" height="18" rx="2"/><rect x="17" y="5" width="7" height="18" rx="2" transform="rotate(20 20 14)"/><path d="M8 17h1m11-4h1"/>',
  tumbler:'<circle cx="16" cy="16" r="11"/><path d="M7 6l-1 7 7-1"/><circle cx="14" cy="20" r="3"/><circle cx="21" cy="17" r="2"/>',
  magnet:'<path d="M7 6v12a9 9 0 0018 0V6h-6v12a3 3 0 01-6 0V6zM7 12h6m6 0h6"/>',
  jelly:'<path d="M4 14q0-6 6-7l12 1q6 1 5 7l-1 10q-1 5-7 3L8 26q-5-1-4-6z"/><path d="M5 14l13 3 9-5m-9 5-1 10"/>',
};
const names=Object.keys(SCENES),states=Object.fromEntries(names.map(k=>[k,{...SCENES[k].defaults}]));
let active='tower',worldSettings={...DEFAULT_WORLD},palette='sorbet',finish='glass',paused=false,speed=1,mode='aim',soundOn=false,sim;
let environmentMap,marbleMaterials;
let jellySkin,jellyWeights,slabDecoration;
let scene,camera,renderer,orbit,staticGroup,decorGroup,drumVisual,magnetVisual,cannon,trajectory,aimMarker,dropGhost;
let ballInstances,boxInstances,ballItems=[],boxItems=[],ready=false;
const transform=new THREE.Object3D(),tmpColor=new THREE.Color(),ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
const aim=new THREE.Vector3(0,2.7,-.6),launchPoint=new THREE.Vector3(0,1.15,5.4);
const geometryCache=new Map(),materialCache=new Map();
let dragging=null,pointerStart=null,pointerMoved=false,toastTimer,accumulator=0,lastTime=0,frameCount=0,fpsTime=0;
let recipes=[];
try{const raw=JSON.parse(localStorage.getItem('satisfying-lab-recipes-v1')||'[]');if(Array.isArray(raw))recipes=raw.map(validRecipe).filter(Boolean).slice(0,30);}catch{}

function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2600);}
function meshMaterial(color,roughness=.4,metalness=.05){const key=`${color}-${roughness}-${metalness}`;if(!materialCache.has(key))materialCache.set(key,new THREE.MeshStandardMaterial({color,roughness,metalness}));return materialCache.get(key);}
function sphereGeometry(){if(!geometryCache.has('sphere'))geometryCache.set('sphere',new THREE.SphereGeometry(.5,32,20));return geometryCache.get('sphere');}
function boxGeometry(){if(!geometryCache.has('box'))geometryCache.set('box',new RoundedBoxGeometry(1,1,1,2,.055));return geometryCache.get('box');}
function box(size,pos,color,parent=decorGroup,round=true){const m=new THREE.Mesh(round?boxGeometry():new THREE.BoxGeometry(1,1,1),meshMaterial(color));m.scale.set(...size);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function ball(diameter,pos,color,parent=decorGroup){const m=new THREE.Mesh(sphereGeometry(),meshMaterial(color,.23,.12));m.scale.setScalar(diameter);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function cylinder(radius,length,pos,color,parent=decorGroup){const m=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,32),meshMaterial(color,.3,.12));m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function torus(radius,tube,pos,color,parent=decorGroup){const m=new THREE.Mesh(new THREE.TorusGeometry(radius,tube,10,80),meshMaterial(color,.3,.15));m.position.set(...pos);m.castShadow=true;parent.add(m);return m;}
function disposeDecor(group){group.traverse(o=>{if(o.geometry&&!Array.from(geometryCache.values()).includes(o.geometry))o.geometry.dispose();if(o.material?.userData.unique)o.material.dispose();});group.clear();}

function setupRenderer(){
  renderer=new THREE.WebGLRenderer({canvas:$('#canvas'),antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
  scene=new THREE.Scene();scene.background=new THREE.Color('#f2efe8');scene.fog=new THREE.Fog('#f2efe8',35,90);
  const studio=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);
  environmentMap=pmrem.fromScene(studio,.025).texture;studio.dispose();pmrem.dispose();
  marbleMaterials={
    glass:new THREE.MeshPhysicalMaterial({roughness:.045,metalness:0,transmission:.72,thickness:.45,ior:1.5,clearcoat:1,clearcoatRoughness:.025,envMap:environmentMap,envMapIntensity:1.4}),
    metal:new THREE.MeshPhysicalMaterial({roughness:.12,metalness:1,clearcoat:.7,clearcoatRoughness:.06,envMap:environmentMap,envMapIntensity:1.8}),
    resin:new THREE.MeshPhysicalMaterial({roughness:.16,metalness:.05,clearcoat:1,clearcoatRoughness:.035,envMap:environmentMap,envMapIntensity:1.1}),
  };
  camera=new THREE.PerspectiveCamera(36,1,.1,120);
  orbit=new OrbitControls(camera,$('#canvas'));orbit.enableDamping=true;orbit.dampingFactor=.07;orbit.minDistance=9;orbit.maxDistance=75;orbit.maxPolarAngle=Math.PI*.48;orbit.minPolarAngle=.15;orbit.enablePan=false;orbit.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.ROTATE};
  scene.add(new THREE.HemisphereLight('#fffaf1','#b7a4c7',2.6));
  const sun=new THREE.DirectionalLight('#fff4df',3.4);sun.position.set(-7,17,10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-13,right:13,top:16,bottom:-12,near:1,far:45});sun.shadow.bias=-.0004;sun.shadow.normalBias=.035;sun.shadow.radius=3;scene.add(sun);
  const fill=new THREE.DirectionalLight('#cdd9ff',1.5);fill.position.set(8,6,-5);scene.add(fill);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),meshMaterial('#eeeae2',.9));ground.rotation.x=-Math.PI/2;ground.position.y=-.75;ground.receiveShadow=true;scene.add(ground);
  staticGroup=new THREE.Group();decorGroup=new THREE.Group();scene.add(staticGroup,decorGroup);
  const instanceMaterial=new THREE.MeshStandardMaterial({roughness:.32,metalness:.07});
  ballInstances=new THREE.InstancedMesh(sphereGeometry(),marbleMaterials[finish],MAX_BODIES);boxInstances=new THREE.InstancedMesh(boxGeometry(),instanceMaterial,MAX_BODIES);
  for(const m of [ballInstances,boxInstances]){m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;m.count=0;scene.add(m);}
  const resize=()=>{const el=$('#viewport');renderer.setSize(el.clientWidth,el.clientHeight,false);camera.aspect=el.clientWidth/el.clientHeight;camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(18))*Math.max(1,1.2/camera.aspect)));camera.updateProjectionMatrix();};
  new ResizeObserver(resize).observe($('#viewport'));resize();
}
function resetCamera(){
  if(active==='tower'&&states.tower.delivery==='drop'){const h=towerTop(states.tower)+states.tower.dropHeight,scale=Math.max(1,h/10);orbit.target.set(0,h*.34,0);camera.position.set(13*scale,11.5*scale+h*.34,17*scale);}
  else if(active==='tower'&&states.tower.delivery==='domino'){const h=Math.max(towerTop(states.tower),states.tower.slabHeight),scale=Math.max(1,h/7);orbit.target.set(-1,h*.3,0);camera.position.set(13*scale,11.5*scale,18*scale);}
  else if(active==='jelly'){camera.position.set(11,10,18);orbit.target.set(0,2.4,0);}
  else if(active==='marbles'){camera.position.set(10,9,18);orbit.target.set(0,2.8,-1.3);}
  else if(active==='tumbler'){camera.position.set(10,8,18);orbit.target.set(0,2.6,0);}
  else {camera.position.set(13,11.5,17);orbit.target.set(0,1.3,0);}
  orbit.update();
}
function buildVisuals(){
  disposeDecor(staticGroup);disposeDecor(decorGroup);drumVisual=null;magnetVisual=null;cannon=null;trajectory=null;aimMarker=null;dropGhost=null;jellySkin=null;jellyWeights=null;slabDecoration=null;
  for(const item of sim.fixed){
    let color='#d4c8e3';
    if(item.role==='invisible')continue;
    if(item.role==='floor')color='#f8f3e8';
    if(item.role==='rim')color='#d6c4e9';
    if(item.role==='pegboard')color='#b3d5cb';
    if(item.role==='rail')color='#86b9ae';
    if(item.role==='peg')color=PALETTES[palette][item.color];
    if(item.role==='paddle')color='#e9ae5c';
    if(item.role==='step')color=PALETTES[palette][item.color];
    const mesh=item.shape==='ball'?ball(item.size[0],[0,0,0],color,staticGroup):box(item.size,[0,0,0],color,staticGroup);
    mesh.position.copy(item.body.translation());mesh.quaternion.copy(item.body.rotation());item.mesh=mesh;
  }
  // The cream tray sits on a violet base with four small rubber feet.
  box([15.3,.2,13.3],[0,-.48,0],'#bba3d1');
  for(const x of [-6,6])for(const z of [-5,5])cylinder(.32,.25,[x,-.6,z],'#9a85ac');
  for(let i=-6;i<=6;i++)for(const z of [-5.9,5.9])box([.025,.008,.12],[i,.009,z],'#d9cedf');
  if(active==='tower'&&states.tower.delivery!=='domino'){
    if(states.tower.delivery==='launch'){
    const base=cylinder(.8,.18,[0,.09,5.5],'#87c8b8');
    torus(.64,.025,[0,.195,5.5],'#c4f0df').rotation.x=Math.PI/2;
    const support=box([.7,.7,.65],[0,.48,5.5],'#77b5a6');
    cannon=new THREE.Group();cannon.position.set(0,1.05,5.5);decorGroup.add(cannon);
    cylinder(.24,1.12,[0,.4,0],'#eab465',cannon);
    cylinder(.29,.17,[0,.96,0],'#d09b53',cannon);
    cylinder(.19,.015,[0,1.055,0],'#75586c',cannon);
    }else{
      const material=new THREE.MeshBasicMaterial({color:'#cf9a48',wireframe:true,transparent:true,opacity:.3});material.userData.unique=true;
      dropGhost=new THREE.Mesh(sphereGeometry(),material);decorGroup.add(dropGhost);
    }
    const lineMat=new THREE.LineDashedMaterial({color:'#ad8dc7',dashSize:.13,gapSize:.11,transparent:true,opacity:.65});lineMat.userData.unique=true;
    trajectory=new THREE.Line(new THREE.BufferGeometry(),lineMat);decorGroup.add(trajectory);
    aimMarker=torus(.2,.027,[aim.x,aim.y,aim.z],'#ffffff');
    updateAim();
  }
  if(active==='tower'&&states.tower.delivery==='domino'&&sim.slab){
    slabDecoration=new THREE.Group();decorGroup.add(slabDecoration);const p=states.tower,d=Math.min(.2,p.slabWidth*.13);
    for(const sign of [-1,1])for(const z of [-p.slabWidth*.25,0,p.slabWidth*.25]){const pip=ball(d,[p.slabThickness/2+.016,sign*p.slabHeight*.25,z],'#fff4df',slabDecoration);pip.scale.x=.035;}
    box([.025,.035,p.slabWidth*.84],[p.slabThickness/2+.016,0,0],'#e5d4f6',slabDecoration);
    const pos=sim.slab.body.translation();const hinge=cylinder(.11,p.slabWidth+.3,[pos.x,.1,pos.z],'#c8a474');hinge.rotation.x=Math.PI/2;
  }
  if(active==='jelly'){
    const geometry=new RoundedBoxGeometry(1,1,1,3,.12),positions=geometry.attributes.position;
    jellyWeights=[];
    for(let i=0;i<positions.count;i++){
      const g=[positions.getX(i),positions.getY(i),positions.getZ(i)].map(v=>THREE.MathUtils.clamp((v+.5)*3,0,3));
      const lo=g.map(v=>Math.min(2,Math.floor(v))),f=g.map((v,k)=>v-lo[k]),weights=[];
      for(let x=0;x<=1;x++)for(let y=0;y<=1;y++)for(let z=0;z<=1;z++)weights.push({index:(lo[0]+x)*16+(lo[1]+y)*4+lo[2]+z,w:(x?f[0]:1-f[0])*(y?f[1]:1-f[1])*(z?f[2]:1-f[2])});
      jellyWeights.push(weights);
    }
    const material=new THREE.MeshPhysicalMaterial({color:PALETTES[palette][5],roughness:.16,metalness:0,clearcoat:1,clearcoatRoughness:.06,envMap:environmentMap,envMapIntensity:.8});material.userData.unique=true;
    jellySkin=new THREE.Mesh(geometry,material);jellySkin.castShadow=true;jellySkin.receiveShadow=true;jellySkin.frustumCulled=false;decorGroup.add(jellySkin);
  }
  if(active==='marbles'){
    for(const x of [-3.6,3.6]){box([.22,6.8,.3],[x,3.4,-2.93],'#83aaa3');box([1.0,.15,2.2],[x,.08,-2.6],'#9dbeb6');}
    box([5.9,.2,.8],[0,7.0,-2.1],'#e9b16f');
    for(const x of [-2.6,0,2.6]){const ring=torus(.28,.055,[x,7.15,-2.1],'#f0be80');ring.rotation.x=Math.PI/2;}
  }
  if(active==='tumbler'){
    drumVisual=new THREE.Group();drumVisual.position.set(0,3.4,-.7);decorGroup.add(drumVisual);
    for(const z of [-1.28,1.28])torus(3.12,.1,[0,0,z],'#93b7c6',drumVisual);
    const glass=new THREE.MeshPhysicalMaterial({color:'#b8dcd7',transparent:true,opacity:.09,roughness:.1,metalness:0,side:THREE.DoubleSide,depthWrite:false});glass.userData.unique=true;
    for(const z of [-1.29,1.29]){const disk=new THREE.Mesh(new THREE.CircleGeometry(3.1,64),glass);disk.position.z=z;drumVisual.add(disk);}
    for(let i=0;i<12;i++){const a=i*Math.PI/6;const bar=box([.07,.07,2.6],[3.12*Math.cos(a),3.12*Math.sin(a),0],'#bfd6d6',drumVisual);if(i%2===0){const shelf=box([.55,.12,2.4],[2.8*Math.cos(a),2.8*Math.sin(a),0],PALETTES[palette][i/2],drumVisual);shelf.rotation.z=a;}}
    for(const x of [-2.8,2.8])box([1.2,.45,3.1],[x,.25,-.7],'#bba7ce');
    for(const x of [-2.55,2.55])for(const z of [-1.8,.4]){const wheel=cylinder(.35,.35,[x,.65,z],'#8d79a2');wheel.rotation.x=Math.PI/2;}
  }
  if(active==='magnet'){
    magnetVisual=new THREE.Group();decorGroup.add(magnetVisual);
    for(const r of [.5,1.1,1.8,2.6]){const ring=torus(r,.013,[0,.018,0],'#bca4d0',magnetVisual);ring.rotation.x=Math.PI/2;}
    cylinder(.35,.09,[0,.055,0],'#9877be',magnetVisual);box([.28,.04,.06],[0,.115,0],'#fdf5ff',magnetVisual);box([.06,.04,.28],[0,.115,0],'#fdf5ff',magnetVisual);
  }
}
function updateAim(){
  if(active!=='tower'||!trajectory)return;
  if(states.tower.delivery==='drop'){
    const p=states.tower,y=towerTop(p)+p.dropHeight+p.ball/2;
    const summary=$('#drop-summary');if(summary){const props=dropProperties(p);summary.innerHTML=`<strong>${props.mass.toLocaleString(undefined,{maximumFractionDigits:1})} kg</strong><span>${Math.round(props.density).toLocaleString()} kg/m³ · ${p.dropHeight} m above the starting tower</span>`;}
    if(!dropGhost)return;
    dropGhost.position.set(aim.x,y,aim.z);dropGhost.scale.setScalar(p.ball);
    trajectory.geometry.dispose();trajectory.geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(aim.x,y,aim.z),new THREE.Vector3(aim.x,.03,aim.z)]);trajectory.computeLineDistances();
    aimMarker.position.set(aim.x,.04,aim.z);aimMarker.rotation.set(-Math.PI/2,0,0);
    return;
  }
  if(!cannon)return;
  const direction=aim.clone().sub(cannon.position).normalize();cannon.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
  const velocity=launchVelocity(launchPoint,aim,states.tower.power,sim.world.gravity),flight=launchPoint.distanceTo(aim)/states.tower.power;
  const points=[];for(let i=0;i<=40;i++){const t=flight*i/40;points.push(new THREE.Vector3(launchPoint.x+velocity.x*t+.5*sim.world.gravity.x*t*t,launchPoint.y+velocity.y*t+.5*sim.world.gravity.y*t*t,launchPoint.z+velocity.z*t));}
  trajectory.geometry.dispose();trajectory.geometry=new THREE.BufferGeometry().setFromPoints(points);trajectory.computeLineDistances();aimMarker.position.copy(aim);aimMarker.quaternion.copy(camera.quaternion);
}
function syncInstances(){
  ballItems=[];boxItems=[];
  for(const item of sim.items){if(item.role==='jelly')continue;const arr=item.shape==='ball'?ballItems:boxItems,m=item.shape==='ball'?ballInstances:boxInstances,i=arr.length;arr.push(item);transform.position.copy(item.body.translation());transform.quaternion.copy(item.body.rotation());transform.scale.set(...item.size);transform.updateMatrix();m.setMatrixAt(i,transform.matrix);m.setColorAt(i,tmpColor.set(PALETTES[palette][item.color%6]));}
  for(const [m,arr] of [[ballInstances,ballItems],[boxInstances,boxItems]]){m.count=arr.length;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}
  for(const item of sim.fixed)if(item.mesh&&item.role==='paddle'){item.mesh.position.copy(item.body.translation());item.mesh.quaternion.copy(item.body.rotation());}
  if(drumVisual)drumVisual.quaternion.copy(sim.motors[0].body.rotation());
  if(magnetVisual){magnetVisual.position.x=sim.field.x;magnetVisual.position.z=sim.field.z;}
  if(slabDecoration&&sim.slab){slabDecoration.position.copy(sim.slab.body.translation());slabDecoration.quaternion.copy(sim.slab.body.rotation());}
  if(jellySkin){
    const nodes=sim.jellyNodes.map(item=>item.body.isValid()?item.body.translation():item.initial),pos=jellySkin.geometry.attributes.position;
    for(let i=0;i<jellyWeights.length;i++){let x=0,y=0,z=0;for(const v of jellyWeights[i]){x+=nodes[v.index].x*v.w;y+=nodes[v.index].y*v.w;z+=nodes[v.index].z*v.w;}pos.setXYZ(i,x,y,z);}
    pos.needsUpdate=true;jellySkin.geometry.computeVertexNormals();
  }
}

function format(value,unit){if(unit==='m')return `${Number(value).toFixed(2)} m`;if(unit==='kg')return `${Number(value).toFixed(1)} kg`;if(unit==='%' )return `${Math.round(value*100)}%`;return `${Math.round(value*100)/100}${unit?' '+unit:''}`;}
function rangeHTML(key,label,min,max,step,unit,value,kind){return `<div class="range-field"><div class="range-heading"><label for="${kind}-${key}">${label}</label><output for="${kind}-${key}" id="out-${kind}-${key}">${format(value,unit)}</output></div><input id="${kind}-${key}" data-kind="${kind}" data-key="${key}" data-unit="${unit}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" style="--fill:${(value-min)/(max-min)*100}%"></div>`;}
function renderControls(){
  $('#marble-finish').value=finish;
  const data=SCENES[active],isDrop=active==='tower'&&states.tower.delivery==='drop',isSlab=active==='tower'&&states.tower.delivery==='domino';let html='',sectionOpen=false;
  $('.finish-section').hidden=active==='jelly'||active==='domino'||isSlab;
  if(active==='tower')html=`<div class="tower-modes" role="group" aria-label="Tower Smash mode">${[['launch','↗ Launch'],['drop','↓ Ball drop'],['domino','▥ Domino']].map(([value,label])=>`<button data-delivery="${value}" class="${states.tower.delivery===value?'active':''}" aria-pressed="${states.tower.delivery===value}">${label}</button>`).join('')}</div>`;
  for(const f of data.fields){
    if(f.length===2){if(sectionOpen)html+='</section><hr class="section-divider">';html+=`<section class="control-section"><h3 class="section-title">${f[0]}<span class="section-symbol">${f[1]}</span></h3>`;sectionOpen=true;continue;}
    const [key,label,min,max,step,unit]=f;
    if(active==='tower'){
      if(key==='delivery')continue;
      if(key.startsWith('slab')&&!isSlab)continue;
      if(isSlab&&['ball','mass','power','dropHeight','massMode','dropMass','density'].includes(key))continue;
      if(isDrop&&['mass','power'].includes(key))continue;
      if(!isDrop&&['dropHeight','massMode','dropMass','density'].includes(key))continue;
      if(isDrop&&key==='dropMass'&&states.tower.massMode!=='weight')continue;
      if(isDrop&&key==='density'&&states.tower.massMode!=='density')continue;
    }
    if(min==='select')html+=`<div class="select-field"><label for="scene-${key}">${label}</label><select id="scene-${key}" data-kind="scene" data-key="${key}">${Object.entries(max).map(([v,n])=>`<option value="${v}" ${states[active][key]===v?'selected':''}>${n}</option>`).join('')}</select></div>`;
    else html+=rangeHTML(key,label,min,max,step,unit,states[active][key],'scene');
  }
  if(sectionOpen)html+='</section>';
  if(isDrop)html+='<div class="density-presets" role="group" aria-label="Density presets"><button data-density="100">Foam</button><button data-density="1000">Water-like</button><button data-density="2500">Glass</button><button data-density="7850">Steel</button></div><div id="drop-summary" class="drop-summary"></div>';
  html+=`<button id="action" class="action-button"><span>${isDrop?'↓':'↗'}</span>${isDrop?'Drop a ball':isSlab?'Tip the domino':data.action}</button><p class="action-note">${isDrop?'Click a spot on the tower or tray · F to drop':isSlab?'F to tip it into the tower · R to rebuild':data.note}</p>`;
  $('#scene-controls').innerHTML=html;$('#action').addEventListener('click',doAction);
  $('#stage-action').textContent=isDrop?'↓ Drop':isSlab?'▥ Tip':({tower:'↗ Launch',marbles:'+ Pour',domino:'↗ Ripple',tumbler:'+ Add',magnet:'✳ Scatter',jelly:'↓ Jelly'}[active]);
  for(const button of document.querySelectorAll('[data-delivery]'))button.addEventListener('click',()=>{const reset=states.tower.delivery==='domino'||button.dataset.delivery==='domino';states.tower.delivery=button.dataset.delivery;sim.params.delivery=button.dataset.delivery;renderControls();if(reset)rebuild(false);else buildVisuals();resetCamera();document.querySelector('[data-mode="aim"]').hidden=states.tower.delivery==='domino';setMode(states.tower.delivery==='domino'?'orbit':'aim');});
  for(const button of document.querySelectorAll('[data-density]'))button.addEventListener('click',()=>{states.tower.massMode='density';states.tower.density=Number(button.dataset.density);Object.assign(sim.params,states.tower);if(states.tower.density===2500)finish='glass';else if(states.tower.density===7850)finish='metal';else finish='resin';ballInstances.material=marbleMaterials[finish];renderControls();updateAim();});
  $('#world-controls').innerHTML=[['gravity','Gravity',0,25,.01,'m/s²'],['bounce','Bounciness',0,.95,.01,'%'],['friction','Surface grip',0,1,.01,'%'],['drag','Air resistance',0,2,.01,''],['tilt','Gravity tilt',-18,18,1,'°']].map(([k,l,a,b,c,u])=>rangeHTML(k,l,a,b,c,u,worldSettings[k],'world')).join('');
  for(const input of document.querySelectorAll('input[type=range]')){
    input.addEventListener('input',()=>{
      const k=input.dataset.key,v=Number(input.value),kind=input.dataset.kind;
      $(`#out-${kind}-${k}`).textContent=format(v,input.dataset.unit);input.style.setProperty('--fill',`${(v-input.min)/(input.max-input.min)*100}%`);
      if(kind==='world'){worldSettings[k]=v;sim.applyWorld(worldSettings);updateAim();}
      else {states[active][k]=v;sim.params[k]=v;if(active==='tower'){updateAim();if(k==='dropHeight')resetCamera();}}
    });
    input.addEventListener('change',()=>{const k=input.dataset.key;if(input.dataset.kind==='scene'){if(['width','height','depth','cube','count','gap','fill','size','slabHeight','slabWidth','slabThickness','slabMass','steps','rise','drop','nudge'].includes(k))rebuild(false);if(active==='jelly'&&['stiffness','damping'].includes(k))sim.updateJellySprings();}});
  }
  for(const select of document.querySelectorAll('#scene-controls select'))select.addEventListener('change',()=>{const k=select.dataset.key;states[active][k]=select.value;sim.params[k]=select.value;if(k==='massMode'){renderControls();updateAim();}else if(k!=='polarity')rebuild(false);});
  $('#palettes').innerHTML=Object.entries(PALETTES).map(([key,colors])=>`<button class="palette ${key===palette?'active':''}" data-palette="${key}" style="background:conic-gradient(${colors[0]} 0deg 120deg,${colors[2]} 120deg 240deg,${colors[4]} 240deg)" aria-label="${key} palette" title="${key}" aria-pressed="${key===palette}"></button>`).join('');
  for(const button of document.querySelectorAll('[data-palette]'))button.addEventListener('click',()=>{palette=button.dataset.palette;buildVisuals();renderControls();toast(`${palette[0].toUpperCase()+palette.slice(1)} colors. Lovely choice.`);});
  if(isDrop)updateAim();
}
function rebuild(notify=true){
  releaseDrag();sim.reset(active,states[active],worldSettings);accumulator=0;
  if(active==='tower'){aim.set(0,Math.min(5,states.tower.height*states.tower.cube*.45),-.6);}
  buildVisuals();syncInstances();updateStatus();if(active==='tower'&&states.tower.delivery!=='launch')resetCamera();if(notify)toast('Fresh start. Same recipe. New possibilities.');
  if(active==='tower'&&sim.items.length===550)toast('550-cube limit reached. Try smaller tower dimensions.');
}
function setScene(key){
  active=key;document.querySelectorAll('.scene-tab').forEach(b=>{b.classList.toggle('active',b.dataset.scene===key);b.setAttribute('aria-current',b.dataset.scene===key?'true':'false');});
  $('#scene-number').textContent=`EXPERIMENT ${String(names.indexOf(key)+1).padStart(2,'0')} / ${String(names.length).padStart(2,'0')}`;
  $('#scene-title').innerHTML=SCENES[key].name+'<span>.</span>';$('#scene-description').textContent=SCENES[key].desc;$('#hint-text').textContent=SCENES[key].hint;
  paused=false;updatePause();const aimable=key==='magnet'||(key==='tower'&&states.tower.delivery!=='domino');document.querySelector('[data-mode="aim"]').hidden=!aimable;setMode(aimable?'aim':key==='jelly'?'orbit':'grab');renderControls();$('.controls').scrollTop=0;rebuild(false);resetCamera();updateAim();
}
function updateStatus(){const n=sim.items.length;$('#body-count').textContent=(active==='jelly'?'1 jelly cube':`${n} ${active==='tower'?'objects':'pieces'}`)+(paused?' · paused':'');}
function updatePause(){$('#pause').textContent=paused?'▶':'Ⅱ';$('#pause').setAttribute('aria-label',paused?'Resume simulation':'Pause simulation');$('#pause').title=paused?'Resume (Space)':'Pause (Space)';if(sim)updateStatus();}
function doAction(){if(!ready)return;if(paused){paused=false;updatePause();}if(active==='jelly'){rebuild(false);return;}if(sim.items.length>=MAX_BODIES){toast('The tray is full. Rebuild for a fresh start.');return;}sim.action(aim);if(active==='tower')playNote(180,.08,'triangle',.04);if(active==='domino')toast('Here comes the ripple…');}
function setMode(value){mode=value;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===value));if(orbit)orbit.enabled=true;$('#canvas').style.cursor=value==='orbit'?'grab':value==='grab'?'grab':'crosshair';if(ready)$('#hint-text').textContent=value==='grab'?'Drag an object to lift it. Release to drop or flick.':value==='orbit'?'Drag to orbit the tray. Scroll to get a closer look.':active==='tower'&&states.tower.delivery==='drop'?'Click the tower or tray to place the drop. Let gravity do the rest.':SCENES[active].hint;}
function setRay(event){const r=$('#canvas').getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);}
function pick(){const hit=ray.intersectObjects(jellySkin?[boxInstances,ballInstances,jellySkin]:[boxInstances,ballInstances],false)[0];if(!hit)return null;if(hit.object===jellySkin){let best=null,distance=Infinity;for(const item of sim.jellyNodes){const p=item.body.translation(),d=hit.point.distanceToSquared(new THREE.Vector3(p.x,p.y,p.z));if(d<distance){best=item;distance=d;}}return {hit,item:best};}return {hit,item:(hit.object===boxInstances?boxItems:ballItems)[hit.instanceId]};}
function releaseDrag(){if(dragging){if(dragging.item.body.isValid())dragging.item.body.setGravityScale(1,true);dragging=null;}if(orbit)orbit.enabled=true;}
function bindPointer(){
  const canvas=$('#canvas');
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;pointerStart={x:e.clientX,y:e.clientY};pointerMoved=false;setRay(e);
    if(mode==='grab'){
      const selected=pick();if(selected){orbit.enabled=false;const normal=camera.getWorldDirection(new THREE.Vector3());dragging={item:selected.item,plane:new THREE.Plane().setFromNormalAndCoplanarPoint(normal,selected.hit.point),target:selected.hit.point.clone(),offset:new THREE.Vector3().copy(selected.item.body.translation()).sub(selected.hit.point)};selected.item.body.setGravityScale(0,true);canvas.setPointerCapture(e.pointerId);}
    }else if(mode==='aim')orbit.enabled=false;
  });
  canvas.addEventListener('pointermove',e=>{
    if(pointerStart&&Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>4)pointerMoved=true;
    if(dragging){setRay(e);const p=new THREE.Vector3();if(ray.ray.intersectPlane(dragging.plane,p)){dragging.target.copy(p).add(dragging.offset);dragging.target.y=Math.max(.3,Math.min(13,dragging.target.y));dragging.target.x=THREE.MathUtils.clamp(dragging.target.x,-7,7);dragging.target.z=THREE.MathUtils.clamp(dragging.target.z,-6,6);}}
  });
  canvas.addEventListener('pointerup',e=>{
    if(mode==='aim'&&pointerStart&&!pointerMoved){setRay(e);if(active==='tower'){const hit=pick();if(hit){aim.copy(hit.hit.point);updateAim();toast(states.tower.delivery==='drop'?'Drop position set. Look out below!':'Aim set. Let it fly!');}else {const drop=states.tower.delivery==='drop',plane=drop?new THREE.Plane(new THREE.Vector3(0,1,0),0):new THREE.Plane(new THREE.Vector3(0,0,1),.6),p=new THREE.Vector3();if(ray.ray.intersectPlane(plane,p)){aim.set(THREE.MathUtils.clamp(p.x,-6,6),THREE.MathUtils.clamp(p.y,.3,10),drop?THREE.MathUtils.clamp(p.z,-5,5):-.6);updateAim();}}}else if(active==='magnet'){const p=new THREE.Vector3();if(ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),p)){sim.field.x=THREE.MathUtils.clamp(p.x,-6,6);sim.field.z=THREE.MathUtils.clamp(p.z,-5,5);}}}
    releaseDrag();pointerStart=null;
  });
  canvas.addEventListener('pointercancel',()=>{releaseDrag();pointerStart=null;});
}

let audioContext,lastSound=0;
function playNote(freq,duration=.04,type='sine',volume=.015){
  if(!soundOn||!audioContext)return;const now=audioContext.currentTime;if(now-lastSound<.04)return;lastSound=now;
  const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.type=type;oscillator.frequency.setValueAtTime(freq,now);oscillator.frequency.exponentialRampToValueAtTime(freq*.65,now+duration);
  gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start(now);oscillator.stop(now+duration+.01);
}
function drainAudio(){let collisions=0;sim.queue.drainCollisionEvents((a,b,started)=>{if(started)collisions++;});if(collisions>0)playNote(active==='tower'?220:active==='domino'?380:650+Math.random()*500,.055,'sine',Math.min(.035,.008+collisions*.001));}
function persistRecipes(){try{localStorage.setItem('satisfying-lab-recipes-v1',JSON.stringify(recipes));$('#recipe-count').textContent=recipes.length;return true;}catch{toast('Browser storage is unavailable. This recipe could not be saved.');return false;}}
function renderRecipes(){
  const list=$('#recipe-list');list.replaceChildren();
  if(!recipes.length){list.innerHTML='<p class="empty-recipes">Something wonderful will go here.<br><br>Try “Save recipe” when you find a combination you love.</p>';return;}
  recipes.forEach((recipe,i)=>{
    const row=document.createElement('div');row.className='recipe';const copy=document.createElement('div');copy.className='recipe-copy';copy.textContent=recipe.name;
    const detail=document.createElement('small');detail.textContent=`${SCENES[recipe.scene].name} · ${recipe.palette} · ${recipe.finish}`;copy.append(detail);
    const load=document.createElement('button');load.textContent='Play';load.addEventListener('click',()=>{states[recipe.scene]={...recipe.params};worldSettings={...recipe.world};palette=recipe.palette;finish=recipe.finish;ballInstances.material=marbleMaterials[finish];setScene(recipe.scene);$('#recipe-dialog').close();toast('Recipe restored. Ready for another round.');});
    const remove=document.createElement('button');remove.className='delete';remove.textContent='×';remove.setAttribute('aria-label',`Delete ${recipe.name}`);remove.addEventListener('click',()=>{const old=recipes;recipes=recipes.filter((_,n)=>n!==i);if(!persistRecipes())recipes=old;renderRecipes();});row.append(copy,load,remove);list.append(row);
  });
}
function bindUI(){
  $('#scene-tabs').innerHTML=names.map(key=>`<button class="scene-tab" data-scene="${key}" title="${SCENES[key].name}"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[key]}</svg><span>${SCENES[key].short}</span></button>`).join('');
  for(const tab of document.querySelectorAll('.scene-tab'))tab.addEventListener('click',()=>setScene(tab.dataset.scene));
  for(const btn of document.querySelectorAll('[data-mode]'))btn.addEventListener('click',()=>setMode(btn.dataset.mode));
  for(const btn of document.querySelectorAll('[data-speed]'))btn.addEventListener('click',()=>{speed=Number(btn.dataset.speed);document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('active',b===btn));});
  $('#pause').addEventListener('click',()=>{paused=!paused;updatePause();});$('#reset').addEventListener('click',()=>rebuild());$('#camera-reset').addEventListener('click',resetCamera);
  $('#stage-action').addEventListener('click',doAction);
  $('#zen').addEventListener('click',()=>{document.body.classList.toggle('zen');$('#zen').setAttribute('aria-label',document.body.classList.contains('zen')?'Show controls':'Hide controls');});
  $('#physics-reset').addEventListener('click',()=>{worldSettings={...DEFAULT_WORLD};sim.applyWorld(worldSettings);renderControls();updateAim();toast('Back to a familiar kind of gravity.');});
  $('#sound').addEventListener('click',async()=>{soundOn=!soundOn;if(soundOn){audioContext??=new AudioContext();await audioContext.resume();playNote(700,.12,'sine',.02);}$('#sound').textContent=soundOn?'Sound on':'Sound off';$('#sound').setAttribute('aria-pressed',String(soundOn));});
  $('#recipe-count').textContent=recipes.length;
  $('#marble-finish').addEventListener('change',e=>{finish=e.target.value;ballInstances.material=marbleMaterials[finish];toast(finish==='glass'?'A little sparkle. A little see-through magic.':finish==='metal'?'Polished metal. Catch those reflections.':'A glossy candy coating.');});
  $('#save').addEventListener('click',()=>{if(recipes.length>=30){toast('Your recipe box is full. Delete a recipe to make room.');return;}const old=recipes;recipes=[...recipes,{name:`${SCENES[active].name} · ${recipes.length+1}`,scene:active,params:{...states[active]},world:{...worldSettings},palette,finish}];if(persistRecipes())toast('Recipe saved. Your next “what if” can wait.');else recipes=old;});
  $('#recipes').addEventListener('click',()=>{renderRecipes();$('#recipe-dialog').showModal();});$('#close-recipes').addEventListener('click',()=>$('#recipe-dialog').close());
  window.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)||$('#recipe-dialog').open)return;if(e.code==='Space'&&document.activeElement.tagName!=='BUTTON'){e.preventDefault();paused=!paused;updatePause();}if(e.code==='KeyR')rebuild();if(e.code==='KeyF')doAction();if(e.code==='KeyH')$('#zen').click();});
  document.addEventListener('visibilitychange',()=>{lastTime=0;accumulator=0;});
  window.addEventListener('blur',()=>releaseDrag());
}
function animate(time){
  requestAnimationFrame(animate);if(!ready)return;
  const elapsed=lastTime?Math.min((time-lastTime)/1000,.05):0;lastTime=time;
  if(!paused&&!document.hidden){
    accumulator+=elapsed*speed;let steps=0;
    while(accumulator>=1/60&&steps<4){
      if(dragging&&!dragging.item.body.isValid())releaseDrag();
      if(dragging){const body=dragging.item.body,p=body.translation(),delta=dragging.target.clone().sub(new THREE.Vector3(p.x,p.y,p.z)).multiplyScalar(13);delta.clampLength(0,20);body.setLinvel(delta,true);body.setAngvel({x:0,y:0,z:0},true);}
      sim.step();drainAudio();accumulator-=1/60;steps++;
    }
  }
  syncInstances();orbit.update();if(aimMarker&&states.tower.delivery!=='drop')aimMarker.quaternion.copy(camera.quaternion);renderer.render(scene,camera);
  frameCount++;if(time-fpsTime>1000){$('#fps').textContent=`${Math.round(frameCount*1000/(time-fpsTime))} fps`;fpsTime=time;frameCount=0;updateStatus();}
}
async function start(){
  try{await RAPIER.init();sim=new Simulation();setupRenderer();bindUI();bindPointer();ready=true;setScene('tower');$('#loading').classList.add('hidden');requestAnimationFrame(animate);}
  catch(error){console.error(error);$('#loading').innerHTML='<h2>The playground could not start.</h2><p>Enable hardware acceleration and WebGL, then refresh this page.</p>';}
}
start();
