import{c as h}from"./button-eqVsF7Jd.js";import{g as b}from"./index-jTG1suki.js";import{d as n}from"./Combination-7K2jkD96.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=h("Check",[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]]);function g(r){const[d,e]=b.useState(void 0);return n(()=>{if(r){e({width:r.offsetWidth,height:r.offsetHeight});const f=new ResizeObserver(o=>{if(!Array.isArray(o)||!o.length)return;const c=o[0];let i,t;if("borderBoxSize"in c){const s=c.borderBoxSize,a=Array.isArray(s)?s[0]:s;i=a.inlineSize,t=a.blockSize}else i=r.offsetWidth,t=r.offsetHeight;e({width:i,height:t})});return f.observe(r,{box:"border-box"}),()=>f.unobserve(r)}else e(void 0)},[r]),d}export{y as C,g as u};
