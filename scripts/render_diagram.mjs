// Turn a diagram an assistant produced in chat (an HTML page with a React/JSX component, a .jsx file,
// or a page that already contains <svg>) into one standalone, script-free SVG file the site can show.
//
//   npm install            # once; the published site itself needs none of this
//   node scripts/render_diagram.mjs 来源.html 图解/操作系统/名称.svg
//
// The JSX runs locally, once, on your machine — only convert diagrams you trust. The output is checked:
// no <script>, no event handlers, no <foreignObject>, no external links. Colours that the source page
// defined as CSS variables (light and dark) are embedded in the SVG so it renders the same as an <img>.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

const [input,output]=process.argv.slice(2).filter(a=>!a.startsWith('--'));
if(!input||!output){console.error('用法：node scripts/render_diagram.mjs <来源.html|.jsx|.svg> <图解/科目/名称.svg>');process.exit(2);}
const source=fs.readFileSync(input,'utf8');

function cssVars(block){return Object.fromEntries([...block.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)].map(m=>[m[1],m[2].trim()]));}
function themeFrom(html){
  const style=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).join('\n');
  const dark=style.match(/@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)\s*\{([\s\S]*?\})\s*\}/i);
  const lightBlock=(dark?style.replace(dark[0],''):style).match(/:root\s*\{([^}]*)\}/);
  const darkBlock=dark&&dark[1].match(/:root\s*\{([^}]*)\}/);
  return {light:lightBlock?cssVars(lightBlock[1]):{},dark:darkBlock?cssVars(darkBlock[1]):{}};
}
function svgFromJsx(code){
  const Babel=require('@babel/standalone');const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
  const js=Babel.transform(code,{presets:['react']}).code;
  let element=null;
  const ReactDOM={createRoot:()=>({render:e=>{element=e;}}),render:e=>{element=e;}};
  const document={getElementById:()=>({}),querySelector:()=>({})};
  new Function('React','ReactDOM','document','window',js)(React,ReactDOM,document,{});
  if(!element)throw Error('没有找到 ReactDOM.render / createRoot().render 渲染的组件');
  return renderToStaticMarkup(element);
}

let svg;
const babel=source.match(/<script[^>]*type=["']text\/babel["'][^>]*>([\s\S]*?)<\/script>/i);
if(babel||/\.jsx$/i.test(input))svg=svgFromJsx(babel?babel[1]:source);
else{const m=source.match(/<svg[\s\S]*<\/svg>/i);if(!m)throw Error('来源里既没有 JSX 组件，也没有 <svg>');svg=m[0];}
svg=svg.slice(svg.indexOf('<svg'),svg.lastIndexOf('</svg>')+6);

// Drop editor-only attributes and anything executable.
svg=svg.replace(/\sdata-claude-[\w-]+="[^"]*"/g,'');
const banned=[/<script/i,/\son\w+\s*=/i,/<foreignObject/i,/javascript:/i,/(?:href|src)\s*=\s*["']https?:/i,/<iframe/i];
for(const b of banned)if(b.test(svg))throw Error('输出里有不允许的内容：'+b);
if(!/xmlns=/.test(svg))svg=svg.replace('<svg','<svg xmlns="http://www.w3.org/2000/svg"');

const theme=themeFrom(source);
const decl=vars=>Object.entries(vars).map(([k,v])=>`${k}:${v}`).join(';');
const fallback={'--cds-chart-axis':'#8a8f98','--cds-text-primary':'#1f2328','--cds-text-secondary':'#5b616b','--cds-chart-categorical-1':'#2f6fdb','--cds-chart-reference-tint':'#eef0f3'};
const light={...fallback,...theme.light};delete light['--bg'];
const dark={...theme.dark};delete dark['--bg'];
// The site is light-only, so the light palette is embedded by default; pass --dark to also keep the source's dark one.
const keepDark=process.argv.includes('--dark')&&Object.keys(dark).length>0;
const style=`<style>svg{${decl(light)};font-family:system-ui,"PingFang SC","Microsoft YaHei",sans-serif}`+(keepDark?`@media (prefers-color-scheme: dark){svg{${decl(dark)}}}`:'')+'</style>';
const title=(svg.match(/aria-label="([^"]*)"/)||[])[1]||path.basename(output,'.svg');
svg=svg.replace(/<svg([^>]*)>/,(m,a)=>`<svg${a}><title>${title}</title>${style}`);

fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,svg+'\n');
console.log(JSON.stringify({output,title,bytes:Buffer.byteLength(svg),darkMode:keepDark}));
