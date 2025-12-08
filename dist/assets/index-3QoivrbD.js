import{b as y,u as I,e as S}from"./createLucideIcon-dAnCoSH-.js";import{r as v,R as s,j as p}from"./index-BcY5ehVW.js";import{c as _}from"./index-CZ0jmIq_.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const P=y("Check",[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g=y("FileText",[["path",{d:"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",key:"1rqfz7"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"M10 9H8",key:"b1mrlr"}],["path",{d:"M16 13H8",key:"t4e002"}],["path",{d:"M16 17H8",key:"z1uh3a"}]]);function w(t,[n,u]){return Math.min(u,Math.max(n,t))}var D=v.createContext(void 0);function H(t){const n=v.useContext(D);return t||n||"ltr"}function q(t){const n=t+"CollectionProvider",[u,E]=_(n),[T,m]=u(n,{collectionRef:{current:null},itemMap:new Map}),C=r=>{const{scope:e,children:i}=r,o=s.useRef(null),c=s.useRef(new Map).current;return p.jsx(T,{scope:e,itemMap:c,collectionRef:o,children:i})};C.displayName=n;const d=t+"CollectionSlot",k=S(d),x=s.forwardRef((r,e)=>{const{scope:i,children:o}=r,c=m(d,i),l=I(e,c.collectionRef);return p.jsx(k,{ref:l,children:o})});x.displayName=d;const f=t+"CollectionItemSlot",M="data-radix-collection-item",A=S(f),R=s.forwardRef((r,e)=>{const{scope:i,children:o,...c}=r,l=s.useRef(null),h=I(e,l),a=m(f,i);return s.useEffect(()=>(a.itemMap.set(l,{ref:l,...c}),()=>void a.itemMap.delete(l))),p.jsx(A,{[M]:"",ref:h,children:o})});R.displayName=f;function N(r){const e=m(t+"CollectionConsumer",r);return s.useCallback(()=>{const o=e.collectionRef.current;if(!o)return[];const c=Array.from(o.querySelectorAll(`[${M}]`));return Array.from(e.itemMap.values()).sort((a,O)=>c.indexOf(a.ref.current)-c.indexOf(O.ref.current))},[e.collectionRef,e.itemMap])}return[{Provider:C,Slot:x,ItemSlot:R},N,E]}export{P as C,g as F,w as a,q as c,H as u};
