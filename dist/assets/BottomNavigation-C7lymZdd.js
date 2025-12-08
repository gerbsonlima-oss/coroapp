import{a as r,e as i,j as t}from"./index-CSUDG4kR.js";import{b as s}from"./createLucideIcon-Bw8xqtcs.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const c=s("House",[["path",{d:"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",key:"5wwlr5"}],["path",{d:"M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",key:"1d0kgt"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const l=s("Library",[["path",{d:"m16 6 4 14",key:"ji33uf"}],["path",{d:"M12 6v14",key:"1n7gus"}],["path",{d:"M8 8v12",key:"1gg7y9"}],["path",{d:"M4 4v16",key:"6qkkli"}]]);function x(){const a=r(),e=i(),o=e.pathname.startsWith("/events"),n=e.pathname.startsWith("/songs");return e.pathname.startsWith("/audio-to-sheet"),t.jsx("div",{className:"fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-sm safe-area-inset-bottom",children:t.jsxs("div",{className:"flex items-center justify-around px-0",children:[t.jsxs("button",{onClick:()=>a("/events"),className:`flex flex-col items-center gap-1 flex-1 py-3 px-2 transition-all duration-200 active:scale-95 ${o?"text-primary":"text-muted-foreground hover:text-foreground"}`,children:[t.jsx(c,{className:"h-6 w-6"}),t.jsx("span",{className:"text-xs font-medium",children:"Eventos"})]}),t.jsxs("button",{onClick:()=>a("/songs"),className:`flex flex-col items-center gap-1 flex-1 py-3 px-2 transition-all duration-200 active:scale-95 ${n?"text-primary":"text-muted-foreground hover:text-foreground"}`,children:[t.jsx(l,{className:"h-6 w-6"}),t.jsx("span",{className:"text-xs font-medium",children:"Biblioteca"})]})]})})}export{x as B};
