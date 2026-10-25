// Small modal-resonance instruments: an impact excites several decaying modes.
// No external audio files or repeating beep oscillator; each material has its own timbre.
export const SOUND_PROFILES={
  glass:{frequency:2250,decay:.19,duration:.9,modes:[1,1.59,2.32,3.17],weights:[1,.55,.28,.14],noise:.1},
  metal:{frequency:920,decay:.48,duration:1.9,modes:[1,1.47,2.09,2.56,3.92],weights:[.7,1,.5,.33,.2],noise:.07},
  ceramic:{frequency:1450,decay:.095,duration:.55,modes:[1,1.73,2.67,3.61],weights:[1,.6,.32,.12],noise:.22},
  wood:{frequency:390,decay:.032,duration:.25,modes:[1,2.71,5.13],weights:[1,.38,.13],noise:.65},
  resin:{frequency:760,decay:.047,duration:.32,modes:[1,1.92,3.21],weights:[1,.35,.12],noise:.4},
  jelly:{frequency:115,decay:.085,duration:.45,modes:[1,1.45,2.13],weights:[1,.2,.06],noise:.08},
};
export function synthesizeImpact(material,variant=0,sampleRate=24000){
  if(material==='cannon')return synthesizeCannon(sampleRate);
  const p=SOUND_PROFILES[material]??SOUND_PROFILES.wood,data=new Float32Array(Math.ceil(sampleRate*p.duration));
  let seed=1931+variant*7919,previous=0,peak=0;const pitch=1+(variant-1.5)*.027;
  for(let i=0;i<data.length;i++){
    const t=i/sampleRate,attack=1-Math.exp(-t*8000);let value=0;
    for(let k=0;k<p.modes.length;k++){
      const f=p.frequency*p.modes[k]*pitch;if(f>sampleRate*.44)continue;
      const phase=2*Math.PI*f*(material==='jelly'?t+.0008*(1-Math.exp(-t*25)):t);
      value+=p.weights[k]*Math.sin(phase)*Math.exp(-t/(p.decay/(1+k*.4)));
    }
    seed=(seed*1664525+1013904223)>>>0;const noise=seed/2147483648-1;
    value=(value+(noise-previous)*p.noise*Math.exp(-t*350))*attack;previous=noise;
    data[i]=value;peak=Math.max(peak,Math.abs(value));
  }
  for(let i=0;i<data.length;i++)data[i]*=.8/Math.max(1,peak);
  return data;
}
// A padded bass transient and low-pass noise burst, with no ringing partials.
export function synthesizeCannon(sampleRate=24000){
  const duration=.28,data=new Float32Array(Math.ceil(sampleRate*duration));
  const alpha=1-Math.exp(-2*Math.PI*260/sampleRate);let seed=713,low=0,smooth=0;
  for(let i=0;i<data.length;i++){
    const t=i/sampleRate;seed=(seed*1664525+1013904223)>>>0;
    low+=alpha*(seed/2147483648-1-low);smooth+=alpha*(low-smooth);
    const envelope=(1-Math.exp(-t*650))*Math.exp(-t*23)*(1-t/duration)**2;
    const phase=2*Math.PI*(52*t+38*.025*(1-Math.exp(-t/.025)));
    data[i]=(.55*Math.sin(phase)+smooth*1.4)*envelope;
  }
  return data;
}
export function impactVoice({energy=1,size=.4}={}){
  return {gain:Math.min(.7,.055+Math.log1p(Math.max(0,energy)*12)*.12),rate:Math.min(1.7,Math.max(.6,(.45/Math.max(.1,size))**.3))};
}
export class CollisionAudio {
  constructor(){this.context=null;this.enabled=false;this.volume=.55;this.voices=new Set();this.buffers=new Map();this.lastHit=-Infinity;this.sequence=0;this.recentBodies=new Map();}
  async enable(){
    if(!this.context){
      this.context=new AudioContext();const c=this.context;
      this.input=c.createGain();const compressor=c.createDynamicsCompressor();compressor.threshold.value=-16;compressor.knee.value=14;compressor.ratio.value=8;compressor.attack.value=.003;compressor.release.value=.16;
      const limiter=c.createWaveShaper(),curve=new Float32Array(2048);for(let i=0;i<curve.length;i++)curve[i]=Math.tanh((i/(curve.length-1)*2-1)*1.3);limiter.curve=curve;
      this.master=c.createGain();this.master.gain.value=0;this.input.connect(compressor);compressor.connect(limiter);limiter.connect(this.master);this.master.connect(c.destination);
      const reverb=c.createConvolver(),impulse=c.createBuffer(2,Math.floor(c.sampleRate*.24),c.sampleRate);
      for(let ch=0;ch<2;ch++){const data=impulse.getChannelData(ch);let seed=117+ch;for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=(seed/2147483648-1)*Math.exp(-i/c.sampleRate*32)*.18;}}
      reverb.buffer=impulse;const wet=c.createGain();wet.gain.value=.1;this.input.connect(reverb);reverb.connect(wet);wet.connect(compressor);
    }
    await this.context.resume();this.enabled=true;this.setVolume(this.volume);
  }
  disable(){this.enabled=false;if(this.context){this.master.gain.cancelScheduledValues(this.context.currentTime);this.master.gain.setTargetAtTime(0,this.context.currentTime,.01);}for(const voice of this.voices)voice.stop();this.voices.clear();this.recentBodies.clear();}
  setVolume(value){this.volume=Math.max(0,Math.min(1,value));if(this.context)this.master.gain.setTargetAtTime(this.enabled?this.volume:0,this.context.currentTime,.015);}
  play(material,{energy=1,size=.4,pan=0,id=null,preview=false}={}){
    if(!this.enabled||!this.context||!this.volume)return false;
    const c=this.context,now=c.currentTime;
    if(!preview&&(this.voices.size>=18||now-this.lastHit<.012||(id!==null&&now-(this.recentBodies.get(id)??-Infinity)<.075)))return false;
    this.lastHit=now;if(id!==null)this.recentBodies.set(id,now);
    if(this.recentBodies.size>512)for(const [key,time] of this.recentBodies)if(now-time>1)this.recentBodies.delete(key);
    const key=`${material}-${this.sequence++%4}`;
    if(!this.buffers.has(key)){const pcm=synthesizeImpact(material,this.sequence%4),buffer=c.createBuffer(1,pcm.length,24000);buffer.copyToChannel(pcm,0);this.buffers.set(key,buffer);}
    const source=c.createBufferSource(),gain=c.createGain(),panner=c.createStereoPanner(),voice=material==='cannon'?{gain:.32,rate:1}:impactVoice({energy,size});
    source.buffer=this.buffers.get(key);source.playbackRate.value=voice.rate;gain.gain.value=voice.gain;panner.pan.value=Math.max(-.85,Math.min(.85,pan));
    source.connect(gain);gain.connect(panner);panner.connect(this.input);this.voices.add(source);
    source.onended=()=>{this.voices.delete(source);source.disconnect();gain.disconnect();panner.disconnect();};source.start();return true;
  }
}
