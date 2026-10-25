import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,RAPIER} from '../dist/simulation.js';
import {SCENES,DEFAULT_WORLD,towerLayout,validRecipe,MAX_BODIES} from '../dist/model.js';
await RAPIER.init();
function create(scene='tower',params={}){const sim=new Simulation();sim.reset(scene,{...SCENES[scene].defaults,...params});return sim;}
function run(sim,frames){for(let i=0;i<frames;i++)sim.step();}
function finite(sim){for(const p of sim.items.map(i=>i.body.translation()))assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z));}
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
  const sim=create('domino');try{run(sim,60);const upright=sim.items.filter(i=>i.body.translation().y>.4).length;assert.equal(upright,sim.items.length);sim.action();run(sim,1200);const fallen=sim.items.filter(i=>i.body.translation().y<.35).length;assert.ok(fallen>sim.items.length*.8,`${fallen}/${sim.items.length} fell`);finite(sim);}finally{sim.dispose();}
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
