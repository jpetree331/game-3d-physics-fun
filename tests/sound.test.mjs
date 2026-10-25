import test from 'node:test';
import assert from 'node:assert/strict';
import {SOUND_PROFILES,synthesizeImpact,impactVoice,CollisionAudio} from '../dist/sound.js';

test('material instruments are finite, bounded, distinct, and fade to silence',()=>{
  const signals={};
  const rms=a=>Math.sqrt(a.reduce((sum,x)=>sum+x*x,0)/a.length);
  for(const material of Object.keys(SOUND_PROFILES)){
    const pcm=synthesizeImpact(material);signals[material]=pcm;
    assert.ok(pcm.length>4000);assert.ok(pcm.every(Number.isFinite));assert.ok(pcm.every(v=>Math.abs(v)<=.801));
    assert.ok(rms(pcm.subarray(200,2000))>.01);assert.ok(rms(pcm.subarray(-1200))<.006,material);
    assert.notDeepEqual(pcm,synthesizeImpact(material,3));
  }
  assert.notDeepEqual(signals.glass,signals.metal);assert.notDeepEqual(signals.glass,signals.ceramic);
  assert.ok(signals.metal.length>signals.glass.length);assert.ok(signals.glass.length>signals.ceramic.length);
});
test('impact strength changes volume while piece size changes pitch with bounded extremes',()=>{
  assert.ok(impactVoice({energy:10}).gain>impactVoice({energy:.05}).gain);
  assert.ok(impactVoice({size:.2}).rate>impactVoice({size:1.5}).rate);
  assert.ok(impactVoice({energy:1e12,size:.0001}).gain<=.7);assert.ok(impactVoice({size:.0001}).rate<=1.7);assert.ok(impactVoice({size:1e12}).rate>=.6);
});
test('sound starts disabled, can mute without a context, and clamps volume',()=>{
  const audio=new CollisionAudio();assert.equal(audio.play('glass'),false);audio.disable();audio.setVolume(10);assert.equal(audio.volume,1);audio.setVolume(-1);assert.equal(audio.volume,0);assert.equal(audio.context,null);
});

test('cannon transient is short, bass-heavy, soft, and fades without a click',()=>{
  const pcm=synthesizeImpact('cannon'),rate=24000;
  assert.ok(pcm.length/rate<=.3);assert.ok(pcm.every(Number.isFinite));
  assert.ok(pcm.every(x=>Math.abs(x)<.6));assert.equal(pcm[0],0);assert.ok(Math.abs(pcm.at(-1))<1e-6);
  const energy=pcm.reduce((sum,x)=>sum+x*x,0);
  let high=0,low=0;const alpha=1-Math.exp(-2*Math.PI*300/rate);
  for(const x of pcm){low+=alpha*(x-low);high+=(x-low)**2;}
  assert.ok(high/energy<.1,`High-frequency energy ratio: ${high/energy}`);
  assert.ok(pcm.subarray(-1200).every(x=>Math.abs(x)<.001));
});
