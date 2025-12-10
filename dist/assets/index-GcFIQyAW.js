import{c as d}from"./utils-DA4pRNaK.js";import{g as c}from"./index-BWhZ3FFB.js";import{d as h}from"./Combination-BiO0eXsL.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v=d("Check",[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]]);function S(r){const[e,o]=c.useState(void 0);return h(()=>{if(r){o({width:r.offsetWidth,height:r.offsetHeight});const f=new ResizeObserver(t=>{if(!Array.isArray(t)||!t.length)return;const n=t[0];let i,s;if("borderBoxSize"in n){const u=n.borderBoxSize,a=Array.isArray(u)?u[0]:u;i=a.inlineSize,s=a.blockSize}else i=r.offsetWidth,s=r.offsetHeight;o({width:i,height:s})});return f.observe(r,{box:"border-box"}),()=>f.unobserve(r)}else o(void 0)},[r]),e}function y(r){const e=c.useRef({value:r,previous:r});return c.useMemo(()=>(e.current.value!==r&&(e.current.previous=e.current.value,e.current.value=r),e.current.previous),[r])}export{v as C,S as a,y as u};
