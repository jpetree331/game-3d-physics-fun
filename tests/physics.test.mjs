import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,RAPIER} from '../dist/simulation.js';
import {SCENES,DEFAULT_WORLD,towerLayout,validRecipe,MAX_BODIES,dropProperties,towerTop,towerCount,cleanSettings,LARGE_TOWER_MAX} from '../dist/model.js';
await RAPIER.init();
function create(scene='tower',params={}){const sim=new Simulation();sim.reset(scene,{...SCENES[scene].defaults,...params});return sim;}
function run(sim,frames){for(let i=0;i<frames;i++)sim.step();}
function finite(sim){for(const p of sim.items.map(i=>i.body.translation()))assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z));}

test('uncapped counts match every layout and do not truncate maximum dimensions',()=>{
  for(const shape of ['solid','hollow','pyramid','wall']){
    const p={...SCENES.tower.defaults,...LARGE_TOWER_MAX,shape,unlimited:true};
    assert.equal(towerLayout(p).length,towerCount(p));
    assert.equal(towerLayout({...p,unlimited:false}).length,550);
    if(shape==='solid')assert.equal(towerCount(p),96000);
  }
});
test('uncapped recipes restore dimensions; disabling the toggle restores bounded dimensions',()=>{
  const recipe=validRecipe({scene:'tower',name:'Big',params:{unlimited:true,width:40,depth:30,height:60}});
  assert.equal(recipe.params.width,40);assert.equal(recipe.params.height,60);assert.equal(recipe.params.depth,30);
  const capped=cleanSettings('tower',{...recipe.params,unlimited:false});
  assert.equal(capped.width,9);assert.equal(capped.height,16);assert.equal(capped.depth,6);
  assert.equal(cleanSettings('tower',{unlimited:'true',width:40}).width,9);
  assert.equal(cleanSettings('tower',{unlimited:true,width:Infinity}).width,6);
  assert.equal(cleanSettings('tower',{unlimited:true,width:11.5}).width,12);
});
test('a tower beyond both old caps has physics for every cube and can still fire and drop',()=>{
  const sim=create('tower',{unlimited:true,width:12,depth:10,height:10});
  try{
    assert.equal(sim.items.length,1200);assert.equal(sim.bodyLimit,Infinity);
    const shot=sim.launch({x:0,y:2,z:-.6});assert.ok(shot);assert.ok(shot.initial.z>sim.params.depth*(sim.params.cube+.012)/2);
    assert.ok(sim.drop({x:0,z:-.6}));run(sim,180);finite(sim);
    assert.ok(sim.items.filter(i=>i.role==='tower'&&Math.hypot(i.body.translation().x-i.initial.x,i.body.translation().z-i.initial.z)>.1).length>0);
    sim.reset('tower',SCENES.tower.defaults);assert.equal(sim.items.length,240);assert.equal(sim.bodyLimit,650);
  }finally{sim.dispose();}
});
test('tower holds its shape before impact, then responds to a ball',()=>{
  const sim=create();try{run(sim,180);const moved=sim.items.filter(i=>Math.hypot(i.body.translation().x-i.initial.x,i.body.translation().z-i.initial.z)>.15);assert.equal(moved.length,0);
  sim.launch({x:0,y:2.5,z:-.6});run(sim,180);const displaced=sim.items.filter(i=>i.role==='tower'&&Math.hypot(i.body.translation().x-i.initial.x,i.body.translation().z-i.initial.z)>.5);assert.ok(displaced.length>25,`Only ${displaced.length} blocks displaced`);finite(sim);
  }finally{sim.dispose();}
});
test('projectile mass is independent of diameter',()=>{
  const sim=create();try{sim.params.ball=.3;sim.params.mass=12;const a=sim.launch({x:0,y:2,z:0});sim.params.ball=1.4;const b=sim.launch({x:0,y:2,z:0});assert.ok(Math.abs(a.body.mass()-12)<.001);assert.ok(Math.abs(b.body.mass()-12)<.001);assert.notEqual(a.collider.radius(),b.collider.radius());}finally{sim.dispose();}
});
test('each tower shape fits within the cap and rebuild restores its layout',()=>{
  for(const shape of ['solid','hollow','pyramid','wall']){const sim=create('tower',{shape,width:9,height:16,depth:6});try{assert.ok(sim.items.length<=550);const initial=sim.items.map(i=>i.body.translation());sim.action({x:0,y:3,z:0});run(sim,30);sim.reset('tower',sim.params);assert.deepEqual(sim.items.map(i=>i.body.translation()),initial);}finally{sim.dispose();}}
  assert.equal(towerLayout(SCENES.tower.defaults).length,240);
});
test('world sliders immediately update gravity, grip, and bounce',()=>{
  const sim=create();try{sim.applyWorld({...DEFAULT_WORLD,gravity:0,bounce:.8,friction:.1,drag:.7});assert.ok(Math.abs(sim.world.gravity.y)===0);assert.ok(Math.abs(sim.items[0].collider.restitution()-.8)<.0001);assert.ok(Math.abs(sim.items[0].collider.friction()-.1)<.0001);sim.applyWorld({...DEFAULT_WORLD,tilt:15});assert.ok(sim.world.gravity.x>0);}finally{sim.dispose();}
});
test('domino ripple topples most of the chain',()=>{
  for(const pattern of ['spiral','circle','wave','serpentine']){
    const sim=create('domino',{pattern});try{run(sim,60);const upright=sim.items.filter(i=>i.body.translation().y>.4).length;assert.equal(upright,sim.items.length,pattern);sim.action();run(sim,1200);const fallen=sim.items.filter(i=>i.body.translation().y<.35).length;assert.ok(fallen>sim.items.length*.8,`${pattern}: ${fallen}/${sim.items.length} fell`);finite(sim);}finally{sim.dispose();}
  }
});
test('all scenes survive repeated stepping and their primary actions',()=>{
  for(const scene of ['marbles','tumbler','magnet']){const sim=create(scene);try{run(sim,180);sim.action();run(sim,180);assert.ok(sim.items.length>0);assert.ok(sim.items.length<=MAX_BODIES);finite(sim);if(scene==='tumbler')assert.ok(Math.abs(sim.motors[0].body.rotation().z)>.1);}finally{sim.dispose();}}
});
test('marble recycling is bounded during continuous flow',()=>{
  const sim=create('marbles',{flow:12});try{run(sim,1400);assert.ok(sim.items.length<=260);finite(sim);}finally{sim.dispose();}
});
test('recipe input is validated and clamped before loading',()=>{
  assert.equal(validRecipe({scene:'unknown',name:'bad'}),null);assert.equal(validRecipe({scene:'tower',name:null}),null);
  const p=validRecipe({scene:'tower',name:'test',params:{width:1000,cube:-1,shape:'bad'},world:{gravity:-100},palette:'missing'});assert.equal(p.params.width,9);assert.equal(p.params.cube,.3);assert.equal(p.params.shape,'solid');assert.equal(p.world.gravity,0);assert.equal(p.palette,'sorbet');
  assert.equal(p.finish,'glass');assert.equal(validRecipe({scene:'marbles',name:'Metal',finish:'metal'}).finish,'metal');
});
test('density and diameter determine dropped mass while direct-weight mode stays independent',()=>{
  const p={...SCENES.tower.defaults,massMode:'density',density:1000,ball:.5};
  const a=dropProperties(p),b=dropProperties({...p,ball:1});assert.ok(Math.abs(b.mass/a.mass-8)<.00001);
  assert.equal(dropProperties({...p,massMode:'weight',dropMass:50}).mass,50);
  const sim=create('tower',{...p,delivery:'drop',dropHeight:6});try{const ball=sim.drop({x:0,z:-.6});assert.ok(Math.abs(ball.body.mass()-a.mass)<.001);assert.ok(Math.abs(ball.body.translation().y-(towerTop(sim.params)+6+.25))<.00001);assert.equal(ball.body.linvel().y,0);run(sim,360);assert.ok(sim.items.filter(i=>i.role==='tower'&&Math.abs(i.body.translation().x-i.initial.x)>.3).length>20);finite(sim);}finally{sim.dispose();}
});
test('falling domino is initially upright and tips into the tower on command',()=>{
  const sim=create('tower',{delivery:'domino'});try{run(sim,120);assert.ok(Math.abs(sim.slab.body.rotation().z)<.01);assert.ok(Math.abs(sim.slab.body.mass()-40)<.001);sim.action();run(sim,360);assert.ok(Math.abs(sim.slab.body.rotation().z)>.1);assert.ok(sim.items.filter(i=>i.role==='tower'&&Math.abs(i.body.translation().x-i.initial.x)>.3).length>15);finite(sim);}finally{sim.dispose();}
});
test('jelly deforms, travels down stairs, and stays finite at both stiffness extremes',()=>{
  const strains=[];
  for(const stiffness of [0,1]){const sim=create('jelly',{stiffness});try{assert.equal(sim.jellyNodes.length,64);assert.ok(sim.jellyJoints.length>200);let maxStrain=0;for(let step=0;step<240;step++){
    sim.step();for(const joint of sim.jellyJoints){const a=joint.body1().translation(),b=joint.body2().translation();const aa=sim.jellyNodes.find(i=>i.body.handle===joint.body1().handle).initial,bb=sim.jellyNodes.find(i=>i.body.handle===joint.body2().handle).initial;const rest=Math.hypot(aa.x-bb.x,aa.y-bb.y,aa.z-bb.z);maxStrain=Math.max(maxStrain,Math.abs(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)/rest-1));}}
    finite(sim);const center=sim.jellyNodes.reduce((s,i)=>s+i.body.translation().x,0)/64;assert.ok(center>-1,`Cube did not travel down stairs: ${center}`);strains.push(maxStrain);
    const positions=sim.items.map(i=>i.body.translation());sim.params.stiffness=.5;sim.updateJellySprings();assert.deepEqual(sim.items.map(i=>i.body.translation()),positions);run(sim,60);finite(sim);
  }finally{sim.dispose();}}
  assert.ok(strains[0]>strains[1]*2,`Soft/firm deformation: ${strains}`);
});
