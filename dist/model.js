export const MAX_BODIES = 650;
export const DEFAULT_WORLD = { gravity:9.81, bounce:0.12, friction:0.65, drag:0.08, tilt:0 };
export const PALETTES = {
  sorbet: ['#F28F83','#F4BC60','#8AC8B1','#8DAFE0','#B19BDD','#EBA5BE'],
  candy: ['#F2719A','#FFC852','#62D6CB','#9175E0','#FF9C57','#C4D877'],
  ocean: ['#4EA8B0','#81CFC7','#ACDDD4','#7C98C8','#A0B2DC','#D5B5DF'],
};
export const SCENES = {
  tower: {name:'Tower Smash',short:'Tower Smash',desc:'Build it beautifully. Knock it down gloriously.',hint:'Click the tower to aim. Then let it fly.',action:'Launch a ball',note:'Click to aim · F to fire · R to rebuild', defaults:{shape:'solid',width:6,depth:4,height:10,cube:0.55,ball:0.6,mass:8,power:23}, fields:[
    ['Your tower','▦'],['shape','Shape','select',{solid:'Solid tower',hollow:'Hollow tower',pyramid:'Pyramid',wall:'Wall'}],['width','Width',3,9,1,'cubes'],['height','Height',3,16,1,'layers'],['depth','Depth',2,6,1,'cubes'],['cube','Cube size',0.3,0.8,0.05,'m'],['Your projectile','↗'],['ball','Ball diameter',0.25,1.5,0.05,'m'],['mass','Ball weight',0.5,25,0.5,'kg'],['power','Launch speed',8,40,1,'m/s']]},
  marbles: {name:'Marble Garden',short:'Marble Garden',desc:'Little marbles. Wonderful little journeys.',hint:'Catch a marble with Grab, or stir the stream.',action:'Pour a handful',note:'A continuous cascade · F for extra marbles',defaults:{flow:5,size:0.28,paddle:0.8},fields:[['The cascade','◉'],['flow','Flow rate',0,12,1,'/s'],['size','Marble diameter',0.18,0.5,0.02,'m'],['paddle','Paddle speed',0,3,0.1,'rad/s']]},
  domino: {name:'Domino Studio',short:'Domino Studio',desc:'One little nudge. A beautiful chain reaction.',hint:'Tip the first domino, or grab any piece to start there.',action:'Start the ripple',note:'F to tip the first piece · R to set them up again',defaults:{count:90,gap:0.47,force:0.7},fields:[['Your chain reaction','▥'],['count','Domino count',30,140,5,'pieces'],['gap','Spacing',0.37,0.54,0.01,'m'],['force','First push',0.15,2,0.05,'N·s']]},
  tumbler: {name:'The Tumbler',short:'The Tumbler',desc:'Round and round. Somehow, never gets old.',hint:'Change the speed and watch the pieces find their rhythm.',action:'Add a handful',note:'A transparent rotating drum · F for more pieces',defaults:{spin:0.65,fill:100,size:0.35,kind:'mixed'},fields:[['Inside the drum','◌'],['kind','Objects','select',{mixed:'A little of both',balls:'Marbles',cubes:'Cubes'}],['spin','Drum speed',-1.8,1.8,0.05,'rad/s'],['fill','Starting pieces',20,220,10,'pieces'],['size','Piece size',0.2,0.6,0.05,'m']]},
  magnet: {name:'Magnet Playground',short:'Magnet Play',desc:'A little attraction. A whole lot of motion.',hint:'Click the tray to move the field. Switch to repel for a burst.',action:'Scatter the beads',note:'An artistic force field · Click the tray to move it',defaults:{strength:22,polarity:'attract',count:100,size:0.28},fields:[['An invisible hand','⊕'],['polarity','Field mode','select',{attract:'Attract',repel:'Repel'}],['strength','Field strength',0,70,1,''],['count','Bead count',30,220,10,'beads'],['size','Bead diameter',0.18,0.5,0.02,'m']]},
};
export function towerLayout(p) {
  const pieces=[]; const spacing=p.cube+0.012;
  for(let y=0;y<p.height;y++) {
    const w=p.shape==='pyramid'?Math.max(1,p.width-Math.floor(y/2)):p.width;
    const d=p.shape==='wall'?1:p.shape==='pyramid'?Math.max(1,p.depth-Math.floor(y/3)):p.depth;
    for(let x=0;x<w;x++) for(let z=0;z<d;z++) {
      if(p.shape==='hollow' && x>0 && x<w-1 && z>0 && z<d-1) continue;
      if(pieces.length>=550) return pieces;
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
export function seeded(seed=42){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
export function cleanSettings(scene, values={}) {
  const result={...SCENES[scene].defaults};
  for(const f of SCENES[scene].fields) {
    if(f.length<3)continue;
    const [key,,type]=f;
    if(type==='select'){if(Object.hasOwn(f[3],values[key]))result[key]=values[key];}
    else if(Number.isFinite(values[key]))result[key]=Math.min(f[3],Math.max(f[2],values[key]));
  }
  return result;
}
export function validRecipe(value) {
  if(!value || !Object.hasOwn(SCENES,value.scene) || typeof value.name!=='string')return null;
  const world={...DEFAULT_WORLD};
  for(const [key,min,max] of [['gravity',0,25],['bounce',0,0.95],['friction',0,1],['drag',0,2],['tilt',-18,18]])if(Number.isFinite(value.world?.[key]))world[key]=Math.max(min,Math.min(max,value.world[key]));
  return {scene:value.scene,name:value.name.slice(0,60),params:cleanSettings(value.scene,value.params),world,palette:Object.hasOwn(PALETTES,value.palette)?value.palette:'sorbet',finish:['glass','metal','resin'].includes(value.finish)?value.finish:'glass'};
}
