import RAPIER from './vendor/rapier.mjs';
import {DEFAULT_WORLD,MAX_BODIES,towerLayout,launchVelocity,seeded,dropProperties,towerTop,towerTray,towerLaunchPoint,dominoLayout} from './model.js';
export {RAPIER};
export const quatZ=a=>({x:0,y:0,z:Math.sin(a/2),w:Math.cos(a/2)});
export const quatY=a=>({x:0,y:Math.sin(a/2),z:0,w:Math.cos(a/2)});
export class Simulation {
  constructor(){this.world=null;this.items=[];this.fixed=[];this.motors=[];this.time=0;this.serial=0;this.field={x:0,y:0.4,z:0};this.settings={...DEFAULT_WORLD};}
  reset(scene,params,settings=this.settings){
    this.world?.free();this.queue?.free();this.scene=scene;this.params={...params};this.settings={...settings};this.grabbed=null;
    this.world=new RAPIER.World({x:0,y:-settings.gravity,z:0});this.world.numSolverIterations=8;
    this.queue=new RAPIER.EventQueue(true);this.items=[];this.fixed=[];this.motors=[];this.colliderItems=new Map();this.jellyJoints=[];this.jellyNodes=[];this.slab=null;this.time=0;this.pour=0;this.serial=0;this.rand=seeded(42);this.field={x:0,y:0.4,z:0};
    this.bodyLimit=scene==='tower'&&params.unlimited?Infinity:MAX_BODIES;
    this.tray=scene==='tower'?towerTray(params):{width:15,depth:13};
    this.dominoPoints=scene==='domino'?dominoLayout(params):[];
    if(scene==='domino')this.tray={width:Math.max(15,...this.dominoPoints.map(p=>Math.abs(p.x)*2+3)),depth:Math.max(13,...this.dominoPoints.map(p=>Math.abs(p.z)*2+3))};
    const {width:w,depth:d}=this.tray;
    if(scene==='tower'){
      const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
      const collider=this.world.createCollider(new RAPIER.ColliderDesc(new RAPIER.HalfSpace({x:0,y:1,z:0})),body);
      const floor={body,collider,shape:'plane',role:'invisible',mass:0};this.fixed.push(floor);this.colliderItems.set(collider.handle,floor);
    }else{
      this.addBox([w,0.4,d],[0,-0.2,0],{fixed:true,role:'floor'});
      for(const [size,pos] of [[[w,.45,.22],[0,.22,-d/2]],[[w,.45,.22],[0,.22,d/2]],[[.22,.45,d],[-w/2,.22,0]],[[.22,.45,d],[w/2,.22,0]]])this.addBox(size,pos,{fixed:true,role:'rim'});
    }
    if(scene==='tower')this.buildTower();
    if(scene==='marbles')this.buildMarbles();
    if(scene==='domino')this.buildDomino();
    if(scene==='tumbler')this.buildTumbler();
    if(scene==='magnet')this.buildMagnet();
    if(scene==='jelly')this.buildJelly();
    this.applyWorld(settings);
  }
  add(shape,size,pos,opts={}){
    if(!opts.fixed&&!opts.kinematic&&this.items.length>=this.bodyLimit)return null;
    const desc=opts.fixed?RAPIER.RigidBodyDesc.fixed():opts.kinematic?RAPIER.RigidBodyDesc.kinematicPositionBased():RAPIER.RigidBodyDesc.dynamic();
    desc.setTranslation(...pos);if(opts.rotation)desc.setRotation(opts.rotation);
    if(!opts.fixed&&!opts.kinematic)desc.setLinearDamping(this.settings.drag).setAngularDamping(.2).setCcdEnabled(true);
    const body=this.world.createRigidBody(desc);
    const colliderDesc=shape==='ball'?RAPIER.ColliderDesc.ball(size[0]/2):RAPIER.ColliderDesc.cuboid(...size.map(x=>x/2));
    colliderDesc.setFriction(this.settings.friction).setRestitution(this.settings.bounce).setMass(opts.mass??(shape==='ball'?Math.max(.08,size[0]**3*3):size[0]*size[1]*size[2]*2));
    if(!opts.fixed&&!opts.kinematic)colliderDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    const collider=this.world.createCollider(colliderDesc,body);
    const item={id:this.serial++,body,collider,shape,size,color:opts.color??Math.floor(this.rand()*6),role:opts.role||'piece',birth:this.time,initial:{x:pos[0],y:pos[1],z:pos[2]}};
    item.mass=body.mass();this.colliderItems.set(collider.handle,item);
    (opts.fixed||opts.kinematic?this.fixed:this.items).push(item);return item;
  }
  addBox(size,pos,opts){return this.add('box',size,pos,opts);}
  addBall(diameter,pos,opts){return this.add('ball',[diameter,diameter,diameter],pos,opts);}
  remove(item){const i=this.items.indexOf(item);if(i>=0){if(this.grabbed===item)this.endGrab();this.colliderItems.delete(item.collider.handle);this.items.splice(i,1);this.world.removeRigidBody(item.body);}}
  beginGrab(item){
    this.endGrab();if(!item?.body.isValid()||!item.body.isDynamic())return false;
    this.grabbed=item;item.body.resetForces(true);item.body.setGravityScale(0,true);return true;
  }
  dragTo(target){
    const body=this.grabbed?.body;if(!body?.isValid())return;
    const p=body.translation(),v={x:(target.x-p.x)*18,y:(target.y-p.y)*18,z:(target.z-p.z)*18},scale=Math.min(1,25/Math.max(.001,Math.hypot(v.x,v.y,v.z)));
    body.setLinvel({x:v.x*scale,y:v.y*scale,z:v.z*scale},true);body.setAngvel({x:0,y:0,z:0},true);
  }
  endGrab(){if(this.grabbed?.body.isValid())this.grabbed.body.setGravityScale(1,true);this.grabbed=null;}
  drainImpacts(max=6){
    const impacts=[];
    this.queue.drainCollisionEvents((a,b,started)=>{
      if(!started||!this.captureImpacts)return;
      const one=this.colliderItems.get(a),two=this.colliderItems.get(b);if(!one&&!two)return;
      const av=one?.impactVelocity??{x:0,y:0,z:0},bv=two?.impactVelocity??{x:0,y:0,z:0};
      const speed=Math.hypot(av.x-bv.x,av.y-bv.y,av.z-bv.z);if(speed<.35)return;
      const dynamic=[one,two].filter(i=>i?.body.isDynamic());if(!dynamic.length)return;
      const item=dynamic.find(i=>i.shape==='ball')??dynamic[0],mass=dynamic.length===2?dynamic[0].mass*dynamic[1].mass/(dynamic[0].mass+dynamic[1].mass):item.mass;
      const energy=.5*mass*speed*speed;if(energy<.002)return;
      const impact={item,energy,speed,position:item.body.translation()};
      if(impacts.length<max)impacts.push(impact);else{let weakest=0;for(let i=1;i<impacts.length;i++)if(impacts[i].energy<impacts[weakest].energy)weakest=i;if(energy>impacts[weakest].energy)impacts[weakest]=impact;}
    });
    return impacts;
  }
  buildTower(){
    for(const p of towerLayout(this.params))this.addBox([this.params.cube,this.params.cube,this.params.cube],[p.x,p.y,p.z],{color:p.color,role:'tower'});
    if(this.params.delivery==='domino'){
      const p=this.params,x=-(p.width*(p.cube+.012))/2-p.slabThickness/2-.65;
      this.slab=this.addBox([p.slabThickness,p.slabHeight,p.slabWidth],[x,p.slabHeight/2+.04,-.6],{mass:p.slabMass,color:4,role:'slab'});
      const pivot=this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x,.04,-.6));
      this.world.createImpulseJoint(RAPIER.JointData.revolute({x:0,y:0,z:0},{x:0,y:-p.slabHeight/2,z:0},{x:0,y:0,z:1}),pivot,this.slab.body,true);
    }
  }
  buildJelly(){
    const p=this.params;
    for(let i=0;i<p.steps;i++){const h=(p.steps-i)*p.rise;this.addBox([1.12,h,3.8],[-4.5+i*1.1,h/2,-.3],{fixed:true,role:'step',color:i%6});}
    this.addBox([.35,2.4,5.5],[7.1,1.2,-.3],{fixed:true,role:'jellybumper'});
    const n=4,spacing=p.size/(n-1),center={x:-4.3,y:p.steps*p.rise+p.drop+p.size/2,z:-.3};
    for(let x=0;x<n;x++)for(let y=0;y<n;y++)for(let z=0;z<n;z++){
      const item=this.addBall(.11, [center.x+(x-1.5)*spacing,center.y+(y-1.5)*spacing,center.z+(z-1.5)*spacing],{mass:8/64,role:'jelly',color:0});
      item.grid=[x,y,z];item.collider.setCollisionGroups(0x00020001);item.body.setEnabledRotations(false,false,false,true);item.body.setLinvel({x:p.nudge,y:0,z:0},true);this.jellyNodes.push(item);
    }
    this.updateJellySprings();
  }
  updateJellySprings(){
    for(const joint of this.jellyJoints)if(joint.isValid())this.world.removeImpulseJoint(joint,true);
    this.jellyJoints=[];const p=this.params,spacing=p.size/3,stiffness=25+Math.pow(p.stiffness,2)*5000,damping=.05+p.damping*2.5;
    for(let i=0;i<this.jellyNodes.length;i++)for(let j=i+1;j<this.jellyNodes.length;j++){
      const a=this.jellyNodes[i],b=this.jellyNodes[j],diff=a.grid.map((v,k)=>Math.abs(v-b.grid[k]));
      // Neighbor, shear, and longer cross-body springs resist collapse and twisting.
      if(Math.max(...diff)>1&&!(diff[0]===diff[1]&&diff[1]===diff[2]))continue;
      const rest=Math.hypot(...diff)*spacing;
      const joint=this.world.createImpulseJoint(RAPIER.JointData.spring(rest,stiffness,damping,{x:0,y:0,z:0},{x:0,y:0,z:0}),a.body,b.body,true);this.jellyJoints.push(joint);
    }
  }
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
    this.dominoPoints.forEach((p,i)=>this.addBox([.17,1.0,.55],[p.x,.515,p.z],{rotation:quatY(p.angle),color:Math.floor(i/9)%6,role:'domino'}));
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
    const p=this.params,from=towerLaunchPoint(p);
    const item=this.addBall(p.ball,[from.x,from.y,from.z],{mass:p.mass,role:'projectile',color:1});
    if(item){item.soundMaterial='cannon';item.body.setLinvel(launchVelocity(from,target,p.power,this.world.gravity),true);}
    return item;
  }
  drop(target){
    const p=this.params,properties=dropProperties(p);
    return this.addBall(p.ball,[target.x,towerTop(p)+p.dropHeight+p.ball/2,target.z],{mass:properties.mass,role:'projectile',color:1});
  }
  action(target){
    if(this.scene==='tower'){
      if(this.params.delivery==='domino'){if(this.slab)this.slab.body.applyTorqueImpulse({x:0,y:0,z:-this.params.slabMass*this.params.slabHeight*.4},true);return;}
      return this.params.delivery==='drop'?this.drop(target):this.launch(target);
    }
    if(this.scene==='jelly'){this.reset('jelly',this.params,this.settings);return;}
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
      if(item===this.grabbed)continue;
      const p=item.body.translation(),dx=this.field.x-p.x,dz=this.field.z-p.z,l=Math.max(.45,Math.hypot(dx,dz));
      const sign=this.params.polarity==='attract'?1:-1;
      const f=sign*this.params.strength*item.body.mass()/(1+l*.25);
      item.body.resetForces(false);item.body.addForce({x:dx/l*f,y:0,z:dz/l*f},true);
    }
    if(this.captureImpacts)for(const item of this.items)item.impactVelocity=item.body.linvel();
    this.world.step(this.queue);
    if(this.scene!=='tower')for(const item of [...this.items]){const p=item.body.translation();if(p.y < -8||p.y>70||Math.abs(p.x)>40||Math.abs(p.z)>40)this.remove(item);}
  }
  dispose(){this.world?.free();this.queue?.free();this.world=null;this.queue=null;}
}
