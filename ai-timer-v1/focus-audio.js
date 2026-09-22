/* Locally synthesized, seamless audio. No network, media permissions or autoplay. */
globalThis.FocusAudio = class {
  constructor(Context=globalThis.AudioContext, Offline=globalThis.OfflineAudioContext) {
    this.Context=Context;this.Offline=Offline;this.context=null;this.channels={};this.buffers=new Map();this.revisions={};
  }
  async buffer(kind,preset) {
    const key=kind+':'+preset;
    if(this.buffers.has(key)) return this.buffers.get(key);
    const rate=22050,duration=32;
    const ctx=new this.Offline(1,rate*duration,rate);
    if(kind==='bgm') {
      const chords=[[261.63,329.63,392],[220,261.63,329.63],[174.61,220,261.63],[196,246.94,293.66]];
      chords.forEach((chord,index)=>chord.forEach((frequency,note)=>{
        const start=index*8+(preset==='bells'?note*1.6:0);
        const osc=ctx.createOscillator(), gain=ctx.createGain();osc.type='sine';osc.frequency.value=frequency;
        gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(preset==='bells'?.14:.09,start+.15);
        gain.gain.exponentialRampToValueAtTime(.0001,Math.min(start+6,duration-.05));
        osc.connect(gain).connect(ctx.destination);osc.start(start);osc.stop(Math.min(start+6.1,duration));
      }));
    } else {
      const data=ctx.createBuffer(1,rate*duration,rate), samples=data.getChannelData(0);
      let low=0;
      for(let i=0;i<samples.length;i++) {
        const noise=Math.random()*2-1;low=(low+.02*noise)/1.02;
        samples[i]=preset==='waves'?low*3*(.55+.45*Math.sin(2*Math.PI*i/samples.length*4)):noise*.18;
      }
      // Crossfade the loop seam; the endpoints meet at silence without clicks.
      const fade=rate/4;
      for(let i=0;i<fade;i++){samples[i]*=i/fade;samples[samples.length-1-i]*=i/fade;}
      const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter();source.buffer=data;filter.type='lowpass';filter.frequency.value=preset==='waves'?650:2600;
      source.connect(filter).connect(ctx.destination);source.start();
    }
    const result=await ctx.startRendering();this.buffers.set(key,result);return result;
  }
  async play(kind,preset,volume) {
    const revision=this.revisions[kind]=(this.revisions[kind]||0)+1;
    this.context ||= new this.Context();
    await this.context.resume();
    const buffer=await this.buffer(kind,preset);
    if(this.revisions[kind]!==revision) return false;
    this.stopSource(kind);
    const source=this.context.createBufferSource(),gain=this.context.createGain();
    source.buffer=buffer;source.loop=true;gain.gain.value=0;
    gain.gain.linearRampToValueAtTime(this.level(volume),this.context.currentTime+.25);
    source.connect(gain).connect(this.context.destination);source.start();
    this.channels[kind]={source,gain};return true;
  }
  level(value) {return Math.max(0,Math.min(100,Number(value)||0))/100;}
  volume(kind,value) {this.channels[kind]?.gain.gain.setTargetAtTime(this.level(value),this.context.currentTime,.06);}
  stopSource(kind) {
    const channel=this.channels[kind];if(!channel)return;
    const end=this.context.currentTime+.12;
    channel.gain.gain.cancelScheduledValues(this.context.currentTime);
    channel.gain.gain.setTargetAtTime(0,this.context.currentTime,.03);channel.source.stop(end);
    channel.source.onended=()=>{channel.source.disconnect();channel.gain.disconnect();};delete this.channels[kind];
  }
  stop(kind) {this.revisions[kind]=(this.revisions[kind]||0)+1;this.stopSource(kind);}
  stopAll() {this.stop('bgm');this.stop('ambient');}
};
