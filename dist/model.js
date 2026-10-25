export const MAX_BODIES = 650;
export const TOWER_CAP = 550;
export const LARGE_TOWER_MAX = {width:40,height:60,depth:40};
export const TOWER_BUILD_KEYS = ['shape','width','height','depth','cube'];
export function sceneFields(scene,params){return SCENES[scene].fields.map(f=>scene==='tower'&&params.unlimited&&LARGE_TOWER_MAX[f[0]]?[...f.slice(0,3),LARGE_TOWER_MAX[f[0]],...f.slice(4)]:f);}
export function towerCount(p){
  let count=0;
  for(let y=0;y<p.height;y++){
    const w=p.shape==='pyramid'?Math.max(1,p.width-Math.floor(y/2)):p.width;
    const d=p.shape==='wall'?1:p.shape==='pyramid'?Math.max(1,p.depth-Math.floor(y/3)):p.depth;
    count+=p.shape==='hollow'?w*d-Math.max(0,w-2)*Math.max(0,d-2):w*d;
  }
  return count;
}
export function towerTray(p){return {width:Math.max(15,p.width*(p.cube+.012)+6),depth:Math.max(13,p.depth*(p.cube+.012)+7)};}
export function towerLaunchPoint(p){return {x:0,y:1.15,z:Math.max(5.4,p.depth*(p.cube+.012)/2+2.5)};}
export function dominoLayout(p){
  const points=[];
  if(!p.pattern||p.pattern==='spiral'){
    let a=0;
    for(let i=0;i<p.count;i++){
      const r=1.1+a*.23,tangent=Math.atan2(Math.cos(a)*r+.23*Math.sin(a),-Math.sin(a)*r+.23*Math.cos(a));
      points.push({x:Math.cos(a)*r,z:Math.sin(a)*r,angle:-tangent});a+=p.gap/Math.hypot(r,.23);
    }
    return points;
  }
  if(p.pattern==='circle'){
    const r=p.gap/(2*Math.sin(Math.PI/p.count));
    return Array.from({length:p.count},(_,i)=>{const a=i*2*Math.PI/p.count;return {x:r*Math.cos(a),z:r*Math.sin(a),angle:-a-Math.PI/2};});
  }
  // Resample a smooth path at equal arc distances; count and spacing stay meaningful.
  const path=[];
  if(p.pattern==='wave'){
    for(let i=0;i<=800;i++){const t=i/800;path.push({x:12*t-6,z:1.5*Math.sin(t*Math.PI*4)});}
  }else{
    const rows=Math.max(2,Math.round(p.count/30)),r=1.2;
    for(let row=0;row<rows;row++){
      const sign=row%2===0?1:-1,z=(row-(rows-1)/2)*r*2;
      for(let j=0;j<=80;j++)path.push({x:sign*(-4+j*.1),z});
      if(row<rows-1)for(let j=1;j<=60;j++){const a=-Math.PI/2+j*Math.PI/60;path.push({x:sign*(4+r*Math.cos(a)),z:z+r+r*Math.sin(a)});}
    }
  }
  const lengths=[0];for(let i=1;i<path.length;i++)lengths.push(lengths[i-1]+Math.hypot(path[i].x-path[i-1].x,path[i].z-path[i-1].z));
  const total=lengths.at(-1),scale=(p.count-1)*p.gap/total;let j=1;
  for(let i=0;i<p.count;i++){
    const d=total*i/(p.count-1);while(j<path.length-1&&lengths[j]<d)j++;
    const a=path[j-1],b=path[j],t=(d-lengths[j-1])/(lengths[j]-lengths[j-1]);
    points.push({x:(a.x+(b.x-a.x)*t)*scale,z:(a.z+(b.z-a.z)*t)*scale,angle:-Math.atan2(b.z-a.z,b.x-a.x)});
  }
  return points;
}
export const DEFAULT_WORLD = { gravity:9.81, bounce:0.12, friction:0.65, drag:0.08, tilt:0 };
export const PALETTES = {
  sorbet: ['#F28F83','#F4BC60','#8AC8B1','#8DAFE0','#B19BDD','#EBA5BE'],
  candy: ['#F2719A','#FFC852','#62D6CB','#9175E0','#FF9C57','#C4D877'],
  ocean: ['#4EA8B0','#81CFC7','#ACDDD4','#7C98C8','#A0B2DC','#D5B5DF'],
};
export const SCENES = {
  tower: {name:'Tower Smash',short:'Tower Smash',desc:'Build it beautifully. Knock it down gloriously.',hint:'Click the tower to aim. Then let it fly.',action:'Launch a ball',note:'Click to aim · F to fire · R to rebuild', defaults:{unlimited:false,delivery:'launch',shape:'solid',width:6,depth:4,height:10,cube:0.55,ball:0.6,mass:8,power:23,massMode:'weight',dropMass:25,density:1000,dropHeight:4,slabHeight:5,slabWidth:2.5,slabThickness:.4,slabMass:40}, fields:[
    ['Your tower','▦'],['shape','Shape','select',{solid:'Solid tower',hollow:'Hollow tower',pyramid:'Pyramid',wall:'Wall'}],['width','Tower width',3,9,1,'cubes'],['height','Tower height',3,16,1,'layers'],['depth','Tower depth',2,6,1,'cubes'],['cube','Cube size',0.3,0.8,0.05,'m'],['Your projectile','↗'],['delivery','Mode','select',{launch:'Launch →',drop:'Drop from above ↓',domino:'Falling domino'}],['ball','Ball diameter',0.25,1.5,0.05,'m'],['mass','Ball weight',0.5,25,0.5,'kg'],['power','Launch speed',8,40,1,'m/s'],['dropHeight','Height above tower',0.5,10,0.5,'m'],['massMode','Set weight using','select',{weight:'Weight directly',density:'Material density'}],['dropMass','Ball weight',0.5,1500,0.5,'kg'],['density','Material density',50,8000,50,'kg/m³'],['slabHeight','Domino height',1.5,10,.25,'m'],['slabWidth','Domino width',.5,5,.25,'m'],['slabThickness','Domino thickness',.2,1,.05,'m'],['slabMass','Domino weight',1,1000,1,'kg']]},
  marbles: {name:'Marble Garden',short:'Marble Garden',desc:'Little marbles. Wonderful little journeys.',hint:'Catch a marble with Grab, or stir the stream.',action:'Pour a handful',note:'A continuous cascade · F for extra marbles',defaults:{flow:5,size:0.28,paddle:0.8},fields:[['The cascade','◉'],['flow','Flow rate',0,12,1,'/s'],['size','Marble diameter',0.18,0.5,0.02,'m'],['paddle','Paddle speed',0,3,0.1,'rad/s']]},
  domino: {name:'Domino Studio',short:'Domino Studio',desc:'One little nudge. A beautiful chain reaction.',hint:'Tip the first domino, or grab any piece to start there.',action:'Start the ripple',note:'F to tip the first piece · R to set them up again',defaults:{pattern:'spiral',count:90,gap:0.47,force:0.7},fields:[['Your chain reaction','▥'],['pattern','Pattern','select',{spiral:'Spiral',circle:'Circle',wave:'Wave',serpentine:'Serpentine'}],['count','Domino count',30,140,5,'pieces'],['gap','Spacing',0.37,0.54,0.01,'m'],['force','First push',0.15,2,0.05,'N·s']]},
  tumbler: {name:'The Tumbler',short:'The Tumbler',desc:'Round and round. Somehow, never gets old.',hint:'Change the speed and watch the pieces find their rhythm.',action:'Add a handful',note:'A transparent rotating drum · F for more pieces',defaults:{spin:0.65,fill:100,size:0.35,kind:'mixed'},fields:[['Inside the drum','◌'],['kind','Objects','select',{mixed:'A little of both',balls:'Marbles',cubes:'Cubes'}],['spin','Drum speed',-1.8,1.8,0.05,'rad/s'],['fill','Starting pieces',20,220,10,'pieces'],['size','Piece size',0.2,0.6,0.05,'m']]},
  magnet: {name:'Magnet Playground',short:'Magnet Play',desc:'A little attraction. A whole lot of motion.',hint:'Click the tray to move the field. Switch to repel for a burst.',action:'Scatter the beads',note:'An artistic force field · Click the tray to move it',defaults:{strength:22,polarity:'attract',count:100,size:0.28},fields:[['An invisible hand','⊕'],['polarity','Field mode','select',{attract:'Attract',repel:'Repel'}],['strength','Field strength',0,70,1,''],['count','Bead count',30,220,10,'beads'],['size','Bead diameter',0.18,0.5,0.02,'m']]},
  jelly: {name:'Jelly Stairs',short:'Jelly Stairs',desc:'A soft little cube. A very wobbly way down.',hint:'Turn stiffness down for jelly, or up for a springy cube.',action:'Drop the jelly',note:'Stiffness changes live · F to drop a fresh cube',defaults:{size:1.4,stiffness:.25,damping:.35,drop:1.2,nudge:2.2,steps:7,rise:.6},fields:[['Your wobbly little cube','▧'],['size','Cube size',.8,2,.1,'m'],['stiffness','Jelly stiffness',0,1,.05,'%'],['damping','Internal damping',0,1,.05,'%'],['drop','Drop above stairs',.3,4,.1,'m'],['nudge','Forward nudge',0,5,.1,'m/s'],['The staircase','▤'],['steps','Step count',4,8,1,'steps'],['rise','Step height',.3,.8,.05,'m']]},
};
export function towerLayout(p) {
  const pieces=[]; const spacing=p.cube+0.012;
  for(let y=0;y<p.height;y++) {
    const w=p.shape==='pyramid'?Math.max(1,p.width-Math.floor(y/2)):p.width;
    const d=p.shape==='wall'?1:p.shape==='pyramid'?Math.max(1,p.depth-Math.floor(y/3)):p.depth;
    for(let x=0;x<w;x++) for(let z=0;z<d;z++) {
      if(p.shape==='hollow' && x>0 && x<w-1 && z>0 && z<d-1) continue;
      if(!p.unlimited&&pieces.length>=TOWER_CAP) return pieces;
      pieces.push({x:(x-(w-1)/2)*spacing,y:p.cube/2+y*spacing+0.025,z:(z-(d-1)/2)*spacing-0.6,color:y%6});
    }
  }
  return pieces;
}
export function launchVelocity(from,to,speed,gravity) {
  const dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z;
  const time=Math.max(0.01,Math.hypot(dx,dy,dz)/speed);
  return {x:dx/time-gravity.x*time/2,y:dy/time-gravity.y*time/2,z:dz/time-gravity.z*time/2};
}
export function dropProperties(params){
  const volume=Math.PI*params.ball**3/6;
  const mass=params.massMode==='density'?params.density*volume:params.dropMass;
  return {volume,mass,density:mass/volume};
}
export function towerTop(params){return params.height*(params.cube+.012)+.025;}
export function seeded(seed=42){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
export function cleanSettings(scene, values={}) {
  const result={...SCENES[scene].defaults};
  if(scene==='tower')result.unlimited=values.unlimited===true;
  for(const f of sceneFields(scene,result)) {
    if(f.length<3)continue;
    const [key,,type]=f;
    if(type==='select'){if(Object.hasOwn(f[3],values[key]))result[key]=values[key];}
    else if(Number.isFinite(values[key])){const v=Math.min(f[3],Math.max(f[2],values[key]));result[key]=f[4]===1?Math.round(v):v;}
  }
  return result;
}
export function validRecipe(value) {
  if(!value || !Object.hasOwn(SCENES,value.scene) || typeof value.name!=='string')return null;
  const world={...DEFAULT_WORLD};
  for(const [key,min,max] of [['gravity',0,25],['bounce',0,0.95],['friction',0,1],['drag',0,2],['tilt',-18,18]])if(Number.isFinite(value.world?.[key]))world[key]=Math.max(min,Math.min(max,value.world[key]));
  return {scene:value.scene,name:value.name.slice(0,60),params:cleanSettings(value.scene,value.params),world,palette:Object.hasOwn(PALETTES,value.palette)?value.palette:'sorbet',finish:['glass','metal','ceramic','resin'].includes(value.finish)?value.finish:'glass'};
}
