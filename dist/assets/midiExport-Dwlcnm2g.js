import{b as h}from"./createLucideIcon-D_O2-_JO.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const w=h("Mic",[["path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z",key:"131961"}],["path",{d:"M19 10v2a7 7 0 0 1-14 0v-2",key:"1vc78b"}],["line",{x1:"12",x2:"12",y1:"19",y2:"22",key:"x3vr5v"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const L=h("Square",[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}]]),k=e=>{const t={C:0,"C#":1,D:2,"D#":3,E:4,F:5,"F#":6,G:7,"G#":8,A:9,"A#":10,B:11},o=e.slice(0,-1);return(parseInt(e.slice(-1))+1)*12+t[o]},v=e=>{const t=[],o=[77,84,104,100,0,0,0,6,0,0,0,1,0,96],c=[77,84,114,107],s=96*2;e.forEach(({note:i,time:l,duration:m,velocity:p})=>{const b=Math.round(l*s),y=Math.round(m*s),M=Math.round(p*127);t.push(...d(b)),t.push(144,i,M),t.push(...d(y)),t.push(128,i,0)}),t.push(0,255,47,0);const a=t.length,u=[a>>24&255,a>>16&255,a>>8&255,a&255];return new Uint8Array([...o,...c,...u,...t])},d=e=>{const t=[];t.push(e&127);let o=e>>7;for(;o>0;)t.unshift(o&127|128),o>>=7;return t},f=e=>{const t=[];for(let o=0;o<e.length;o++){const c=e[o],n=e[o+1],r=n?n.time-c.time:.5,s=Math.min(1,c.confidence*.8+.2);r>.05&&r<10&&t.push({note:k(c.noteName),time:c.time,duration:r,velocity:s})}return t},x=e=>{const t=f(e),o=v(t);return new Blob([o.buffer],{type:"audio/midi"})},B=async(e,t="recording.mid")=>{if(e.length===0)throw new Error("Nenhuma nota detectada para exportar");const o=x(e),c=URL.createObjectURL(o),n=document.createElement("a");n.href=c,n.download=t,document.body.appendChild(n),n.click(),document.body.removeChild(n),URL.revokeObjectURL(c)};export{w as M,L as S,B as e};
