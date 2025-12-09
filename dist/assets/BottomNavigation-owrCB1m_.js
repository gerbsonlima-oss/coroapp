import{j as h,y as d,k as e}from"./index-DmkC4b75.js";import{c as s}from"./button-DedAJTsj.js";import{C as m}from"./calendar-BhFzJTid.js";import{M as u}from"./music-DNHBoANo.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v=s("BookOpen",[["path",{d:"M12 7v14",key:"1akyts"}],["path",{d:"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",key:"ruj8y"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=s("Brain",[["path",{d:"M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z",key:"l5xja"}],["path",{d:"M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z",key:"ep3f8r"}],["path",{d:"M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4",key:"1p4c4q"}],["path",{d:"M17.599 6.5a3 3 0 0 0 .399-1.375",key:"tmeiqw"}],["path",{d:"M6.003 5.125A3 3 0 0 0 6.401 6.5",key:"105sqy"}],["path",{d:"M3.477 10.896a4 4 0 0 1 .585-.396",key:"ql3yin"}],["path",{d:"M19.938 10.5a4 4 0 0 1 .585.396",key:"1qfode"}],["path",{d:"M6 18a4 4 0 0 1-1.967-.516",key:"2e4loj"}],["path",{d:"M19.967 17.484A4 4 0 0 1 18 18",key:"159ez6"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=s("House",[["path",{d:"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",key:"5wwlr5"}],["path",{d:"M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",key:"1d0kgt"}]]);function A(){const i=h(),t=d(),o=t.pathname==="/",n=t.pathname.startsWith("/events"),r=t.pathname.startsWith("/songs"),c=t.pathname.startsWith("/liturgy"),p=t.pathname.startsWith("/quiz"),l=[{label:"Início",icon:k,path:"/",isActive:o},{label:"Eventos",icon:m,path:"/events",isActive:n},{label:"Repertório",icon:u,path:"/songs",isActive:r},{label:"Quiz",icon:y,path:"/quiz",isActive:p},{label:"Liturgia",icon:v,path:"/liturgy",isActive:c}];return e.jsx("div",{className:"fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-sm safe-area-inset-bottom",children:e.jsx("div",{className:"flex items-center justify-around px-0",children:l.map(a=>e.jsxs("button",{onClick:()=>i(a.path),className:`flex flex-col items-center gap-1 flex-1 py-3 px-2 transition-all duration-200 active:scale-95 ${a.isActive?"text-primary":"text-muted-foreground hover:text-foreground"}`,children:[e.jsx(a.icon,{className:"h-6 w-6"}),e.jsx("span",{className:"text-xs font-medium",children:a.label})]},a.path))})})}export{A as B};
