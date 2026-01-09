import{j as p,y as h,l as a}from"./index-Bquz6dlS.js";import{c as s}from"./button-D8cpmuEw.js";import{C as m}from"./calendar-XFeemRXD.js";import{M as v}from"./music-8djowJpP.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d=s("BookOpen",[["path",{d:"M12 7v14",key:"1akyts"}],["path",{d:"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",key:"ruj8y"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=s("House",[["path",{d:"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",key:"5wwlr5"}],["path",{d:"M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",key:"1d0kgt"}]]);function y(){const o=p(),e=h(),i=e.pathname==="/",n=e.pathname.startsWith("/events"),r=e.pathname.startsWith("/songs"),c=e.pathname.startsWith("/liturgy"),l=[{label:"Início",icon:u,path:"/",isActive:i},{label:"Eventos",icon:m,path:"/events",isActive:n},{label:"Repertório",icon:v,path:"/songs",isActive:r},{label:"Liturgia",icon:d,path:"/liturgy",isActive:c}];return a.jsx("div",{className:"fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-sm safe-area-inset-bottom",children:a.jsx("div",{className:"flex items-center justify-around px-0",children:l.map(t=>a.jsxs("button",{onClick:()=>o(t.path),className:`flex flex-col items-center gap-1 flex-1 py-3 px-2 transition-all duration-200 active:scale-95 ${t.isActive?"text-primary":"text-muted-foreground hover:text-foreground"}`,children:[a.jsx(t.icon,{className:"h-6 w-6"}),a.jsx("span",{className:"text-xs font-medium",children:t.label})]},t.path))})})}export{y as B,d as a};
