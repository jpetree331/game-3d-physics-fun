import RAPIER from './vendor/rapier.mjs';
import {DEFAULT_WORLD,MAX_BODIES,towerLayout,launchVelocity,seeded} from './model.js';
export {RAPIER};
export const quatZ=a=>({x:0,y:0,z:Math.sin(a/2),w:Math.cos(a/2)});
export const quatY=a=>({x:0,y:Math.sin(a/2),z:0,w:Math.cos(a/2)});
export class Simulation {
  constructor(){this.world=null;this.items=[];this.fixed=[];this.motors=[];this.time=0;this.serial=0;this.field={x:0,y:0.4,z:0};this.settings={...DEFAULT_WORLD};}
  reset(scene,params,settings=this.settings){
    this.world?.free();this.queue?.free();this.scene=scene;this.params={...params};this.settings={...settings};
    this.world=new RAPIER.World({x:0,y:-settings.gravity,z:0});this.world.numSolverIterations=8;
    this.queue=new RAPIER.EventQueue(true);this.items=[];this.fixed=[];this.motors=[];this.time=0;this.pour=0;this.serial=0;this.rand=seeded(42);this.field={x:0,y:0.4,z:0};
    this.addBox([15,0.4,13],[0,-0.2,0],{fixed:true,role:'floor'});
    for(const [size,pos] of [[[15,.45,.22],[0,.22,-6.5]],[[15,.45,.22],[0,.22,6.5]],[[.22,.45,13],[-7.5,.22,0]],[[.22,.45,13],[7.5,.22,0]]])this.addBox(size,pos,{fixed:true,role:'rim'});
    if(scene==='tower')this.buildTower();
    if(scene==='marbles')this.buildMarbles();
    if(scene==='domino')this.buildDomino();
    if(scene==='tumbler')this.buildTumbler();
    if(scene==='magnet')this.buildMagnet();
    this.applyWorld(settings);
  }
  add(shape,size,pos,opts={}){
    if(!opts.fixed&&!opts.kinematic&&this.items.length>=MAX_BODIES)return null;
    const desc=opts.fixed?RAPIER.RigidBodyDesc.fixed():opts.kinematic?RAPIER.RigidBodyDesc.kinematicPositionBased():RAPIER.RigidBodyDesc.dynamic();
    desc.setTranslation(...pos);if(opts.rotation)desc.setRotation(opts.rotation);
    if(!opts.fixed&&!opts.kinematic)desc.setLinearDamping(this.settings.drag).setAngularDamping(.2).setCcdEnabled(true);
    const body=this.world.createRigidBody(desc);
    const colliderDesc=shape==='ball'?RAPIER.ColliderDesc.ball(size[0]/2):RAPIER.ColliderDesc.cuboid(...size.map(x=>x/2));
    colliderDesc.setFriction(this.settings.friction).setRestitution(this.settings.bounce).setMass(opts.mass??(shape==='ball'?Math.max(.08,size[0]**3*3):size[0]*size[1]*size[2]*2));
    if(!opts.fixed&&!opts.kinematic)colliderDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    const collider=this.world.createCollider(colliderDesc,body);
    const item={id:this.serial++,body,collider,shape,size,color:opts.color??Math.floor(this.rand()*6),role:opts.role||'piece',birth:this.time,initial:{x:pos[0],y:pos[1],z:pos[2]}};
    (opts.fixed||opts.kinematic?this.fixed:this.items).push(item);return item;
  }
  addBox(size,pos,opts){return this.add('box',size,pos,opts);}
  addBall(diameter,pos,opts){return this.add('ball',[diameter,diameter,diameter],pos,opts);}
  remove(item){const i=this.items.indexOf(item);if(i>=0){this.items.splice(i,1);this.world.removeRigidBody(item.body);}}
  buildTower(){for(const p of towerLayout(this.params))this.addBox([this.params.cube,this.params.cube,this.params.cube],[p.x,p.y,p.z],{color:p.color,role:'tower'});}
  buildMarbles(){
    this.addBox([8.2,6.5,.22],[0,3.65,-2.65],{fixed:true,role:'pegboard'});
    this.addBox([8.2,6.5,.12],[0,3.65,-1.48],{fixed:true,role:'invisible'});
    for(const x of [-4.1,4.1])this.addBox([.15,6.6,1.2],[x,3.7,-2.08],{fixed:true,role:'rail'});
    for(let row=0;row<5;row++)for(let col=0;col<7;col++){
      const x=(col-3)*1.04+(row%2)*.48;
      if(row===2&&Math.abs(x)<1.5)continue;
      this.addBall(.33,[x,5.8-row*1.0,-2.1],{fixed:true,role:'peg',color:row%6});
    }
    for(let x=-3.5;x<=3.5;x+=1.4)this.addBox([.1,.7,1.1],[x,.35,-2.07],{fixed:true,role:'rail'});
    const paddle=this.addBox([1.9,.16,.64],[0,3.8,-2.06],{kinematic:true,role:'paddle',color:1});this.motors.push({item:paddle,kind:'paddle'});
    for(let i=0;i<28;i++)this.spawnMarble(1+i*.19);
  }
  spawnMarble(y=7.4){if(this.items.length>=260)this.remove(this.items[0]);return this.addBall(this.params.size,[(this.rand()-.5)*5.5,y,-2.08],{role:'marble'});}
  buildDomino(){
    let a=0;
    for(let i=0;i<this.params.count;i++){
      const r=1.1+a*.23,x=Math.cos(a)*r,z=Math.sin(a)*r;
      const tangent=Math.atan2(Math.cos(a)*r+.23*Math.sin(a),-Math.sin(a)*r+.23*Math.cos(a));
      this.addBox([.17,1.0,.55],[x,.515,z],{rotation:quatY(-tangent),color:Math.floor(i/9)%6,role:'domino'});
      a+=this.params.gap/Math.hypot(r,.23);
    }
  }
  buildTumbler(){
    const frame=this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,3.4,-.7));
    const radius=3.12,segments=40;
    for(let i=0;i<segments;i++){
      const a=i*2*Math.PI/segments;
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(.13,radius*Math.tan(Math.PI/segments)+.02,1.28).setTranslation(radius*Math.cos(a),radius*Math.sin(a),0).setRotation(quatZ(a)).setFriction(.8),frame);
    }
    for(const z of [-1.3,1.3])this.world.createCollider(RAPIER.ColliderDesc.cuboid(3.3,3.3,.06).setTranslation(0,0,z),frame);
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3;
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(.3,.1,1.15).setTranslation(2.8*Math.cos(a),2.8*Math.sin(a),0).setRotation(quatZ(a)),frame);
    }
    const motor={body:frame,kind:'drum',angle:0};this.motors.push(motor);
    for(let i=0;i<this.params.fill;i++)this.spawnTumbler(i);
  }
  spawnTumbler(i=this.items.length){
    const size=this.params.size;const col=i%8,row=Math.floor(i/8)%9,layer=Math.floor(i/72)%3;
    const pos=[(col-3.5)*.44,1.5+row*.44,-1.45+layer*.65];
    const shape=this.params.kind==='balls'||(this.params.kind==='mixed'&&i%2===0)?'ball':'box';
    return this.add(shape,[size,size,size],pos,{role:'tumble'});
  }
  buildMagnet(){for(let i=0;i<this.params.count;i++)this.addBall(this.params.size,[(this.rand()-.5)*10,.5+this.rand()*2,(this.rand()-.5)*8],{role:'bead'});}
  applyWorld(settings){
    this.settings={...settings};const t=settings.tilt*Math.PI/180;
    this.world.gravity={x:settings.gravity*Math.sin(t),y:-settings.gravity*Math.cos(t),z:0};
    this.world.forEachCollider(c=>{c.setFriction(settings.friction);c.setRestitution(settings.bounce);});
    for(const item of this.items){item.body.setLinearDamping(settings.drag);item.body.wakeUp();}
  }
  launch(target){
    const p=this.params,from={x:0,y:1.15,z:5.4};
    const item=this.addBall(p.ball,[from.x,from.y,from.z],{mass:p.mass,role:'projectile',color:1});
    if(item)item.body.setLinvel(launchVelocity(from,target,p.power,this.world.gravity),true);
    return item;
  }
  action(target){
    if(this.scene==='tower')return this.launch(target);
    if(this.scene==='marbles'){for(let i=0;i<16;i++)this.spawnMarble(7.4+Math.floor(i/4)*.35);}
    if(this.scene==='domino'){
      const first=this.items[0],second=this.items[1];if(!first||!second)return;
      const a=first.body.translation(),b=second.body.translation(),dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz);
      first.body.applyImpulseAtPoint({x:dx/l*this.params.force,y:0,z:dz/l*this.params.force},{x:a.x,y:a.y+.45,z:a.z},true);
    }
    if(this.scene==='tumbler')for(let i=0;i<12;i++)this.spawnTumbler();
    if(this.scene==='magnet')for(const item of this.items){const p=item.body.translation(),dx=p.x-this.field.x,dz=p.z-this.field.z,l=Math.hypot(dx,dz)||1;item.body.applyImpulse({x:dx/l*item.body.mass()*7,y:item.body.mass()*3,z:dz/l*item.body.mass()*7},true);}
  }
  step(dt=1/60){
    this.time+=dt;this.world.timestep=dt;
    if(this.scene==='marbles'){
      this.pour+=dt*this.params.flow;while(this.pour>=1){this.spawnMarble();this.pour--;}
      for(const motor of this.motors){motor.angle=(motor.angle||0)+dt*this.params.paddle;motor.item.body.setNextKinematicRotation(quatZ(motor.angle));}
    }
    if(this.scene==='tumbler')for(const motor of this.motors){motor.angle+=dt*this.params.spin;motor.body.setNextKinematicRotation(quatZ(motor.angle));}
    if(this.scene==='magnet')for(const item of this.items){
      const p=item.body.translation(),dx=this.field.x-p.x,dz=this.field.z-p.z,l=Math.max(.45,Math.hypot(dx,dz));
      const sign=this.params.polarity==='attract'?1:-1;
      const f=sign*this.params.strength*item.body.mass()/(1+l*.25);
      item.body.resetForces(false);item.body.addForce({x:dx/l*f,y:0,z:dz/l*f},true);
    }
    this.world.step(this.queue);
    for(const item of [...this.items]){const p=item.body.translation();if(p.y < -8||p.y>70||Math.abs(p.x)>40||Math.abs(p.z)>40)this.remove(item);}
  }
  dispose(){this.world?.free();this.queue?.free();this.world=null;this.queue=null;}
}
