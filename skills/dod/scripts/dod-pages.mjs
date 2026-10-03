#!/usr/bin/env node
// dod-pages — the one look of every page dod writes (the Almanac of references/design.md), its offline shell,
// its charts and its numbers.
//
// Built from docs/dod/pm-views.md. Every page goes through `pageShell`, which emits the Content-Security-Policy
// meta, the band, the ARIA tabs and the one inline script; every renderer is an entry of `RENDERERS`, which
// dod-wbs.mjs dispatches through and the offline and escape tests enumerate (D2, D5). The pages read plan files,
// reviews files, a profile and git's commit times — never the network, never a session record (that is
// dod-effort.mjs, whose figures reach a page only as a Log line).
//
//   node dod-pages.mjs --selftest [--gating]

import {
  readFileSync, readdirSync, existsSync, statSync, lstatSync, realpathSync, mkdtempSync, writeFileSync, rmSync,
  mkdirSync, symlinkSync,
} from "node:fs";
import { join, dirname, resolve, relative, isAbsolute, sep, basename } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  parsePlan, parseReviews, missHistory, checkPlan, reportNumbers, resolveStore, scanForLeaks, plainText, decodePlan,
  renderIndex as renderIndexOf,
} from "./dod-index.mjs";

export const SELF = fileURLToPath(import.meta.url);
export const SKILL_DIR = dirname(dirname(SELF));
export const DESIGN_MD = join(SKILL_DIR, "references", "design.md");
export const LAYERS_MD = join(SKILL_DIR, "references", "layers.md");

// ---------------------------------------------------------------- bounds and targets (Business rules 4.1, 13.2)

export const RATE_TARGET = 90;          // S-12: the gold standard
export const RATE_FLOOR = 75;           // S-12: the acceptable floor
export const SCRIPT_MAX = 2048;         // bytes of the one inline script (D2; the samples' script is 1.1 KB)
export const SHA_RE = /^[0-9a-f]{7,40}$/; // D11: a sha is matched before git ever sees it
export const GIT_TIMEOUT = 10_000;      // ms (D11)
export const BENCH_DEPTH = 3;           // S-7
export const MAX_PROJECTS = 200;        // S-20
export const MAX_PLANS = 5000;          // S-20
export const NOT_RECORDED = "not recorded";
export const PAGE_KINDS = ["plan", "review", "dashboard", "audit", "benchmark"];
export const KINDS = ["discovered", "corrected", "requested", "emergent", "defect", "external"];
const COUNTED = new Set(["discovered", "corrected"]);

// The columns of `.github/ISSUE_TEMPLATE/field-audit.yml` › Numbers, compared with the form by
// `scripts/checks/release-check.mjs issue-form` (D17).
export const FIELD_AUDIT_HEADER = "| Plan | Size | Status | Baseline items | Review rounds | First READY by | Design changes | Prediction |";

// ---------------------------------------------------------------- text

// D5: every string from a plan, a reviews file, a profile, a folder name or a record reaches HTML through here.
export const esc = (s) => /* pmv-mutant:escape */String(s ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

// Inline plan text: escaped first, then `code` spans and **bold** — the only markup a plan's prose carries.
export const inl = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

// D4: an absent measure is these words, never 0
export const nr = () => `<span class="nr">${NOT_RECORDED}</span>`;
export const tag = (how) => `<span class="tag ${how === "measured" ? "m" : "e"}">${how === "measured" ? "measured" : "estimated"}</span>`;

const day = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000;
const isoDay = (n) => new Date(n * 86_400_000).toISOString().slice(0, 10);
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, "0")} min` : `${Math.round(m)} min`);
const fmtK = (n) => `${n.toLocaleString("en-US")} k`;

// ---------------------------------------------------------------- the stylesheet (D1)
//
// The values are design.md's, written out: the pages never read design.md at run time (Design › Data 3.1), and
// `pages.tokens-sync` fails the day the two differ — design.md is authoritative (Business rules 4.4).

export const TOKENS = {
  light: {
    band: "#10293b", "band-ink": "#eef2ee", "band-muted": "#a9bfc6", ground: "#f4efe3", paper: "#fffcf4",
    ink: "#16222c", "ink-muted": "#46525a", "ink-faint": "#6b7479", rule: "#e2d9c4", "rule-strong": "#c9bd9f",
    track: "#e9e1cc", tide: "#2f8fa8", link: "#1d5e79", focus: "#d0731f", ok: "#2f7a55", bad: "#b23a2a",
    "tide-fill": "#2f8fa833", selection: "#bfe0e6", "on-ok": "#ffffff", "on-kind": "#ffffff", "muted-bar": "#9aa9a6",
    "kind-discovered": "#b5461f", "kind-corrected": "#a7740c", "kind-requested": "#2c7a6c", "kind-emergent": "#6a4f9e",
    "kind-defect": "#55636c", "kind-external": "#73762a",
  },
  dark: {
    band: "#071119", "band-muted": "#8aa4ad", ground: "#0d1a24", paper: "#12222e", ink: "#e6ebe6",
    "ink-muted": "#a9b6ba", "ink-faint": "#84939a", rule: "#1f3443", "rule-strong": "#2f4a5c", track: "#1b2f3d",
    tide: "#5fb2c9", "tide-fill": "#5fb2c92e", link: "#7cc6da", focus: "#f0a050", ok: "#5cb487", bad: "#f07a66",
    selection: "#24546a", "on-ok": "#06140d", "on-kind": "#0b1218", "muted-bar": "#56686f",
    "kind-discovered": "#ec8058", "kind-corrected": "#d9a63c", "kind-requested": "#58b5a3", "kind-emergent": "#a891e0",
    "kind-defect": "#93a3ad", "kind-external": "#b5b85a",
  },
};

const vars = (t) => Object.entries(t).map(([k, v]) => `--${k}:${v}`).join(";");

const FONTS = `--f-body:"Segoe UI Variable Text","Segoe UI",system-ui,-apple-system,"Helvetica Neue",sans-serif;`
  + `--f-head:"Sitka Heading","Sitka Text","Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;`
  + `--f-num:Bahnschrift,"DIN Alternate","Roboto Condensed","Arial Narrow",system-ui,sans-serif;`
  + `--f-mono:"Cascadia Mono",Consolas,"SF Mono",ui-monospace,monospace`;

export const PAGE_STYLE = `
:root{color-scheme:light dark;${FONTS};${vars(TOKENS.light)}}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;${vars(TOKENS.dark)}}}
:root[data-theme="dark"]{color-scheme:dark;${vars(TOKENS.dark)}}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-padding-top:4rem}
body{margin:0;background:var(--ground);color:var(--ink);font:16px/1.55 var(--f-body);font-variant-numeric:tabular-nums}
body,p,td,th,li,dd,summary,caption,h1,h2,h3{overflow-wrap:anywhere}
::selection{background:var(--selection);color:var(--ink)}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px;border-radius:2px}
a{color:var(--link);text-underline-offset:.2em}
h1,h2,h3{margin:0;text-wrap:balance}
p{margin:0}
code,.mono{font:.86em/1.4 var(--f-mono);overflow-wrap:anywhere}
.wrap{max-width:72rem;margin:0 auto;padding-inline:clamp(16px,4vw,40px)}
.band{background:var(--band);color:var(--band-ink)}
.band-top{display:flex;flex-wrap:wrap;gap:1rem 2rem;align-items:flex-end;justify-content:space-between;padding-top:1.6rem;padding-bottom:1.1rem}
.crumb{font:500 .8rem/1.2 var(--f-num);color:var(--band-muted)}
.band h1{font:600 2rem/1.05 var(--f-head);letter-spacing:-.01em;margin-top:.45rem}
@media (min-width:48rem){.band h1{font-size:2.5rem}}
@media (min-width:60rem){.band h1{font-size:3rem}}
.state{display:flex;flex-wrap:wrap;gap:.4rem 1.2rem;align-items:center;font:500 .95rem var(--f-num);color:var(--band-muted)}
.tabs{display:flex;gap:.2rem;overflow-x:auto;scrollbar-width:none;margin-inline:-.6rem}
.tabs::-webkit-scrollbar{display:none}
.tabs button{appearance:none;background:none;border:0;color:var(--band-muted);font:500 .95rem/1 var(--f-body);padding:.85rem .6rem .95rem;cursor:pointer;white-space:nowrap;border-bottom:3px solid transparent}
.tabs button:hover{color:var(--band-ink)}
.tabs button[aria-selected=true]{color:var(--band-ink);border-bottom-color:var(--tide)}
.tabs .cnt{font:600 .75rem var(--f-num);opacity:.8;margin-left:.15rem}
.tabs button:focus-visible{outline-offset:-3px}
.notice{font-size:.88rem;color:var(--ink-muted);padding:.9rem 0 0}
main.wrap{padding-bottom:3rem}
.nojs-h{display:none}
.js .tp[hidden]{display:none}
html:not(.js) .tabs{display:none}
html:not(.js) .nojs-h{display:block;margin:2.5rem 0 1rem;font:700 1.4rem/1.2 var(--f-head)}
.panel{background:var(--paper);border:1px solid var(--rule);padding:clamp(1rem,3vw,1.75rem);margin-top:2.25rem}
.panel h2{font:600 1.3rem/1.2 var(--f-head)}
.panel h3{font:600 1.08rem/1.35 var(--f-head);margin:1.4rem 0 .5rem}
.ph{display:grid;gap:.3rem;margin-bottom:1rem}
.ph p,.fine{color:var(--ink-muted);max-width:68ch}
.fine{font-size:.86rem;margin-top:.6rem}
.lead{padding:2.2rem 0 .4rem;display:grid;gap:.8rem;max-width:62rem}
.dek{font:500 clamp(1.2rem,2.6vw,1.55rem)/1.3 var(--f-head);color:var(--ink)}
.story p{font-size:1.06rem;max-width:66ch;color:var(--ink-muted)}
.nr{color:var(--ink-faint);font-style:italic}
.dim{color:var(--ink-faint);font-size:.82em;font-weight:400}
.tag{display:inline-block;font:600 .68rem/1 var(--f-num);letter-spacing:.07em;text-transform:uppercase;padding:.22rem .38rem;border:1px solid var(--rule-strong);color:var(--ink-muted);border-radius:2px;vertical-align:.12em;margin-left:.3rem}
.chart{margin:0;overflow-x:auto;overscroll-behavior-x:contain}
.chart svg{display:block;width:100%;min-width:540px;height:auto}
.chart .tick{font:12.5px var(--f-num);fill:var(--ink-faint)}
.chart .lbl{font:12.5px var(--f-num);fill:var(--ink-muted)}
.chart .lbl.halo{paint-order:stroke;stroke:var(--paper);stroke-width:3px;stroke-linejoin:round}
.chart .grid{stroke:var(--rule);stroke-width:1}
.chart .predicted{stroke:var(--tide);stroke-width:2.2;stroke-dasharray:7 5;fill:none}
.chart .predicted.pre{stroke-width:1.4;opacity:.65}
.chart .observed{stroke:var(--ink);stroke-width:2.6;fill:none;stroke-linejoin:round}
.chart .verified{fill:var(--tide-fill);stroke:var(--tide);stroke-width:1}
.chart .phase{fill:var(--track);opacity:.55}
.chart .mk circle{fill:var(--k);stroke:var(--paper);stroke-width:2}
.chart .mk text{font:700 9.5px var(--f-num);fill:var(--on-kind)}
.chart .bandfill{fill:var(--tide-fill)}
.chart .ref{stroke:var(--tide);stroke-dasharray:4 4}
.chart .trendline{stroke:var(--ink-faint);stroke-width:1.4;fill:none}
.chart .pt{fill:var(--paper);stroke:var(--ink-muted);stroke-width:1.6}
.chart .pt.me{fill:var(--kind-discovered);stroke:var(--paper);stroke-width:2}
.legend{display:flex;flex-wrap:wrap;gap:.4rem 1.1rem;margin-top:.7rem;font-size:.84rem;color:var(--ink-muted)}
.legend span{display:inline-flex;align-items:center;gap:.4rem}
.lg{display:inline-block;width:1.4rem;height:.7rem}
.lg.pred{border-top:2.2px dashed var(--tide);height:0}
.lg.obs{border-top:2.6px solid var(--ink);height:0}
.lg.ver{background:var(--tide-fill);border:1px solid var(--tide)}
[class*="k-"]{--k:var(--kind-defect)}
.k-discovered{--k:var(--kind-discovered)}.k-corrected{--k:var(--kind-corrected)}.k-requested{--k:var(--kind-requested)}.k-emergent{--k:var(--kind-emergent)}.k-defect{--k:var(--kind-defect)}.k-external{--k:var(--kind-external)}
.chip{display:inline-flex;align-items:center;gap:.35rem;font:500 .84rem var(--f-num)}
.chip i{width:.7rem;height:.7rem;border-radius:50%;background:var(--k)}
.im{display:inline-grid;place-items:center;min-width:1.9rem;height:1.25rem;padding:0 .3rem;border-radius:.65rem;background:var(--k);color:var(--on-kind);font:700 .72rem/1 var(--f-num);vertical-align:.1em}
.st{display:inline-block;font:600 .74rem/1 var(--f-num);letter-spacing:.06em;text-transform:uppercase;padding:.3rem .5rem;background:var(--ok);color:var(--on-ok);border-radius:2px}
.st.open{background:var(--track);color:var(--ink)}
.st.big{font-size:.82rem;padding:.4rem .65rem}
.two{display:grid;gap:2.25rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))}
.tw{overflow-x:auto}
table.data{width:100%;border-collapse:collapse;font-size:.9rem}
table.data caption{text-align:left;font:700 1.05rem/1.3 var(--f-head);padding-bottom:.8rem;caption-side:top}
table.data th,table.data td{text-align:left;padding:.5rem .6rem;border-bottom:1px solid var(--rule);vertical-align:top}
table.data thead th{font:600 .74rem/1.2 var(--f-num);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-muted);border-bottom:1px solid var(--rule-strong);white-space:nowrap}
table.data tbody th{font-weight:500}
table.data .n{text-align:right;white-space:nowrap}
table.data tbody tr:nth-child(5n) th,table.data tbody tr:nth-child(5n) td{border-bottom-color:var(--rule-strong)}
table.data tfoot th,table.data tfoot td{font-weight:700;border-bottom:0;border-top:1px solid var(--rule-strong)}
details.nums{margin-top:.8rem}
details>summary{cursor:pointer;color:var(--link);font-size:.88rem;width:fit-content}
details[open]>summary{margin-bottom:.6rem}
.kpi td.v{font:700 1.35rem/1.1 var(--f-num);letter-spacing:-.01em;white-space:nowrap}
.kpi td.v .nr,.kpi td.v .tag{font:italic 400 .9rem var(--f-body)}
.kpi td.v .tag{font:600 .68rem/1 var(--f-num);font-style:normal}
.kpi td.m{color:var(--ink-muted);max-width:52ch}
.sc{position:relative;display:block;height:.7rem;background:var(--track);min-width:8rem}
.sc-f{position:absolute;inset:0 auto 0 0;width:var(--v);background:var(--tide)}
.sc-t{position:absolute;top:-.3rem;bottom:-.3rem;left:var(--t);width:2px;background:var(--ink)}
.sc-l{display:block;font:.76rem var(--f-num);color:var(--ink-muted);margin-top:.35rem}
.gantt{display:grid;font-size:.86rem}
.g-row{display:grid;grid-template-columns:minmax(0,15rem) 1fr 6rem;gap:.8rem;align-items:center;min-height:2rem;padding:.5rem 0;border-bottom:1px solid var(--rule)}
.g-lab{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.g-num{text-align:right;font:500 .8rem var(--f-num);color:var(--ink-muted)}
.g-track{position:relative;height:2rem}
.g-bar{position:absolute;top:.55rem;height:.9rem;background:var(--tide);min-width:3px}
.g-plan .g-bar{background:var(--muted-bar)}
.g-group{min-height:2.2rem;border-bottom-color:var(--rule-strong)}
.g-group .g-lab{font-weight:700;padding-top:.5rem}
.g-head{border-bottom:1px solid var(--rule-strong);min-height:1.8rem}
.g-head .g-lab,.g-head .g-num{font:600 .72rem var(--f-num);letter-spacing:.07em;text-transform:uppercase;color:var(--ink-muted)}
.g-scale span{position:absolute;top:.55rem;transform:translateX(-50%);font:.72rem var(--f-num);color:var(--ink-faint);white-space:nowrap}
.g-scale span:first-child{transform:none}.g-scale span:last-child{transform:translateX(-100%)}
.g-mark{position:absolute;top:.15rem;transform:translateX(-50%)}
.g-mark .im{min-width:1.7rem;height:1.15rem}
.tideline{list-style:none;margin:0;padding:0}
.tideline li{display:grid;grid-template-columns:6.4rem 5.4rem 1fr auto;gap:.9rem;align-items:baseline;padding:.55rem 0;border-bottom:1px solid var(--rule);font-size:.92rem}
.tideline li:nth-child(5n){border-bottom-color:var(--rule-strong)}
.tl-t{font:600 .9rem var(--f-num);color:var(--ink-muted)}
.tl-r{font:700 .86rem var(--f-num)}
.tideline li.base{background:var(--tide-fill);margin-inline:-.6rem;padding:.55rem .6rem}
.tideline .amv .tl-r{color:var(--k)}
.tl-s{color:var(--ink-faint)}
.glance{margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr));gap:0 2rem}
.glance div{padding:.6rem 0;border-bottom:1px solid var(--rule)}
.glance dt{font:600 .72rem/1.2 var(--f-num);letter-spacing:.07em;text-transform:uppercase;color:var(--ink-muted);margin-bottom:.25rem}
.glance dd{margin:0}
.log{list-style:none;margin:0;padding:0;font-size:.86rem}
.log li{padding:.4rem 0 .4rem 1rem;border-bottom:1px solid var(--rule);position:relative}
.log li::before{content:"";position:absolute;left:0;top:.85rem;width:.4rem;height:.4rem;background:var(--ink-faint)}
.log .tr{font-weight:700}.log .tr::before{background:var(--ink)}
.log .ps::before{background:var(--ok)}.log .fl::before{background:var(--bad)}
.amlist{list-style:none;margin:0;padding:0}
.am{padding:1.1rem 0;border-top:1px solid var(--rule)}
.am h3{margin:0;display:flex;gap:.6rem;align-items:baseline}
.am-meta{font-size:.84rem;color:var(--ink-muted);margin:.35rem 0 .5rem;display:flex;flex-wrap:wrap;gap:.25rem .5rem;align-items:center}
.am p{max-width:80ch}
.issue{white-space:pre-wrap;font:.84rem/1.5 var(--f-mono);background:var(--ground);border:1px solid var(--rule);padding:1rem;overflow-x:auto}
.foot{color:var(--ink-faint);font-size:.82rem;padding-top:1rem;padding-bottom:2.5rem}
.bad{color:var(--bad)}.ok{color:var(--ok)}
@media (max-width:760px){
 .g-row{grid-template-columns:1fr 5rem;gap:.1rem .6rem}
 .g-lab{grid-column:1/-1;padding-top:.45rem}
 .g-track{grid-column:1}
 .g-head .g-lab{display:none}
 .g-scale span:nth-child(even){display:none}
 .g-group .g-track,.g-group .g-num{display:none}
 .tideline li{grid-template-columns:5.6rem 1fr;gap:.2rem .7rem}.tl-w{grid-column:1/-1}.tl-s{display:none}
 .kpi thead{display:none}
 .kpi tr{display:grid;grid-template-columns:1fr auto;gap:.2rem 1rem;padding:.6rem 0;border-bottom:1px solid var(--rule)}
 .kpi td,.kpi th{border:0;padding:.1rem 0}
 .kpi td.a,.kpi td.m{grid-column:1/-1}
}
@media (prefers-reduced-motion:no-preference){.js .tp:not([hidden]){animation:in .22s cubic-bezier(.16,1,.3,1)}@keyframes in{from{opacity:.4;transform:translateY(4px)}}}
@media print{.tabs{display:none}.js .tp[hidden]{display:block}}
`.trim();

// ---------------------------------------------------------------- the shell (D2, D3)

// The one script: tabs, keyboard, the URL hash. Panels are hidden by this script, never by the markup, so a page
// without it shows every panel in order under its own heading (D3).
export const TAB_SCRIPT = "(function(){var d=document;d.documentElement.classList.add('js');"
  + "var tabs=[].slice.call(d.querySelectorAll('[role=tab]'));if(!tabs.length)return;"
  + "var panels=tabs.map(function(t){return d.getElementById(t.getAttribute('aria-controls'))});"
  + "function show(i,focus){tabs.forEach(function(t,j){var on=i===j;t.setAttribute('aria-selected',on);t.tabIndex=on?0:-1;panels[j].hidden=!on});"
  + "if(focus)tabs[i].focus();var b=tabs[i],l=b.parentNode;if(l.scrollWidth>l.clientWidth)l.scrollLeft=b.offsetLeft-l.offsetLeft-(l.clientWidth-b.offsetWidth)/2;"
  + "if(history.replaceState)history.replaceState(null,'','#'+tabs[i].id.slice(4))}"
  + "tabs.forEach(function(t,i){t.addEventListener('click',function(){show(i)});t.addEventListener('keydown',function(e){"
  + "var n=e.key==='ArrowRight'||e.key==='ArrowDown'?i+1:e.key==='ArrowLeft'||e.key==='ArrowUp'?i-1:e.key==='Home'?0:e.key==='End'?tabs.length-1:null;"
  + "if(n===null)return;e.preventDefault();show((n+tabs.length)%tabs.length,true)})});"
  + "function fromHash(){var h=location.hash.slice(1),s=-1;tabs.forEach(function(t,k){if(t.id==='tab-'+h)s=k});show(s<0?0:s)}"
  + "fromHash();addEventListener('hashchange',fromHash)})();";

export const scriptHash = (s) => `sha256-${createHash("sha256").update(s, "utf8").digest("base64")}`;
export const CSP = `default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src '${scriptHash(TAB_SCRIPT)}'`;

// A URL in plan text is text, not a request — but D2 allows `http(s)://` only inside a link, so the shell turns
// every URL in the body's text into one. The document title and SVG titles cannot hold a link: their scheme is
// dropped instead.
const URL_RE = /https?:\/\/(?:(?!&quot;|&lt;|&gt;|&#39;)[^\s<>"])+/g;
const trimUrl = (u) => { const m = u.match(/^(.*?)((?:[.,;:!?)\]]|&#39;|&quot;)*)$/); return [m[1], m[2]]; };
export function linkify(html) {
  return html.split(/(<a\b[\s\S]*?<\/a>|<title>[\s\S]*?<\/title>|<style>[\s\S]*?<\/style>|<script>[\s\S]*?<\/script>|<[^>]*>)/)
    .map((part, k) => {
      if (k % 2 === 0) return part.replace(URL_RE, (u) => { const [url, tail] = trimUrl(u); return `<a href="${url}">${url}</a>${tail}`; });
      if (part.startsWith("<title>")) return part.replace(/https?:\/\//g, "");
      return part;
    }).join("");
}

// tabs: [{ id, label, count? }]; panels: { id: html }. Every option still emits the CSP meta — there is no
// option that leaves it out (D41, probe 4.4).
export function pageShell({ title, crumb = "dod", heading, state = "", notice = "", tabs = [], panels = {}, footer = "", style = "", label = "Page sections" }) {
  const nav = tabs.length > 1
    ? `<nav class="tabs" role="tablist" aria-label="${esc(label)}">${tabs.map((t, k) => `<button role="tab" id="tab-${esc(t.id)}" aria-controls="p-${esc(t.id)}" aria-selected="${k ? "false" : "true"}" tabindex="${k ? "-1" : "0"}" type="button">${esc(t.label)}${t.count !== undefined ? ` <span class="cnt">${esc(t.count)}</span>` : ""}</button>`).join("")}</nav>`
    : "";
  const body = tabs.length > 1
    ? tabs.map((t) => `<div class="tp" role="tabpanel" id="p-${esc(t.id)}" aria-labelledby="tab-${esc(t.id)}" tabindex="0"><h2 class="nojs-h">${esc(t.label)}</h2>${panels[t.id] ?? ""}</div>`).join("\n")
    : tabs.map((t) => panels[t.id] ?? "").join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta http-equiv="Content-Security-Policy" content="${/* pmv-mutant:csp */CSP}">
<title>${esc(title)}</title>
<style>
${PAGE_STYLE}
${style}
</style>
</head>
<body>
<header class="band"><div class="wrap band-top"><div><p class="crumb">${esc(crumb)}</p><h1>${esc(heading ?? title)}</h1></div>${state ? `<div class="state">${state}</div>` : ""}</div>${nav ? `<div class="wrap">${nav}</div>` : ""}</header>
<main class="wrap">
${notice ? `<p class="notice">${esc(notice)}</p>\n` : ""}${body}
</main>
<footer class="wrap foot">${footer || "Generated by dod · works offline and loads nothing"}</footer>
<script>${TAB_SCRIPT}</script>
</body>
</html>
`;
  return linkify(html);
}

// D2: what a page may not hold. Each entry is a pattern and the words of its problem.
const FORBIDDEN = [
  [/<script\b[^>]*\bsrc\s*=/i, "a <script src>"], [/<link\b/i, "a <link>"], [/<img\b/i, "an <img>"],
  [/<iframe\b/i, "an <iframe>"], [/<object\b/i, "an <object>"], [/<embed\b/i, "an <embed>"], [/<base\b/i, "a <base>"],
  [/\bsrcset\s*=/i, "a srcset"], [/@import\b/i, "an @import"], [/url\(\s*(?!['"]?#)/i, "a url( other than url(#"],
];

export function offlineProblems(html) {
  const out = [];
  const meta = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/);
  if (/* pmv-mutant:csp-check */!meta) out.push("no Content-Security-Policy meta");
  else {
    const csp = meta[1].replaceAll("&#39;", "'");
    for (const d of ["default-src 'none'", "style-src 'unsafe-inline'", "img-src data:"]) if (!csp.includes(d)) out.push(`the CSP lacks ${d}`);
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    if (scripts.length !== 1) out.push(`${scripts.length} script elements — a page has exactly one`);
    for (const [, , body] of scripts) {
      if (Buffer.byteLength(body) > SCRIPT_MAX) out.push(`the inline script is ${Buffer.byteLength(body)} bytes, over ${SCRIPT_MAX}`);
      if (!csp.includes(`script-src '${scriptHash(body)}'`)) out.push("the script's hash is not the CSP's script-src");
    }
  }
  for (const [re, words] of FORBIDDEN) if (/* pmv-mutant:forbidden-tags */re.test(html)) out.push(`the page holds ${words}`);
  const outsideLinks = html.replace(/<a\b[\s\S]*?<\/a>/gi, "");
  if (/https?:\/\//i.test(outsideLinks)) out.push("http:// or https:// outside an <a href>");
  return out;
}

// ---------------------------------------------------------------- the registry (Business rules 4.5)

// Every page dod writes is an entry here: `render(ctx)` returns the page, `fixture()` returns a ctx the offline
// and escape tests render. dod-wbs.mjs registers the plan and review pages and dispatches every `--html` mode
// through this map, so a renderer outside it cannot be reached from the command line.
export const RENDERERS = new Map();
export const registerRenderer = (kind, entry) => { RENDERERS.set(kind, { kind, ...entry }); };

// ---------------------------------------------------------------- numbers (Business rules 4.1)

export const verifiedIds = (plan) => {
  const last = new Map();
  for (const e of plan.evidence) last.set(e.id, e.result);
  return new Set([...last].filter(([, r]) => r === "pass").map(([id]) => id));
};

export const designCount = (a) => Math.max(1, a.ops.filter((o) => /^[+~]/.test(o)).length);
const transition = (plan, status) => plan.transitions.find((t) => t.status === status) ?? null;
const lastTransition = (plan, status) => [...plan.transitions].reverse().find((t) => t.status === status) ?? null;
export const started = (plan) => !["draft", "ready"].includes(plan.fm.status);

// D15: one function for every mean and median dod prints. Values that are not numbers are `not recorded` and
// left out; `n` is what was counted.
export function summarise(values) {
  const xs = values.filter((v) => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  const n = xs.length;
  if (/* pmv-mutant:n-zero */n === 0) return { n: 0, mean: null, median: null };
  const mean = xs.reduce((s, x) => s + x, 0) / n;
  const mid = Math.floor(n / 2);
  const median = /* pmv-mutant:even-median */n % 2 === 0 ? (xs[mid - 1] + xs[mid]) / 2 : xs[mid];
  return { n, mean, median };
}
const round1 = (x) => Math.round(x * 10) / 10;
export const summaryCell = (s, unit = "") => (s.n === 0 ? nr() : `${round1(s.mean)}${unit} · ${round1(s.median)}${unit} <span class="dim">n ${s.n}</span>`);

// Completion: vs the baseline (baseline items still in the plan and verified, of the baseline) and vs now.
export function completion(plan) {
  const ok = verifiedIds(plan);
  const now = new Set(plan.items.map((i) => i.id));
  const base = plan.baseline.filter((b) => now.has(b.id) && ok.has(b.id)).length;
  return { base, baseOf: plan.baseline.length, now: plan.items.filter((i) => ok.has(i.id)).length, nowOf: plan.items.length };
}

// The effort note (Business rules 5.3, D22). Read anchored over the whole Log line.
export const EFFORT_RE = /^- (\d{4}-\d{2}-\d{2}) · note · effort · (W\d+\.\d+|plan) · (?:(\d+) h (\d{2}) min|(\d+) min) (measured|estimated) · (?:(\d+(?:,\d{3})*) k tokens (measured|estimated)|tokens not recorded)$/;
export function effortLines(plan) {
  const read = [], malformed = [];
  for (const n of plan.notes) {
    if (!/^effort\b/.test(n.text)) continue;
    const line = `- ${n.date} · note · ${n.text}`;
    const m = line.match(EFFORT_RE);
    if (!m) { malformed.push(line); continue; }
    read.push({
      seq: n.seq, date: m[1], pkg: m[2],
      minutes: m[3] !== undefined ? Number(m[3]) * 60 + Number(m[4]) : Number(m[5]), minutesHow: m[6],
      tokensK: m[7] !== undefined ? Number(m[7].replace(/,/g, "")) : null, tokensHow: m[8] ?? null,
    });
  }
  // D22: the later line in Log order wins, whatever its date
  const latest = new Map();
  for (const e of read.sort((a, b) => a.seq - b.seq)) /* pmv-mutant:later-wins */latest.set(e.pkg, e);
  return { latest, malformed };
}

// Hours and tokens over the plan's leaf packages (Business rules 4.1).
export function effortTotals(plan) {
  const { latest, malformed } = effortLines(plan);
  const leaves = plan.packages.filter((p) => p.leaf).map((p) => p.id);
  const keys = leaves.length ? leaves : ["plan"];
  const got = keys.filter((k) => latest.has(k));
  if (latest.has("plan") && leaves.length && !got.includes("plan")) got.push("plan");
  const rows = got.map((k) => latest.get(k));
  const minutes = rows.length ? rows.reduce((s, r) => s + r.minutes, 0) : null;
  const withTok = rows.filter((r) => r.tokensK !== null);
  const tokensK = withTok.length ? withTok.reduce((s, r) => s + r.tokensK, 0) : null;
  const how = (list, f) => (list.every((r) => r[f] === "measured") ? "measured" : "estimated");
  return {
    minutes, tokensK, minutesHow: rows.length ? how(rows, "minutesHow") : null, tokensHow: withTok.length ? how(withTok, "tokensHow") : null,
    recorded: got.filter((k) => keys.includes(k)).length, packages: keys.length, rows: latest, malformed,
  };
}

// Draft to done in days; review rounds to approval; items per day (Business rules 4.1).
// the --check numbers line's own report (Business rules 4.2); a plan read without its reviews file is checked with none
export const checkedReport = (plan, all = [plan]) => { const p = plan.reviews ? plan : { ...plan, reviews: [] }; return checkPlan(p, all.map((x) => (x === plan ? p : x.reviews ? x : { ...x, reviews: [] }))).report; };
export function planMeasures(plan, reviews = plan.reviews ?? null, rep = checkedReport(plan)) {
  const draft = transition(plan, "draft"), done = lastTransition(plan, "done");
  const passes = plan.evidence.filter((e) => e.result === "pass");
  const c = completion(plan);
  const eff = effortTotals(plan);
  const baselined = plan.fm.baselined && plan.fm.baselined !== "none" ? plan.fm.baselined : null;
  const rounds = reviews === null ? null : baselined ? reviews.filter((r) => r.date <= baselined).length : null;
  const firstReady = reviews?.find((r) => r.verdict === "READY") ?? null;
  const span = passes.length ? Math.max(1, day(passes.at(-1).date) - day(passes[0].date)) : null;
  return {
    rep, rate: started(plan) ? rep.rate : null, completion: c,
    changes: rep.discoveredDesign, rework: rep.rework, reworkOf: rep.reworkOf,
    rounds, firstReadyBy: firstReady ? firstReady.reviewer : null,
    draftToDone: draft && done ? day(done.date) - day(draft.date) : null,
    perDay: span ? round1(c.now / span) : null,
    hours: eff.minutes === null ? null : eff.minutes / 60, tokensK: eff.tokensK, effort: eff,
    closed: done?.date ?? null,
  };
}

// Most-missed probes: the probes named by the plan's discovered and corrected amendments, most first.
export function missedProbes(plans) {
  const n = new Map();
  for (const p of plans) for (const a of p.amendments) if (COUNTED.has(a.kind)) {
    for (const x of String(a.layer).split(/[\s,]+/).filter((t) => /^\d{1,2}\.\d{1,2}$/.test(t))) n.set(x, (n.get(x) ?? 0) + designCount(a));
  }
  const key = (p) => p.split(".").map(Number);
  return [...n].sort((a, b) => b[1] - a[1] || key(a[0])[0] - key(b[0])[0] || key(a[0])[1] - key(b[0])[1]);
}
export const missedLine = (list) => list.map(([p, k]) => `${p} ×${k}`).join(", ");

// ---------------------------------------------------------------- charts (D7, D8, D9)

const W = 650, X0 = 52, X1 = 628;
const numbersTable = (caption, head, rows) => `<details class="nums"><summary>Show the numbers</summary><div class="tw"><table class="data"><caption>${esc(caption)}</caption><thead><tr>${head.map((h, k) => `<th scope="col"${k ? ' class="n"' : ""}>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, k) => (k ? `<td class="n">${c}</td>` : `<th scope="row">${c}</th>`)).join("")}</tr>`).join("")}</tbody></table></div></details>`;
const mark = (a, x, y, r = 7.5) => `<g class="mk k-${esc(a.kind)}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}"/><text x="${x.toFixed(1)}" y="${(y + 3.4).toFixed(1)}" text-anchor="middle">${esc(a.id.slice(1))}</text><title>${esc(`${a.id} · ${a.kind} · layer ${a.layer} · ${a.date}`)}</title></g>`;
export const chip = (kind) => `<span class="chip k-${esc(kind)}"><i></i>${esc(kind)}</span>`;
export const pill = (a) => `<span class="im k-${esc(a.kind)}">${esc(a.id)}</span>`;

// the days the plan's records span, first to last: `to` is the last day itself (release-0-3-2 A1)
function span(plan) {
  const ds = [...plan.transitions, ...plan.evidence, ...plan.notes, ...plan.versions].map((x) => x.date)
    .concat(plan.amendments.map((a) => a.date)).filter(Boolean).sort();
  if (!ds.length) return null;
  return { from: day(ds[0]), to: day(ds.at(-1)) };
}

// release-0-3-2 A1: records are dated by day, so each day is a band of the time axis — from its start to the
// next day's start — and a day's records sit at the band's centre. No record lands on the plot's edge, and the
// last day has width like any other.
export function dayBands(s, left, right) {
  const n = s.to - s.from + 1, w = (right - left) / n;
  const start = (date) => left + (day(date) - s.from) * w;
  return { n, w, left, right, start, centre: (date) => start(date) + w / 2 };
}
// Records of one day sit side by side, centred on the day and in their own order; a group too wide for its
// band stays centred on the day as far as the plot allows. Returns the centres; marks never overlap.
export function spread(radii, cx, left, right, gap = 2) {
  const total = radii.reduce((t, r) => t + 2 * r, 0) + gap * Math.max(0, radii.length - 1);
  let x = Math.min(Math.max(cx - total / 2, left), Math.max(left, right - total));
  return radii.map((r) => { const c = x + r; x += 2 * r + gap; return c; });
}
const plotAttrs = (x0, x1, y0, y1, b, s) => `data-plot="${x0} ${x1} ${y0} ${y1}" data-band="${b.left} ${b.w.toFixed(3)} ${isoDay(s.from)}"`;
// Map.groupBy is Node 21; dod runs on Node 20
const groupBy = (xs, f) => { const m = new Map(); for (const x of xs) { const k = f(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };
// the first and last day under their bands, kept inside the plot
function dayTicks(b, s, y, cls = "tick") {
  const at = (n) => Math.min(Math.max(b.left + (n - s.from + 0.5) * b.w, b.left + 36), b.right - 36);
  const days = s.to === s.from ? [s.from] : [s.from, s.to];
  return days.map((n) => `<text class="${cls}" x="${at(n).toFixed(1)}" y="${y}" text-anchor="middle">${isoDay(n)}</text>`).join("");
}

// D7: the series behind the signature chart, exported for the test
export function signatureData(plan) {
  const s = span(plan);
  const baselined = plan.fm.baselined && plan.fm.baselined !== "none" ? plan.fm.baselined : null;
  const predicted = baselined ? plan.baseline.length : plan.items.length;
  const dates = [...new Set([...(s ? [isoDay(s.from)] : []), ...plan.amendments.map((a) => a.date), ...plan.evidence.map((e) => e.date)])].sort();
  const rows = dates.map((d) => {
    const changes = plan.amendments.filter((a) => /* pmv-mutant:counted-kinds */COUNTED.has(a.kind) && a.date <= d).reduce((n, a) => n + designCount(a), 0);
    const last = new Map();
    for (const e of plan.evidence) if (e.date <= d) last.set(e.id, e.result);
    const verified = [...last.values()].filter((r) => r === "pass").length;
    return { date: d, predicted, observed: predicted + (baselined ? changes : 0), verified, marks: plan.amendments.filter((a) => a.date === d) };
  });
  return { span: s, baselined, predicted, rows, end: rows.length ? rows.at(-1).observed : predicted };
}

export function signatureChart(plan) {
  const d = signatureData(plan);
  if (!d.span) return `<p class="nr">${NOT_RECORDED} — the Log holds no dated line yet</p>`;
  const H = 260, Y0 = 18, Y1 = 214;
  // headroom: the marks and the "observed" label sit above the highest line and inside the plot (A1)
  const max = Math.max(5, Math.ceil(Math.max(d.end, plan.items.length, ...d.rows.map((r) => r.verified)) / 0.8 / 5) * 5);
  const b = dayBands(d.span, X0, X1), x = b.centre;
  const y = (v) => Y1 - (v / max) * (Y1 - Y0);
  const ready = transition(plan, "ready");
  const phase = ready ? `<rect class="phase" x="${X0}" y="${Y0}" width="${Math.max(0, Math.min(X1, x(ready.date)) - X0).toFixed(1)}" height="${Y1 - Y0}"/>` : "";
  const ticks = [0, max / 2, max].map((v) => `<line class="grid" x1="${X0}" x2="${X1}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="tick" x="${X0 - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${v}</text>`).join("");
  const xt = dayTicks(b, d.span, H - 22);
  // both lines step at the centre of the day a record is dated: the records give a count per day, not a slope (A1)
  let obs = `M${X0},${y(d.predicted).toFixed(1)}`, ver = `M${X0},${Y1}`;
  for (const r of d.rows) {
    const px = x(r.date).toFixed(1);
    obs += ` H${px} V${y(r.observed).toFixed(1)}`;
    ver += ` H${px} V${y(r.verified).toFixed(1)}`;
  }
  obs += ` H${X1}`;
  ver += ` H${X1} V${Y1} Z`;
  const placed = d.rows.flatMap((r) => { const cs = spread(r.marks.map(() => 7.5), x(r.date), X0, X1); return r.marks.map((a, k) => ({ a, x: cs[k], y: y(r.observed) - 14 })); });
  const marks = placed.map((m) => mark(m.a, m.x, m.y)).join("");
  // "observed N" sits on the end of the observed line, or at the left when marks are in its way (A1)
  const obsText = `observed ${d.end}`, obsY = y(d.end) - 8, obsW = 6.25 * obsText.length + 8;
  const obsRight = !placed.some((m) => m.x + 7.5 > X1 - obsW && Math.abs(m.y - obsY) < 18);
  const pre = d.baselined ? "" : " pre";
  const svg = `<figure class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="sig-t" ${plotAttrs(X0, X1, Y0, Y1, b, d.span)}><title id="sig-t">Predicted against observed: ${d.predicted} predicted, ${d.end} observed</title>${phase}${ticks}<path class="verified" d="${ver}"/><path class="observed" d="${obs}"/><line class="predicted${pre}" x1="${X0}" x2="${X1}" y1="${y(d.predicted).toFixed(1)}" y2="${y(d.predicted).toFixed(1)}"/>${marks}<text class="lbl halo" x="${X0 + 6}" y="${(y(d.predicted) + 16).toFixed(1)}">${d.baselined ? `baseline ${d.predicted}` : `draft ${d.predicted}`}</text><text class="lbl halo" x="${obsRight ? X1 - 4 : X0 + 6}" y="${obsY.toFixed(1)}"${obsRight ? " text-anchor=\"end\"" : ""}>${obsText}</text>${xt}</svg></figure>`;
  const legend = `<div class="legend"><span><i class="lg pred"></i>Predicted (the baseline)</span><span><i class="lg obs"></i>Observed design</span><span><i class="lg ver"></i>Verified items</span>${KINDS.filter((k) => plan.amendments.some((a) => a.kind === k)).map(chip).join("")}</div>`;
  const nums = numbersTable("Predicted against observed, by date", ["date", "predicted", "observed", "verified", "changes found"],
    d.rows.map((r) => [esc(r.date), r.predicted, r.observed, r.verified, r.marks.map(pill).join(" ") || "—"]));
  return svg + legend + nums;
}

// D8: one row per layer as layers.md names it, plus "no layer"
export function readLayerNames(file = LAYERS_MD) {
  const names = new Map();
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) { const h = line.match(/^## (\d{1,2})\. (.+?)\s*$/); if (h) names.set(Number(h[1]), h[2].replace(/\s*\*\(.*\)\*\s*$/, "")); }
  return names;
}
export function discoveryRows(plan, names) {
  const rows = [...names].sort((a, b) => a[0] - b[0]).map(([n, name]) => ({ n, name, marks: [] }));
  const none = { n: null, name: "no layer", marks: [] };
  for (const a of plan.amendments) {
    const m = String(a.layer).match(/^\s*(\d{1,2})(?:\.\d+)?\b/);
    const row = m ? rows.find((r) => r.n === Number(m[1])) : null;
    (row ?? none).marks.push(a);
  }
  return [...rows, none];
}
export function discoveryMap(plan, names) {
  const rows = discoveryRows(plan, names);
  const s = span(plan);
  if (!plan.amendments.length || !s) return `<p class="nr">No change has been recorded against this plan, so the map is empty.</p>`;
  const L = 240, RH = 22, H = rows.length * RH + 40;
  const b = dayBands(s, L, X1);
  const body = rows.map((r, k) => {
    const yy = 16 + k * RH;
    const byDay = groupBy(r.marks, (a) => a.date);
    return `<text class="lbl" x="${L - 10}" y="${yy + 4}" text-anchor="end">${esc(r.name)}</text><line class="grid" x1="${L}" x2="${X1}" y1="${yy}" y2="${yy}"/>`
      + [...byDay].map(([date, ms]) => { const cs = spread(ms.map(() => 7), b.centre(date), L, X1); return ms.map((a, i) => mark(a, cs[i], yy, 7)).join(""); }).join("");
  }).join("");
  const svg = `<figure class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="map-t" ${plotAttrs(L, X1, 0, H - 20, b, s)}><title id="map-t">Where the changes were found, by layer and date</title>${body}${dayTicks(b, s, H - 6)}</svg></figure>`;
  return svg + numbersTable("Changes by layer", ["layer", "changes", "which"], rows.filter((r) => r.marks.length).map((r) => [esc(r.name), r.marks.length, r.marks.map(pill).join(" ")]));
}

// D9: y = the most times any one of its items had been named, up to and including it; size = its distinct items
export function variationData(plan) {
  const seen = new Map();
  return [...plan.amendments].sort((a, b) => a.n - b.n).map((a) => {
    const ids = [...new Set(a.ops.map((o) => o.replace(/^[+~-]/, "")).filter((o) => /^D\d+$/.test(o)))];
    for (const id of ids) seen.set(id, (seen.get(id) ?? 0) + 1);
    const y = /* pmv-mutant:variation-y */ids.length ? Math.max(...ids.map((id) => seen.get(id))) : 0;
    return { id: a.id, kind: a.kind, date: a.date, layer: a.layer, y, size: Math.max(1, ids.length) };
  });
}
export function variationChart(plan) {
  const v = variationData(plan);
  const s = span(plan);
  if (!v.length || !s) return `<p class="nr">No change has been recorded, so nothing varied.</p>`;
  const H = 236, Y0 = 26, Y1 = 186;
  const max = Math.max(2, ...v.map((b) => b.y));
  const bands = dayBands(s, X0, X1);
  const y = (n) => Y1 - (n / max) * (Y1 - Y0);
  const rad = (b) => 6 + 2.5 * Math.min(b.size, 6);
  const dots = [...groupBy(v, (b) => `${b.date}|${b.y}`).values()].map((g) => { const cs = spread(g.map(rad), bands.centre(g[0].date), X0, X1); return g.map((b, i) => mark(b, cs[i], y(b.y), rad(b))).join(""); }).join("");
  const grid = Array.from({ length: max + 1 }, (_, k) => `<line class="grid" x1="${X0}" x2="${X1}" y1="${y(k).toFixed(1)}" y2="${y(k).toFixed(1)}"/><text class="tick" x="${X0 - 8}" y="${(y(k) + 4).toFixed(1)}" text-anchor="end">${k}</text>`).join("");
  const svg = `<figure class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="var-t" ${plotAttrs(X0, X1, Y0 - 22, Y1 + 22, bands, s)}><title id="var-t">How often each change touched items that had changed before</title>${grid}${dots}${dayTicks(bands, s, H - 8)}</svg></figure>`;
  return svg + numbersTable("Variation per change", ["change", "date", "times changed", "items touched"], v.map((b) => [pill(b), esc(b.date), b.y, b.size]));
}

// The rate across closed plans, the 75–90 % band shaded (dashboard and benchmark)
export function rateAcross(points) {
  if (!points.length) return `<p class="nr">${NOT_RECORDED} — no plan is done yet</p>`;
  const H = 220, Y0 = 16, Y1 = 180;
  const lo = Math.min(50, ...points.map((p) => p.rate));
  const x = (k) => (points.length === 1 ? (X0 + X1) / 2 : X0 + 8 + (k / (points.length - 1)) * (X1 - X0 - 16));
  const y = (r) => Y1 - ((r - lo) / (100 - lo)) * (Y1 - Y0);
  const line = points.map((p, k) => `${k ? "L" : "M"}${x(k).toFixed(1)},${y(p.rate).toFixed(1)}`).join(" ");
  const svg = `<figure class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="rate-t" data-plot="${X0} ${X1} ${Y0} ${Y1}"><title id="rate-t">Prediction rate of each done plan, in closing order</title><rect class="bandfill" x="${X0}" y="${y(RATE_TARGET).toFixed(1)}" width="${X1 - X0}" height="${(y(RATE_FLOOR) - y(RATE_TARGET)).toFixed(1)}"/>${[RATE_FLOOR, RATE_TARGET].map((r) => `<line class="ref" x1="${X0}" x2="${X1}" y1="${y(r).toFixed(1)}" y2="${y(r).toFixed(1)}"/><text class="tick" x="${X0 - 8}" y="${(y(r) + 4).toFixed(1)}" text-anchor="end">${r} %</text>`).join("")}${[lo, 100].map((r) => `<line class="grid" x1="${X0}" x2="${X1}" y1="${y(r).toFixed(1)}" y2="${y(r).toFixed(1)}"/><text class="tick" x="${X0 - 8}" y="${(y(r) + 4).toFixed(1)}" text-anchor="end">${r} %</text>`).join("")}<path class="trendline" d="${line}"/>${points.map((p, k) => `<circle class="pt${p.me ? " me" : ""}" cx="${x(k).toFixed(1)}" cy="${y(p.rate).toFixed(1)}" r="5"><title>${esc(`${p.label} · ${p.rate} %`)}</title></circle>`).join("")}</svg></figure>`;
  return svg + numbersTable("Prediction rate by plan", ["plan", "closed", "rate"], points.map((p) => [esc(p.label), esc(p.closed ?? ""), `${p.rate} %`]));
}

// ---------------------------------------------------------------- the KPI register (D10)

const scale = (v) => `<span class="sc" role="img" aria-label="${v} % against the floor ${RATE_FLOOR} % and the target ${RATE_TARGET} %"><span class="sc-f" style="--v:${Math.max(0, Math.min(100, v))}%"></span><span class="sc-t" style="--t:${RATE_FLOOR}%"></span><span class="sc-t" style="--t:${RATE_TARGET}%"></span></span><span class="sc-l">floor ${RATE_FLOOR} % · target ${RATE_TARGET} %</span>`;

export function kpiRows(plan, reviews = plan.reviews ?? null) {
  const m = planMeasures(plan, reviews);
  const r = m.rep;
  const eff = m.effort;
  const recorded = eff.recorded < eff.packages ? ` <span class="dim">${eff.recorded} of ${eff.packages} packages recorded</span>` : "";
  const byKind = KINDS.filter((k) => r[k]).map((k) => `${k} ${r[k]}`).join(" · ");
  const missed = missedProbes([plan]);
  return [
    { key: "rate", measure: "Prediction rate", value: m.rate === null ? (r.rate === null ? nr() : "n/a") : `${m.rate} %`, against: m.rate === null ? "" : scale(m.rate),
      meaning: m.rate === null ? "Scored once the build starts; before that there is nothing to compare." : `Of the design that turned out to be needed, the share the plan foresaw: ${r.baseline} baseline items against ${r.discoveredDesign} design ${r.discoveredDesign === 1 ? "change" : "changes"} found later.` },
    { key: "completion", measure: "Completion", value: `${m.completion.base}/${m.completion.baseOf} · ${m.completion.now}/${m.completion.nowOf}`, against: "",
      meaning: "Verified items against the frozen baseline, then against the plan as it stands now." },
    { key: "changes", measure: "Design changes by kind", value: String(r.discoveredDesign), against: esc(byKind || "none"),
      meaning: "Design changes that count against the plan (discovered and corrected); the amendments of every kind are listed beside it." },
    { key: "rework", measure: "Rework", value: `${m.rework} of ${m.reworkOf}`, against: "",
      meaning: "Misses that corrected an earlier amendment rather than the plan." },
    { key: "rounds", measure: "Review rounds to approval", value: m.rounds === null ? nr() : String(m.rounds), against: m.firstReadyBy ? `first READY by ${esc(m.firstReadyBy)}` : "",
      meaning: "Reviews dated on or before the baseline was frozen." },
    { key: "draft-to-done", measure: "Draft to done", value: m.draftToDone === null ? "n/a" : plural(m.draftToDone, "day"), against: "",
      meaning: "From the draft line to the done line of the Log." },
    { key: "per-day", measure: "Items verified per day", value: m.perDay === null ? nr() : String(m.perDay), against: "",
      meaning: "Current items verified, over the days from the first to the last pass line (at least one)." },
    { key: "missed", measure: "Most-missed probes", value: missed.length ? esc(missedLine(missed.slice(0, 4))) : "none", against: "",
      meaning: "The probes the discovered and corrected amendments name, most first." },
    { key: "hours", measure: "Hours", value: /* pmv-mutant:not-recorded */eff.minutes === null ? nr() : `${esc(fmtMin(eff.minutes))}${tag(eff.minutesHow)}${recorded}`, against: "",
      meaning: "Active time from the effort lines: gaps longer than ten minutes are left out." },
    { key: "tokens", measure: "Tokens", value: eff.tokensK === null ? nr() : `${esc(fmtK(eff.tokensK))}${tag(eff.tokensHow)}${recorded}`, against: "",
      meaning: "Input, cache creation and output tokens from the effort lines; cache reads apart." },
  ];
}

export function kpiRegister(plan, reviews = plan.reviews ?? null) {
  const rows = kpiRows(plan, reviews);
  return `<div class="tw"><table class="data kpi"><caption>Performance and KPIs</caption><thead><tr><th scope="col">Measure</th><th scope="col">Value</th><th scope="col">Against target</th><th scope="col">What it means</th></tr></thead><tbody>${rows.map((r) => `<tr data-kpi="${r.key}"><th scope="row">${esc(r.measure)}</th><td class="v">${r.value}</td><td class="a">${r.against}</td><td class="m">${esc(r.meaning)}</td></tr>`).join("")}</tbody></table></div>`;
}

export function effortTable(plan) {
  const eff = effortTotals(plan);
  const leaves = plan.packages.filter((p) => p.leaf);
  const list = leaves.length ? leaves.map((p) => ({ id: p.id, title: p.title })) : [{ id: "plan", title: "the whole plan" }];
  const rows = list.map((p) => {
    const e = eff.rows.get(p.id);
    return `<tr><th scope="row"><span class="mono">${esc(p.id)}</span> ${inl(p.title)}</th><td class="n">${e ? `${esc(fmtMin(e.minutes))}${tag(e.minutesHow)}` : nr()}</td><td class="n">${e && e.tokensK !== null ? `${esc(fmtK(e.tokensK))}${tag(e.tokensHow)}` : nr()}</td><td class="n">${e ? esc(e.date) : ""}</td></tr>`;
  });
  const bad = eff.malformed.length ? `<h3>Effort lines not read</h3><ul class="log">${eff.malformed.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : "";
  return `<div class="tw"><table class="data"><caption>Effort per work package</caption><thead><tr><th scope="col">Package</th><th scope="col" class="n">Active time</th><th scope="col" class="n">Tokens</th><th scope="col" class="n">Line dated</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>${bad}`;
}

// ---------------------------------------------------------------- the schedule (D11, Business rules 4.3)

// The default reader: one git call for the shas, one for the date the plan file was added; fixed arguments, no
// shell, a 10 s timeout, and every sha matched to SHA_RE before it is passed (Security 10.1).
export function gitCommitTimes(repo, { run = spawnSync } = {}) {
  return (shas, { addedFile = null } = {}) => {
    const ok = shas.filter((s) => /* pmv-mutant:sha-pattern */SHA_RE.test(s));
    const times = new Map();
    const call = (args) => run("git", ["-C", repo, ...args], { shell: false, timeout: GIT_TIMEOUT, encoding: "utf8", windowsHide: true });
    if (ok.length) {
      const r = call(["show", "-s", "--format=%H %cI", ...ok]);
      if (r.error?.code === "ENOENT") return { error: "git is not installed" };
      if (r.error?.code === "ETIMEDOUT" || r.signal) return { error: "git did not answer within 10 s" };
      if (r.error) return { error: `git could not be run (${r.error.code ?? "error"})` };
      if (r.status !== 0) return { error: `git exited ${r.status}` };
      const lines = String(r.stdout).trim().split(/\r?\n/).map((l) => l.split(" "));
      for (const s of ok) { const hit = lines.find(([full]) => full && full.startsWith(s)); if (hit) times.set(s, hit[1]); }
    }
    let added = null;
    if (addedFile) {
      const r = call(["log", "--diff-filter=A", "--format=%cI", "-1", "--", addedFile]);
      if (!r.error && r.status === 0) added = String(r.stdout).trim() || null;
    }
    return { times, added };
  };
}

const offsetOf = (iso) => (String(iso).match(/([+-]\d{2}:\d{2}|Z)$/) ?? [])[1] ?? "Z";
const local = (ms, off) => {
  const sign = off === "Z" ? 0 : off[0] === "-" ? -1 : 1;
  const mins = off === "Z" ? 0 : sign * (Number(off.slice(1, 3)) * 60 + Number(off.slice(4, 6)));
  return new Date(ms + mins * 60_000).toISOString().slice(0, 16).replace("T", " ");
};

export function schedule(plan, { commitTimes = gitCommitTimes(dirname(plan.file)) } = {}) {
  const leaves = plan.packages.filter((p) => p.leaf);
  const groups = plan.packages.filter((p) => !p.leaf);
  const base = [...plan.notes].reverse().map((n) => n.text.match(/^base ([0-9a-f]{7,40})\s*$/)).find(Boolean)?.[1] ?? null;
  const lastPass = new Map();
  for (const e of plan.evidence) if (e.result === "pass") lastPass.set(e.id, e);
  const ends = leaves.map((p) => {
    const ev = p.items.map((d) => lastPass.get(d)).filter(Boolean);
    return { p, ev, done: ev.length === p.items.length && ev.length > 0 };
  });
  let reason = null, times = new Map(), added = null;
  if (!base) reason = "the Log names no base commit";
  const bad = ends.flatMap((x) => x.ev).find((e) => !SHA_RE.test(e.commit));
  if (!reason && bad) reason = `a pass line of ${bad.id} names no commit`;
  if (!reason) {
    const shas = [...new Set([base, ...ends.flatMap((x) => x.ev.map((e) => e.commit))])];
    const r = commitTimes(shas, { addedFile: plan.file });
    if (!r || r.error) reason = r?.error ?? "git gave no answer";
    else {
      times = r.times; added = r.added ?? null;
      const missing = shas.find((s) => !times.has(s));
      if (missing) reason = `git does not know ${missing}`;
      else if (!added) reason = "git does not say when the plan file was added";
    }
  }
  const startT = transition(plan, "in-progress"), draftT = transition(plan, "draft");
  const hours = !reason;
  const at = (e) => (hours ? Date.parse(times.get(e.commit)) : day(e.date));
  const done = ends.filter((x) => x.done).map((x) => ({ ...x, end: Math.max(...x.ev.map(at)) })).sort((a, b) => a.end - b.end);
  const buildStart = hours ? Date.parse(times.get(base)) : day(startT?.date ?? draftT?.date ?? "1970-01-01");
  const planStart = hours ? Math.min(Date.parse(added), buildStart) : day(draftT?.date ?? startT?.date ?? "1970-01-01");
  const bars = new Map();
  let prev = buildStart;
  for (const x of done) { bars.set(x.p.id, { from: prev, to: x.end }); prev = Math.max(prev, x.end); }
  const off = hours ? offsetOf(times.get(base)) : null;
  return { hours, reason, off, planStart, buildStart, bars, leaves, groups, finish: done.length ? done.at(-1).end : buildStart, fmt: (t) => (hours ? local(t, off) : isoDay(t)) };
}

export function ganttChart(plan, opts = {}) {
  const s = schedule(plan, opts);
  if (!s.leaves.length) return `<p class="nr">This plan has no ## Work breakdown, so there is no schedule.</p>`;
  const t0 = s.planStart, t1 = Math.max(s.finish, s.buildStart + (s.hours ? 3_600_000 : 1));
  const pct = (t) => ((t - t0) / (t1 - t0)) * 100;
  const dur = (a, b) => (s.hours ? fmtMin((b - a) / 60_000) : plural(Math.round(b - a) + 1, "day"));
  const bar = (a, b) => `<span class="g-bar" style="left:${pct(a).toFixed(2)}%;width:${(pct(b) - pct(a)).toFixed(2)}%"></span>`;
  const rows = [`<div class="g-row g-head"><span class="g-lab">Package</span><span class="g-track g-scale"><span style="left:0">${esc(s.fmt(t0))}</span><span style="left:100%">${esc(s.fmt(t1))}</span></span><span class="g-num">Duration</span></div>`,
    `<div class="g-row g-plan"><span class="g-lab">Planning and review</span><span class="g-track">${bar(t0, s.buildStart)}</span><span class="g-num">${esc(dur(t0, s.buildStart))}</span></div>`];
  for (const p of [...s.groups, ...s.leaves].sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }))) {
    if (!p.leaf) { rows.push(`<div class="g-row g-group"><span class="g-lab"><span class="mono">${esc(p.id)}</span> ${inl(p.title)}</span><span class="g-track"></span><span class="g-num"></span></div>`); continue; }
    const b = s.bars.get(p.id);
    rows.push(`<div class="g-row" data-pkg="${esc(p.id)}"${b ? ` data-from="${esc(s.fmt(b.from))}" data-to="${esc(s.fmt(b.to))}"` : ""}><span class="g-lab"><span class="mono">${esc(p.id)}</span> ${inl(p.title)}</span><span class="g-track">${b ? bar(b.from, b.to) : ""}</span><span class="g-num">${b ? esc(dur(b.from, b.to)) : "not finished"}</span></div>`);
  }
  const caption = s.hours ? `Times are UTC${s.off === "Z" ? "" : s.off.replace("-", "−")}, from the commits of each package's last pass lines.` : `Times from dates: ${s.reason}.`;
  return `<div class="gantt">${rows.join("")}</div><p class="fine sched-note">${esc(caption)}</p>`;
}

// ---------------------------------------------------------------- versions (D12)

export function versionRows(plan) {
  const out = [];
  const sha = (t) => (String(t ?? "").match(/\b([0-9a-f]{7,40})\b/) ?? [])[1] ?? null;
  for (const t of plan.transitions) {
    if (t.status === "draft") out.push({ date: t.date, seq: t.seq, label: "draft", what: "The plan was written.", commit: null });
    else if (t.status === "ready") out.push({ date: t.date, seq: t.seq, label: "baseline", what: "The baseline was frozen.", commit: null, base: true });
    else if (t.status === "in-progress" && /reopen/.test(t.detail)) out.push({ date: t.date, seq: t.seq, label: "reopen", what: `Reopened (${t.detail}).`, commit: null });
    else if (t.status === "done") out.push({ date: t.date, seq: t.seq, label: "done", what: "Closed.", commit: null });
  }
  for (const v of plan.versions) out.push({ date: v.date, seq: v.seq, label: `v${v.label}`, what: v.text || "A version was declared.", commit: sha(v.text) });
  for (const a of plan.amendments) out.push({ date: a.date, seq: Number.MAX_SAFE_INTEGER, n: a.n, label: a.id, what: a.why, commit: null, am: a });
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.seq - b.seq || (a.n ?? 0) - (b.n ?? 0));
}
export function versionsList(plan) {
  const rows = versionRows(plan);
  if (!rows.length) return `<p class="nr">No version has been recorded yet.</p>`;
  return `<ol class="tideline">${rows.map((v) => `<li class="${v.base ? "base" : v.am ? `amv k-${esc(v.am.kind)}` : ""}"><span class="tl-t">${esc(v.date)}</span><span class="tl-r">${esc(v.label)}</span><span class="tl-w">${inl(v.what)}</span>${v.commit ? `<code class="tl-s">${esc(v.commit)}</code>` : "<span></span>"}</li>`).join("")}</ol>`;
}

// ---------------------------------------------------------------- store pages (D14, D16, D18)

// A failure of a page's context: one line, exit 1. dod-wbs.mjs prints it as its own (D27).
export class PageError extends Error { constructor(line, code = 1) { super(line); this.line = line; this.code = code; } }

const NOTICE_PLAN = "This page holds your plan's own text — share it as you would the plan.";
const NOTICE_STORE = "This page holds your plans' own text and names — share it as you would the plans.";
export const NOTICE_BENCH = "This page names your projects. It stays on your machine; dod keeps no record of who opens or shares it.";
export { NOTICE_PLAN, NOTICE_STORE };

export const panel = (title, lead, body) => `<section class="panel"><div class="ph"><h2>${esc(title)}</h2>${lead ? `<p>${esc(lead)}</p>` : ""}</div>${body}</section>`;
export const tableOf = (caption, head, rows, { numeric = [] } = {}) => `<div class="tw"><table class="data"><caption>${esc(caption)}</caption><thead><tr>${head.map((h, k) => `<th scope="col"${numeric.includes(k) ? ' class="n"' : ""}>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, k) => (k === 0 ? `<th scope="row">${c}</th>` : `<td${numeric.includes(k) ? ' class="n"' : ""}>${c}</td>`)).join("")}</tr>`).join("")}</tbody></table></div>`;
const cellOr = (v, f = (x) => String(x)) => (v === null || v === undefined ? nr() : esc(f(v)));
const pct = (v) => `${v} %`;

// One summary row per plan — what the dashboard, the audit and the benchmark all read. Built from one parsed plan,
// which can then be dropped (D20: the benchmark keeps rows, never plans).
export function summaryRow(plan, all = [plan]) {
  const c = checkPlan(plan.reviews ? plan : { ...plan, reviews: [] }, all.map((x) => (x.reviews ? x : { ...x, reviews: [] })));
  const m = planMeasures(plan, plan.reviews ?? null, c.report);
  return {
    slug: plan.slug, title: plan.fm.title ?? plan.slug, status: plan.fm.status ?? "?", size: plan.fm.size ?? "?", kind: plan.kind,
    created: plan.fm.created ?? null, closed: m.closed, done: plan.fm.status === "done",
    rate: m.rate, baseline: m.rep.baseline, changes: m.changes, rework: m.rework, reworkOf: m.reworkOf, kinds: Object.fromEntries(KINDS.map((k) => [k, m.rep[k]])),
    completion: m.completion, rounds: m.rounds, firstReadyBy: m.firstReadyBy, draftToDone: m.draftToDone, perDay: m.perDay,
    hours: m.hours, tokensK: m.tokensK, problems: c.problems.length, warnings: c.warnings.length,
    lastLog: [...plan.transitions, ...plan.evidence, ...plan.notes, ...plan.versions].map((x) => x.date).sort().at(-1) ?? null,
    report: (plan.sections.Report ?? []).some((l) => l.trim()), missed: missedProbes([plan]),
  };
}

// The numeric measures every summary covers (D15), in the order the pages show them
export const MEASURES = [
  ["rate", "Prediction rate", " %"], ["changes", "Design changes", ""], ["rework", "Rework", ""], ["rounds", "Review rounds", ""],
  ["draftToDone", "Draft to done (days)", ""], ["perDay", "Items verified per day", ""], ["hours", "Hours", ""], ["tokensK", "Tokens (k)", ""],
];
export const summaries = (rows) => Object.fromEntries(MEASURES.map(([k]) => [k, summarise(rows.filter((r) => r.done).map((r) => r[k]))]));
const summaryTable = (caption, s) => tableOf(caption, ["Measure", "Mean · median", "Plans counted"],
  MEASURES.map(([k, label, unit]) => [esc(label), summaryCell(s[k], unit), String(s[k].n)]), { numeric: [2] });

const plansTable = (rows, { project = false } = {}) => tableOf("Every plan", [...(project ? ["Project"] : []), "Plan", "Status", "Size", "Kind", "Verified", "Rate", "Rounds", "Draft to done", "Hours", "Tokens"],
  rows.map((r) => [...(project ? [esc(r.project)] : []), `<span class="mono">${esc(r.slug)}</span> ${esc(r.title)}`, esc(r.status), esc(r.size), esc(r.kind),
    `${r.completion.now}/${r.completion.nowOf}`, r.rate === null ? (r.status === "done" ? nr() : "n/a") : pct(r.rate), cellOr(r.rounds),
    r.draftToDone === null ? "n/a" : esc(plural(r.draftToDone, "day")), r.hours === null ? nr() : esc(fmtMin(r.hours * 60)), r.tokensK === null ? nr() : esc(fmtK(r.tokensK))]));
const closingOrder = (rows) => rows.filter((r) => r.done && r.rate !== null).sort((a, b) => String(a.closed).localeCompare(String(b.closed)) || a.slug.localeCompare(b.slug));

export function readProfile(dir) { try { return readFileSync(join(dir, "profile.md"), "utf8"); } catch { return ""; } }

export function renderDashboard({ dir, plans, profile = "", storeName = "docs/dod" }) {
  const rows = plans.map((p) => summaryRow(p, plans));
  const done = rows.filter((r) => r.done);
  const s = summaries(rows);
  const hist = [...missHistory(plans, profile)].sort((a, b) => b[1].plans - a[1].plans || a[0].localeCompare(b[0], "en", { numeric: true }));
  const kinds = Object.fromEntries(KINDS.map((k) => [k, rows.reduce((n, r) => n + r.kinds[k], 0)]));
  const empty = `<p class="nr">no plans yet — run <code>/dod plan</code> to write the first one</p>`;
  const tabs = [{ id: "overview", label: "Overview" }, { id: "plans", label: "Plans", count: rows.length }, { id: "analysis", label: "Analysis" }, { id: "effort", label: "Effort" }];
  const panels = {
    overview: rows.length ? `<div class="lead"><p class="dek">${esc(`${plural(rows.length, "plan")} in this store, ${done.length} done.`)}</p><div class="story"><p>${esc(s.rate.n ? `Across the done plans the prediction rate averages ${round1(s.rate.mean)} % (median ${round1(s.rate.median)} %, ${plural(s.rate.n, "plan")}).` : "No plan is done yet, so there is no rate to average.")}</p></div></div>`
      + panel("Prediction rate across the store", "Each done plan in closing order; the band is the 75–90 % range between the floor and the target.", rateAcross(closingOrder(rows).map((r) => ({ label: r.slug, rate: r.rate, closed: r.closed }))))
      + panel("Averages over the done plans", "Mean and median; a plan whose measure is not recorded is left out of that measure and the count says so.", summaryTable("Mean and median per measure", s)) : panel("Overview", "", empty),
    plans: panel("Plans", "Every plan in the store, open and done.", rows.length ? plansTable(rows) : empty),
    analysis: panel("Most-missed probes across the store", "Probes the done plans' discovered and corrected amendments named in two or more plans, and the profile's own probes.",
      hist.length ? tableOf("Miss history", ["Probe", "Plans that missed it", "From the profile"], hist.map(([p, h]) => [esc(p), String(h.plans), h.profile ? "yes" : ""]), { numeric: [1] }) : `<p class="nr">none yet</p>`)
      + panel("Design changes by kind", "Every amendment of every plan, summed.", tableOf("Changes by kind", ["Kind", "Amendments"], KINDS.map((k) => [chip(k), String(kinds[k])]), { numeric: [1] })),
    effort: panel("Effort", "Hours and tokens from each plan's effort lines; plans without them say not recorded.",
      rows.length ? tableOf("Effort per plan", ["Plan", "Hours", "Tokens"], rows.map((r) => [`<span class="mono">${esc(r.slug)}</span>`, r.hours === null ? nr() : esc(fmtMin(r.hours * 60)), r.tokensK === null ? nr() : esc(fmtK(r.tokensK))]), { numeric: [1, 2] }) : empty),
  };
  return pageShell({ title: `${storeName} · dod dashboard`, crumb: `dod · ${storeName} · dashboard`, heading: "Project dashboard", state: `<span>${esc(plural(rows.length, "plan"))}</span><span>${esc(`${done.length} done`)}</span>`, notice: NOTICE_STORE, tabs, panels, label: "Dashboard sections" });
}

// ---------------------------------------------------------------- the self-audit (D16, D17, D18)

export const PRIVATE = [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, /[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s<>]+/i, /\/(?:home|Users)\/[^/\s<>]+/];

export function issueBlock(rows, { project = "Project 1", version = "unknown", rubric = "2" } = {}) {
  const order = [...rows].sort((a, b) => (a.done === b.done ? 0 : a.done ? -1 : 1) || String(a.closed ?? a.created).localeCompare(String(b.closed ?? b.created)) || a.slug.localeCompare(b.slug));
  const dates = rows.flatMap((r) => [r.created, r.lastLog]).filter(Boolean).sort();
  const reviewers = [...new Set(rows.map((r) => r.firstReadyBy).filter(Boolean))];
  const missed = new Map();
  for (const r of rows) if (r.done) for (const [p, k] of r.missed) missed.set(p, (missed.get(p) ?? 0) + k);
  const missedList = [...missed].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en", { numeric: true }));
  return [
    `**Project and stack:** ${project}`,
    `**dod version and rubric:** ${version}, rubric ${rubric}`,
    `**Dates covered:** ${dates.length ? `${dates[0]} to ${dates.at(-1)}` : "not recorded"}`,
    `**Reviewer used:** ${reviewers.length ? reviewers.join(", ") : "not recorded"}`,
    "", "**Numbers**", "", FIELD_AUDIT_HEADER, "|---|---|---|---|---|---|---|---|",
    ...order.map((r, k) => `| Plan ${k + 1} | ${r.size} | ${r.status} | ${r.baseline} | ${r.rounds ?? "not recorded"} | ${r.firstReadyBy ?? "not recorded"} | ${r.changes} | ${r.rate === null ? "n/a" : `${r.rate} %`} |`),
    "", "**Missed probes**", "", missedList.length ? missedLine(missedList) : "none",
  ].join("\n");
}

// D18: the block is checked before it is shown; a block that would carry a name is withheld, never shown
export function issueLeaks(block, rows, folder) {
  const needles = { folder: folder ?? "" };
  rows.forEach((r, k) => { needles[`slug ${k + 1}`] = r.slug; needles[`title ${k + 1}`] = r.title; });
  const hits = /* pmv-mutant:leak-scan */scanForLeaks(block, needles);
  for (const re of PRIVATE) if (re.test(block)) hits.push("a path or an e-mail");
  return hits;
}

export const skillVersion = () => { try { return (readFileSync(join(SKILL_DIR, "SKILL.md"), "utf8").match(/^\s*version:\s*"?([0-9][^"\s]*)"?/m) ?? [])[1] ?? "unknown"; } catch { return "unknown"; } };

export function renderAudit({ dir, plans, indexFresh, today, folder, storeName = "docs/dod", version = skillVersion() }) {
  const rows = plans.map((p) => summaryRow(p, plans));
  const age = (d) => (d ? Math.max(0, day(today) - day(d)) : null);
  const open = rows.filter((r) => !["done", "cancelled", "superseded"].includes(r.status));
  const health = rows.length ? tableOf("Each plan's check", ["Plan", "Status", "Problems", "Warnings", "Days since its last Log line", "Report"],
    rows.map((r) => [`<span class="mono">${esc(r.slug)}</span>`, esc(r.status), `<span class="${r.problems ? "bad" : ""}">${r.problems}</span>`, String(r.warnings),
      open.includes(r) ? cellOr(age(r.lastLog)) : "", r.done ? (r.report ? "written" : `<span class="bad">missing</span>`) : ""]), { numeric: [2, 3, 4] }) : `<p class="nr">no plans yet</p>`;
  const block = issueBlock(rows, { version, rubric: "2" });
  const leaks = issueLeaks(block, rows, folder);
  const issue = leaks.length
    ? `<p class="bad">The issue block was withheld: it would have carried ${esc(plural(leaks.length, "name"))}. Nothing was shown.</p>`
    : `<p class="fine">Copy this into the “Field audit” issue form. It holds numbers only — the plans are numbered, not named.</p><pre class="issue">${esc(block)}</pre>`;
  const tabs = [{ id: "health", label: "Health" }, { id: "issue", label: "Field audit issue" }];
  const panels = {
    health: `<p class="notice">${esc(NOTICE_STORE)}</p>` + panel("Health", "Each plan's --check counts, open plans' age, and done plans without a report.",
      `<dl class="glance"><div><dt>Index</dt><dd class="${indexFresh ? "ok" : "bad"}">${indexFresh ? "fresh" : "stale or missing — run dod-index.mjs"}</dd></div><div><dt>Plans</dt><dd>${rows.length}</dd></div><div><dt>Problems</dt><dd>${rows.reduce((n, r) => n + r.problems, 0)}</dd></div><div><dt>Open</dt><dd>${open.length}</dd></div></dl>${health}`),
    issue: panel("Field audit issue", "The numbers, the missed probes and a ready-to-paste block for the issue form.", issue),
  };
  return pageShell({ title: `${storeName} · dod self-audit`, crumb: `dod · ${storeName} · self-audit`, heading: "Self-audit", state: `<span>${esc(plural(rows.length, "plan"))}</span><span>index ${indexFresh ? "fresh" : "stale"}</span>`, tabs, panels, label: "Self-audit sections" });
}

// ---------------------------------------------------------------- the benchmark walk (D19, D20)

const inside = (realRoot, real) => real === realRoot || real.startsWith(realRoot.endsWith(sep) ? realRoot : realRoot + sep);
const relName = (root, p) => (relative(root, p).split(sep).join("/") || ".");
const isPlanText = (t) => /^---\r?\n(?:[^\n]*\n)*?dod:\s*\S/.test(t.slice(0, 4096));

// The walk: folders only, links never followed, the skip rules applied by name. Returns candidate projects and
// what was skipped; reading happens in benchmarkRows, one plan at a time.
export function walkProjects(root, { depth = BENCH_DEPTH, maxProjects = MAX_PROJECTS } = {}) {
  const realRoot = realpathSync(root);
  const projects = [], skipped = [];
  let stopped = null;
  const consider = (folder) => {
    let store;
    try { store = resolveStore(null, folder); }
    catch { skipped.push({ path: relName(root, folder), reason: "its instruction files name different stores" }); return; }
    if (!existsSync(store)) return;
    let real;
    try { real = realpathSync(store); } catch { skipped.push({ path: relName(root, folder), reason: "its store cannot be read" }); return; }
    if (/* pmv-mutant:contain */!inside(realRoot, real)) { skipped.push({ path: relName(root, folder), reason: "its store is outside the folder" }); return; }
    let names;
    try { names = readdirSync(store); } catch { skipped.push({ path: relName(root, folder), reason: "its store cannot be read" }); return; }
    const files = names.filter((f) => f.endsWith(".md") && f !== "README.md" && f !== "profile.md" && !f.endsWith(".reviews.md")).sort();
    if (!files.some((f) => { try { return isPlanText(readFileSync(join(store, f), "utf8")); } catch { return false; } })) return;
    if (/* pmv-mutant:limits */projects.length >= maxProjects) { stopped ??= `${maxProjects} projects`; return; }
    projects.push({ name: relName(root, folder), folder, store, files });
  };
  const visit = (folder, d) => {
    if (stopped) return;
    consider(folder);
    let ents;
    try { ents = readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)); }
    catch { skipped.push({ path: relName(root, folder), reason: "cannot be listed" }); return; }
    const dirs = [];
    for (const e of ents) {
      const full = join(folder, e.name);
      let st;
      try { st = lstatSync(full); } catch { continue; }
      if (/* pmv-mutant:no-links */st.isSymbolicLink()) { skipped.push({ path: relName(root, full), reason: "a link — not followed" }); continue; }
      if (!st.isDirectory()) continue;
      if (/* pmv-mutant:skip-rules */e.name === "node_modules") { skipped.push({ path: relName(root, full), reason: "node_modules" }); continue; }
      if (e.name.startsWith(".")) { skipped.push({ path: relName(root, full), reason: "a hidden folder" }); continue; }
      dirs.push(full);
    }
    if (d >= depth) { if (dirs.length) skipped.push({ path: relName(root, folder), reason: `not searched below depth ${depth}` }); return; }
    for (const full of dirs) visit(full, d + 1);
  };
  visit(root, 0);
  return { realRoot, projects, skipped, stopped };
}

// Read each project's plans one at a time, keeping only the summary row (D20). `between` runs after the walk and
// before the reads — the selftest's window for a folder swapped for a link.
export function benchmarkRows(root, { maxPlans = MAX_PLANS, between = null, onPlan = null, ...walkOpts } = {}) {
  const w = walkProjects(root, walkOpts);
  between?.(w);
  const out = { projects: [], skipped: [...w.skipped], stopped: w.stopped, plans: 0 };
  const fresh = (p) => { try { return inside(w.realRoot, realpathSync(p)); } catch { return false; } };
  for (const pr of w.projects) {
    if (out.stopped && out.stopped.endsWith("plans")) break;
    if (!fresh(pr.store)) { out.skipped.push({ path: pr.name, reason: "moved outside the folder" }); continue; }
    const rows = [];
    for (const f of pr.files) {
      if (/* pmv-mutant:plan-limit */out.plans >= maxPlans) { out.stopped = `${maxPlans} plans`; break; }
      const file = join(pr.store, f);
      if (!fresh(file)) { out.skipped.push({ path: `${pr.name}/${f}`, reason: "moved outside the folder" }); continue; }
      let text;
      try { const d = decodePlan(readFileSync(file)); if (d.text === undefined) throw new Error(d.fault); text = d.text; }
      catch { out.skipped.push({ path: `${pr.name}/${f}`, reason: "cannot be read" }); continue; }
      if (!text.startsWith("---")) continue;
      const plan = parsePlan(text, file);
      if (plan.parseErrors.length) { out.skipped.push({ path: `${pr.name}/${f}`, reason: "does not parse" }); continue; }
      const rf = join(pr.store, `${plan.slug}.reviews.md`);
      plan.reviews = null;
      if (existsSync(rf) && fresh(rf)) { try { plan.reviews = parseReviews(readFileSync(rf, "utf8")); } catch { plan.reviews = null; } }
      rows.push({ ...summaryRow(plan), project: pr.name });
      out.plans++;
      onPlan?.(out.plans);
    }
    out.projects.push({ name: pr.name, rows });
  }
  return out;
}

export function renderBenchmark({ root, projects, skipped, stopped, rootName = "." }) {
  const all = projects.flatMap((p) => p.rows);
  const s = summaries(all);
  const stop = stopped ? `<p class="bad">${esc(`stopped at the limit of ${stopped}`)}</p>` : "";
  const tabs = [{ id: "overview", label: "Overview" }, { id: "projects", label: "Projects", count: projects.length }, { id: "plans", label: "Plans", count: all.length }, { id: "skipped", label: "Skipped", count: skipped.length }];
  const projRows = MEASURES.map(([k, label, unit]) => [esc(label), ...projects.map((p) => summaryCell(summarise(p.rows.filter((r) => r.done).map((r) => r[k])), unit)), summaryCell(s[k], unit)]);
  const panels = {
    overview: `<div class="lead"><p class="dek">${esc(`${plural(projects.length, "project")}, ${plural(all.length, "plan")}, ${all.filter((r) => r.done).length} done.`)}</p><div class="story"><p>${esc(s.rate.n ? `Across every done plan the prediction rate averages ${round1(s.rate.mean)} %, median ${round1(s.rate.median)} % (${plural(s.rate.n, "plan")}).` : "No plan is done yet, so there is nothing to compare.")}</p></div></div>${stop}`
      + panel("Prediction rate of every done plan", "In closing order, across all projects; the band is 75–90 %.", rateAcross(closingOrder(all).map((r) => ({ label: `${r.project} · ${r.slug}`, rate: r.rate, closed: r.closed }))))
      + panel("Overall mean and median", "Over the done plans of every project.", summaryTable("Overall", s)),
    projects: panel("Per project", "Mean · median over each project's done plans; the last column is every project together.",
      projects.length ? tableOf("Projects compared", ["Measure", ...projects.map((p) => p.name), "All projects"], projRows) : `<p class="nr">no project found</p>`),
    plans: panel("Every plan", "One row per plan, open and done.", all.length ? plansTable(all, { project: true }) : `<p class="nr">no plans</p>`),
    skipped: panel("Skipped", "Folders the walk did not search or could not read, with the reason.",
      skipped.length ? tableOf("Skipped folders", ["Folder", "Reason"], skipped.map((x) => [esc(x.path), esc(x.reason)])) : `<p class="nr">nothing was skipped</p>`) + stop,
  };
  return pageShell({ title: "dod benchmark", crumb: `dod · benchmark · ${rootName}`, heading: "Benchmark across projects", state: `<span>${esc(plural(projects.length, "project"))}</span><span>${esc(plural(all.length, "plan"))}</span>`, notice: NOTICE_BENCH, tabs, panels, label: "Benchmark sections" });
}

// ---------------------------------------------------------------- the store pages' entries (Business rules 4.5)

const storeContext = (dir) => {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new PageError(`wbs: no plan store at ${plainText(dir)}`);
  const all = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".md") && x !== "README.md" && x !== "profile.md" && !x.endsWith(".reviews.md")).sort()) {
    const d = decodePlan(readFileSync(join(dir, f)));
    if (d.text === undefined || !d.text.startsWith("---")) continue;
    const p = parsePlan(d.text, join(dir, f));
    const rf = join(dir, `${p.slug}.reviews.md`);
    p.reviews = existsSync(rf) ? parseReviews(readFileSync(rf, "utf8")) : null;
    all.push(p);
  }
  return all;
};
const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

registerRenderer("dashboard", {
  render: renderDashboard,
  context: ({ dir }) => { const plans = storeContext(dir); return { ctx: { dir, plans, profile: readProfile(dir) }, target: join(dir, "dod-dashboard.html"), container: dir, count: plans.length, summary: `${plans.filter((p) => p.fm.status === "done").length} done`, skipped: 0 }; },
  fixture: () => ({ dir: "<memory>", plans: [hostilePlan()], profile: "" }),
});
registerRenderer("audit", {
  render: renderAudit,
  context: ({ dir }) => {
    const plans = storeContext(dir);
    let fresh = false;
    // the index is rendered as dod-index.mjs renders it: a plan with no reviews file has no reviews, not an unknown
    try { fresh = readFileSync(join(dir, "README.md"), "utf8").replace(/\r\n/g, "\n") === renderIndexOf(plans.map((p) => (p.reviews ? p : { ...p, reviews: [] })), dir); } catch { fresh = false; }
    return { ctx: { dir, plans, indexFresh: fresh, today: localDate(), folder: basename(resolve(dir, "..", "..")) }, target: join(dir, "dod-audit.html"), container: dir, count: plans.length, summary: `index ${fresh ? "fresh" : "stale"}`, skipped: 0 };
  },
  fixture: () => ({ dir: "<memory>", plans: [hostilePlan()], indexFresh: true, today: "2026-10-03", folder: "\"><svg onload=x>" }),
});
registerRenderer("benchmark", {
  render: renderBenchmark,
  context: ({ roots, out }) => {
    if (!roots || !existsSync(roots) || !statSync(roots).isDirectory()) throw new PageError(`wbs: no folder ${plainText(roots ?? "")}`);
    const b = benchmarkRows(roots);
    if (/* pmv-mutant:empty-root */!b.projects.length) throw new PageError(`wbs: no dod project below ${plainText(roots)} — a project is a folder whose store holds a plan`);
    return { ctx: { root: roots, ...b, rootName: basename(resolve(roots)) }, target: out ?? join(roots, "dod-benchmark.html"), container: roots, count: b.plans, summary: `${b.projects.length} project(s) · ${b.skipped.length} skipped${b.stopped ? ` · stopped at the limit of ${b.stopped}` : ""}`, skipped: 0 }; // what was skipped is folders, not the store's non-plan files
  },
  fixture: () => ({ root: "<memory>", projects: [{ name: "\"><svg onload=x>", rows: [{ ...summaryRow(hostilePlan()), project: "\"><svg onload=x>" }] }], skipped: [{ path: "\"><svg onload=x>/x", reason: "a link — not followed" }], stopped: null }),
});


// ---------------------------------------------------------------- fixtures

export function fixtureText(o = {}) {
  const items = o.items ?? Array.from({ length: o.n ?? 3 }, (_, k) => `D${k + 1}`);
  const line = (d) => `- [${o.checked?.includes(d) ? "x" : " "}] ${d} · **Item ${d}** something is true · test: a case (fails when: it is not)`;
  const fm = { dod: "2", rubric: "2", id: `dod-20261001-${(o.slug ?? "fixt").replace(/[^a-z0-9]/g, "").padEnd(4, "x").slice(0, 4)}`, slug: o.slug ?? "fixt", title: o.title ?? "A fixture plan", status: o.status ?? "in-progress", size: o.size ?? "M", kind: "feature", created: o.created ?? "2026-10-01", baselined: o.baselined ?? "2026-10-01", closed: o.closed ?? "none", recon_commit: "abc1234", coverage_author: "15/15 layers · 49/49 probes", coverage_reviewer: "15/15 layers · 49/49 probes", review: "codex", ...(o.fm ?? {}) };
  return `---\n${Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join("\n")}\n---\n\n# DoD: ${fm.slug}\n\n## Definition of Done\n${(o.current ?? items).map(line).join("\n")}\n\n${o.wbs ? `## Work breakdown\n${o.wbs}\n\n` : ""}## Baseline\n${items.map(line).join("\n")}\n\n## Amendments\n${o.amend ?? ""}\n\n## Log\n${o.log ?? "- 2026-10-01 · status → draft · plan\n- 2026-10-01 · status → ready · approve · review: codex\n- 2026-10-01 · status → in-progress · start\n"}${o.extra ?? ""}`;
}
export const fixturePlan = (o = {}) => parsePlan(fixtureText(o), `${o.slug ?? "fixt"}.md`);

export function hostilePlan() {
  const p = fixturePlan({
    title: "<img src=x onerror=alert(1)>",
    amend: "- A1 · 2026-10-02 · discovered · +D4 · layer: 7.2 · </script><script>alert(1)</script>",
    current: ["D1", "D2", "D3", "D4"],
    log: "- 2026-10-01 · status → draft · plan\n- 2026-10-01 · status → ready · approve · review: codex\n- 2026-10-01 · status → in-progress · start\n- 2026-10-02 · note · effort · plan · 12 min measured · 40 k tokens measured\n- 2026-10-02 · note · see https://example.invalid/x\"><img src=y>\n",
  });
  p.reviews = [];
  return p;
}

// ---------------------------------------------------------------- the design spec (D1, D25)

export function designTokens(text) {
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return null;
  const light = new Map(), dark = new Map(), groups = new Set(), top = new Set();
  let group = null;
  for (const l of fm[1].split(/\r?\n/)) {
    const t = l.match(/^([a-z][a-z-]*):/); if (t) { top.add(t[1]); group = t[1]; groups.add(t[1]); continue; }
    if (group !== "colors") continue;
    const m = l.match(/^\s{2}([a-z][a-z0-9-]*):\s*"(#[0-9a-fA-F]{3,8})"\s*$/);
    if (!m) continue;
    if (m[1].startsWith("dark-")) dark.set(m[1].slice(5), m[2].toLowerCase()); else light.set(m[1], m[2].toLowerCase());
  }
  return { light, dark, top, groups };
}

const block = (css, opener) => { const i = css.indexOf(opener); if (i < 0) return ""; const j = css.indexOf("}", i); return css.slice(i, j); };
const cssVars = (b) => new Map([...b.matchAll(/--([a-z][a-z0-9-]*):(#[0-9a-f]{3,8})\b/gi)].map((m) => [m[1], m[2].toLowerCase()]));

// D1, both directions: every design.md colour is in the stylesheet with its value, every hex variable of the
// stylesheet is a design.md colour, and every kind has a light and a dark colour.
export function tokenProblems(style, designText) {
  if (designText === null) return ["design.md cannot be read — the token test fails rather than skips"];
  const t = designTokens(designText);
  if (!t) return ["design.md's frontmatter does not parse"];
  const out = [];
  const light = cssVars(block(style, ":root{")), dark = cssVars(block(style, ':root[data-theme="dark"]{'));
  for (const [k, v] of t.light) if (/* pmv-mutant:tokens */light.get(k) !== v) out.push(`--${k} is ${light.get(k) ?? "missing"} in the stylesheet, ${v} in design.md`);
  for (const [k, v] of t.dark) if (dark.get(k) !== v) out.push(`dark --${k} is ${dark.get(k) ?? "missing"} in the stylesheet, ${v} in design.md`);
  for (const k of light.keys()) if (!t.light.has(k)) out.push(`--${k} is in the stylesheet and not in design.md`);
  for (const k of dark.keys()) if (!t.dark.has(k)) out.push(`dark --${k} is in the stylesheet and not in design.md`);
  for (const k of KINDS) { if (!t.light.has(`kind-${k}`)) out.push(`kind-${k} has no light colour`); if (!t.dark.has(`kind-${k}`)) out.push(`kind-${k} has no dark colour`); }
  return out;
}

export const DESIGN_SECTIONS = ["Overview", "Colors", "Typography", "Layout", "Elevation & Depth", "Shapes", "Components", "Do's and Don'ts"];
export function designSpecProblems(text) {
  if (text === null) return ["design.md cannot be read"];
  const t = designTokens(text);
  if (!t) return ["the frontmatter does not parse"];
  const out = [];
  for (const k of ["name", "description", "colors", "typography", "rounded", "spacing", "components"]) if (!t.top.has(k)) out.push(`the frontmatter lacks ${k}`);
  const heads = [...text.matchAll(/^## (.+?)\s*$/gm)].map((m) => m[1]);
  const at = DESIGN_SECTIONS.map((s) => heads.indexOf(s));
  DESIGN_SECTIONS.forEach((s, k) => { if (at[k] < 0) out.push(`the section ${s} is missing`); });
  const found = at.filter((x) => x >= 0);
  if (found.some((x, k) => k && x < found[k - 1])) out.push("the sections are out of order");
  return out;
}

// D3: the tablist, read from the page; every tab controls a panel, one tab is in the tab order, no panel is hidden
// by the markup, and the script follows the hash
export function tabProblems(html, script = TAB_SCRIPT) {
  const out = [];
  const tabs = [...html.matchAll(/<button role="tab"([^>]*)>/g)].map((m) => m[1]);
  if (!tabs.length) return ["no tab"];
  if (!/role="tablist"/.test(html)) out.push("no tablist");
  for (const t of tabs) {
    const id = (t.match(/aria-controls="([^"]+)"/) ?? [])[1];
    if (!id || !new RegExp(`role="tabpanel" id="${id}"`).test(html)) out.push(`a tab controls ${id ?? "nothing"}, which is not a panel`);
    if (!/aria-selected="(true|false)"/.test(t)) out.push("a tab lacks aria-selected");
  }
  if (tabs.filter((t) => /tabindex="0"/.test(t)).length !== 1) out.push("not exactly one tab has tabindex 0");
  if (/role="tabpanel"[^>]*\bhidden\b/.test(html)) out.push("a panel is hidden in the markup");
  if (!/hashchange/.test(script)) out.push("the script lacks a hashchange listener");
  for (const k of ["ArrowRight", "ArrowLeft", "Home", "End"]) if (!script.includes(k)) out.push(`the script does not handle ${k}`);
  return out;
}

// D5: a page renders the hostile fixture as text
const HOSTILE = ["<img src=x", "<svg onload", "</script><script>", "<img src=y"];
export const escapeProblems = (html) => HOSTILE.filter((h) => /* pmv-mutant:escape-check */html.includes(h)).map((h) => `raw ${h}`)
  .concat((html.match(/<script\b/g) ?? []).length !== 1 ? ["more than one script element"] : []);

// D10, 4.4: the rate a page shows is the one reportNumbers gives
export const pageRate = (html) => { const m = html.match(/data-kpi="rate"><th scope="row">[^<]*<\/th><td class="v">(\d+) %/); return m ? Number(m[1]) : null; };

// D42 (release-0-3-2 A1): every shape and label of a chart sits inside its picture; every change mark sits inside
// the plot, centred in its own day's band when its day's group fits the band, and never overlaps a mark of its day.
// Text width is estimated at 0.5 em a character (the numeral face is narrow), mark numbers excepted.
export function chartBoundProblems(html) {
  const out = [];
  const num = (t, a) => Number((t.match(new RegExp(`\\b${a}="(-?[\\d.]+)"`)) ?? [])[1]);
  for (const [, open, body] of html.matchAll(/<svg (viewBox="0 0 [\d.]+ [\d.]+"[^>]*)>([\s\S]*?)<\/svg>/g)) {
    const [W, H] = open.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).slice(1).map(Number);
    const name = (open.match(/aria-labelledby="([^"]+)"/) ?? [])[1] ?? "chart";
    const plot = (open.match(/data-plot="([^"]+)"/) ?? [])[1]?.split(" ").map(Number);
    const band = (open.match(/data-band="([^"]+)"/) ?? [])[1]?.split(" ");
    const marks = [];
    for (const [g, inner] of body.matchAll(/<g class="mk [^"]*">([\s\S]*?)<\/g>/g)) {
      const c = inner.match(/<circle [^>]*>/)[0];
      const date = (inner.match(/<title>[^<]*· (\d{4}-\d{2}-\d{2})<\/title>/) ?? [])[1];
      marks.push({ id: (inner.match(/<title>(A\d+)/) ?? [])[1] ?? g.slice(0, 40), x: num(c, "cx"), y: num(c, "cy"), r: num(c, "r"), date });
    }
    for (const c of body.replace(/<g class="mk [\s\S]*?<\/g>/g, "").matchAll(/<circle [^>]*>/g)) {
      const x = num(c[0], "cx"), y = num(c[0], "cy"), r = num(c[0], "r");
      if (x - r < 0 || x + r > W || y - r < 0 || y + r > H) out.push(`${name}: a point at ${x},${y} is outside the picture`);
      if (plot && (x - r < plot[0] || x + r > plot[1])) out.push(`${name}: a point at ${x},${y} is outside the plot`);
    }
    for (const m of marks) {
      if (m.x - m.r < 0 || m.x + m.r > W || m.y - m.r < 0 || m.y + m.r > H) out.push(`${name}: ${m.id} is outside the picture`);
      if (plot && (m.x - m.r < plot[0] - 0.01 || m.x + m.r > plot[1] + 0.01 || m.y - m.r < plot[2] - 0.01 || m.y + m.r > plot[3] + 0.01)) out.push(`${name}: ${m.id} is outside the plot`);
    }
    if (band) {
      const [left, w, from] = [Number(band[0]), Number(band[1]), band[2]];
      const groups = new Map();
      for (const m of marks) { const k = `${m.date}|${m.y}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); }
      for (const g of groups.values()) {
        const start = left + (day(g[0].date) - day(from)) * w;
        const width = g.reduce((t, m) => t + 2 * m.r, 0) + 2 * (g.length - 1);
        if (width <= w) for (const m of g) if (m.x < start - 0.01 || m.x > start + w + 0.01) out.push(`${name}: ${m.id} is not on its day ${m.date}`);
        for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) if (Math.abs(g[i].x - g[j].x) < g[i].r + g[j].r - 0.01) out.push(`${name}: ${g[i].id} and ${g[j].id} overlap`);
      }
    }
    for (const [, t, text] of body.replace(/<g class="mk [\s\S]*?<\/g>/g, "").matchAll(/<text ([^>]*)>([^<]*)<\/text>/g)) {
      const x = num(t, "x"), y = num(t, "y"), wd = 6.25 * text.replace(/&[a-z]+;|&#\d+;/g, "&").length, anchor = (t.match(/text-anchor="(\w+)"/) ?? [])[1] ?? "start";
      const a = anchor === "end" ? x - wd : anchor === "middle" ? x - wd / 2 : x;
      if (a < 0 || a + wd > W || y - 10 < 0 || y > H) out.push(`${name}: the label "${text}" is outside the picture`);
    }
  }
  return out;
}

// ---------------------------------------------------------------- selftest

export const ASSERTIONS = new Map();
const assertion = (id, fn) => ASSERTIONS.set(id, { id, fn });
// D41: the plants of a gating probe, each a fault the control must catch; the counts are constants
export const PLANTS = [];
const plant = (probe, name, run) => PLANTS.push({ probe, name, run });
export const GATING_COUNTS = { "2.1": 2, "3.3": 2, "4.4": 5, "6.2": 6, "10.1": 2, "12.4": 2 };

const TEMP_DIRS = [];
const tempDir = (prefix = "dod-pages-") => { const d = mkdtempSync(join(tmpdir(), prefix)); TEMP_DIRS.push(d); return d; };
// every temp folder the suite makes is deleted on every exit (3.3)
const cleanTemps = () => { for (const d of TEMP_DIRS.reverse()) /* pmv-mutant:temp-clean */rmSync(d, { recursive: true, force: true }); TEMP_DIRS.length = 0; };
const write = (p, text) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); };
const readOr = (p) => { try { return readFileSync(p, "utf8"); } catch { return null; } };
const link = (target, path) => symlinkSync(target, path, process.platform === "win32" ? "junction" : "dir");

// a project folder with a store and plans; `pointer` writes a CLAUDE.md naming another store
export function makeProject(dir, plans = [{}], { pointer = null, agents = null } = {}) {
  for (const o of plans) write(join(dir, "docs", "dod", `${o.slug ?? "fixt"}.md`), fixtureText(o));
  if (pointer) write(join(dir, "CLAUDE.md"), `dod-store: ${pointer}\n`);
  if (agents) write(join(dir, "AGENTS.md"), `dod-store: ${agents}\n`);
  return dir;
}
const donePlan = (slug, B, G, closed = "2026-10-03") => ({
  slug, n: B, status: "done", closed,
  amend: Array.from({ length: G }, (_, k) => `- A${k + 1} · 2026-10-02 · discovered · +D${B + k + 1} · layer: 6.1 · a miss`).join("\n"),
  current: Array.from({ length: B + G }, (_, k) => `D${k + 1}`),
  log: `- 2026-10-01 · status → draft · plan\n- 2026-10-01 · status → ready · approve · review: codex\n- 2026-10-01 · status → in-progress · start\n- ${closed} · status → done · close\n`,
});
export const donePlanSpec = donePlan;

const stubTimes = (map, added = "2026-10-02T08:00:00-04:00") => (shas) => ({ times: new Map(shas.filter((s) => map[s]).map((s) => [s, map[s]])), added });
const ganttPlan = (passes) => fixturePlan({
  n: 4, wbs: "- W1 · **Build**\n- W1.1 · **First** · items: D1 D2 · steps: 1\n- W1.2 · **Second** · items: D3 D4 · steps: 2",
  log: "- 2026-10-02 · status → draft · plan\n- 2026-10-02 · status → ready · approve · review: codex\n- 2026-10-02 · status → in-progress · start\n- 2026-10-02 · note · base aaaaaaa\n"
    + passes.map(([d, sha]) => `- 2026-10-02 · ${d} · pass · test: a case → ok · ${sha} · claude\n`).join(""),
});

assertion("pages.tokens-sync", (expect) => {
  const design = readOr(DESIGN_MD);
  expect("pages.tokens-sync", tokenProblems(PAGE_STYLE, design).length === 0, tokenProblems(PAGE_STYLE, design).join("; "));
  expect("pages.tokens-sync.tide", tokenProblems(PAGE_STYLE.replace("--tide:#2f8fa8", "--tide:#2f8fa9"), design).length > 0);
  expect("pages.tokens-sync.kind", tokenProblems(PAGE_STYLE, String(design).replace(/^\s{2}dark-kind-emergent:.*\n/m, "")).length > 0);
  expect("pages.tokens-sync.unreadable", /cannot be read/.test(tokenProblems(PAGE_STYLE, readOr(join(SKILL_DIR, "references", "no-such-design.md")))[0] ?? ""));
});
plant("4.4", "a stylesheet colour differing from design.md passes", () => tokenProblems(PAGE_STYLE.replace("--tide:#2f8fa8", "--tide:#000000"), readOr(DESIGN_MD)).length > 0);

assertion("pages.offline", (expect) => {
  for (const kind of PAGE_KINDS) {
    const e = RENDERERS.get(kind);
    if (!e) { expect(`pages.offline.${kind}`, false, `${kind} is not in RENDERERS`); continue; }
    const p = offlineProblems(e.render(e.fixture()));
    expect(`pages.offline.${kind}`, p.length === 0, p.join("; "));
  }
  const base = RENDERERS.get("dashboard").render(RENDERERS.get("dashboard").fixture());
  const scriptOf = (h) => h.match(/<script>([\s\S]*?)<\/script>/)[1];
  const big = "/*" + "x".repeat(3000) + "*/";
  const plants = {
    img: base.replace("<main", '<img src="https://example.invalid/x.png"><main'),
    import: base.replace("<style>", "<style>@import url(https://example.invalid/a.css);"),
    second: base.replace("</body>", "<script>1</script></body>"),
    hash: base.replace(scriptOf(base), scriptOf(base) + ";"),
    size: base.replace(scriptOf(base), big).replace(/script-src '[^']*'/, `script-src '${scriptHash(big)}'`),
    nocsp: base.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, ""),
  };
  for (const [k, h] of Object.entries(plants)) expect(`pages.offline.plant-${k}`, offlineProblems(h).length > 0, k);
});
plant("4.4", "a page rendered without its CSP meta through any option of pageShell", () => {
  const options = [{}, { tabs: [] }, { tabs: [{ id: "a", label: "A" }] }, { tabs: [{ id: "a", label: "A" }, { id: "b", label: "B" }] }, { style: "p{}" }, { notice: "n", footer: "f", state: "s" }, { title: "" }];
  const all = options.every((o) => /<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;|<meta http-equiv="Content-Security-Policy" content="default-src 'none'/.test(pageShell({ title: "t", ...o })) && offlineProblems(pageShell({ title: "t", ...o })).length === 0);
  const caught = offlineProblems(pageShell({ title: "t" }).replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, "")).length > 0;
  return all && caught;
});

assertion("pages.tabs", (expect) => {
  const html = RENDERERS.get("dashboard").render(RENDERERS.get("dashboard").fixture());
  expect("pages.tabs", tabProblems(html).length === 0, tabProblems(html).join("; "));
  expect("pages.tabs.two-zero", tabProblems(html.replace('tabindex="-1"', 'tabindex="0"')).length > 0);
  expect("pages.tabs.hidden", tabProblems(html.replace('role="tabpanel"', 'role="tabpanel" hidden')).length > 0);
  expect("pages.tabs.controls", tabProblems(html.replace(/aria-controls="p-plans"/, 'aria-controls="p-nowhere"')).length > 0);
  expect("pages.tabs.hash", tabProblems(html, TAB_SCRIPT.replace("hashchange", "popstate")).length > 0);
});

assertion("pages.not-recorded", (expect) => {
  const plain = fixturePlan({ wbs: "- W1 · **Build**\n- W1.1 · **First** · items: D1 D2 D3 · steps: 1" });
  plain.reviews = null;
  const k = kpiRegister(plain, null);
  const row = (h, key) => (h.match(new RegExp(`data-kpi="${key}">[\\s\\S]*?</tr>`)) ?? [""])[0];
  expect("pages.not-recorded.hours", /not recorded/.test(row(k, "hours")) && !/0 min/.test(row(k, "hours")), row(k, "hours"));
  expect("pages.not-recorded.tokens", /not recorded/.test(row(k, "tokens")) && !/\b0 k\b/.test(row(k, "tokens")), row(k, "tokens"));
  const done = fixturePlan({ status: "done", log: "- 2026-10-01 · status → draft · plan\n- 2026-10-01 · status → ready · approve · review: codex\n- 2026-10-01 · status → in-progress · start\n- 2026-10-02 · status → done · close\n" });
  expect("pages.not-recorded.rounds", /not recorded/.test(row(kpiRegister(done, null), "rounds")), row(kpiRegister(done, null), "rounds"));
  const est = fixturePlan({ log: "- 2026-10-01 · status → draft · plan\n- 2026-10-01 · status → ready · approve · review: codex\n- 2026-10-01 · status → in-progress · start\n- 2026-10-02 · note · effort · plan · 40 min estimated · 120 k tokens estimated\n" });
  const r = row(kpiRegister(est, null), "hours");
  expect("pages.not-recorded.estimated", /estimated/.test(r) && !/>measured</.test(r), r);
  const draft = fixturePlan({ status: "draft", baselined: "none", log: "- 2026-10-01 · status → draft · plan\n" });
  expect("pages.not-recorded.draft-rate", />n\/a</.test(row(kpiRegister(draft, null), "rate")), row(kpiRegister(draft, null), "rate"));
});

assertion("pages.escape", (expect) => {
  for (const kind of PAGE_KINDS) {
    const e = RENDERERS.get(kind);
    if (!e) { expect(`pages.escape.${kind}`, false, `${kind} is not in RENDERERS`); continue; }
    const p = escapeProblems(e.render(e.fixture()));
    expect(`pages.escape.${kind}`, p.length === 0, p.join("; "));
  }
  expect("pages.escape.status-line", !plainText(`title ${String.fromCharCode(27)}[2J`).includes(String.fromCharCode(27)));
  expect("pages.escape.plant", escapeProblems("<script></script><img src=x onerror=alert(1)>").length > 0);
});

assertion("pmv.signature", (expect) => {
  const p = fixturePlan({ n: 10, current: Array.from({ length: 13 }, (_, k) => `D${k + 1}`),
    amend: "- A1 · 2026-10-02 · discovered · +D11 +D12 · layer: 7.2 · two missed\n- A2 · 2026-10-02 · corrected · ~D3 · layer: 4.4 · a reversal\n- A3 · 2026-10-03 · requested · +D13 · layer: — · new scope" });
  const d = signatureData(p);
  const html = signatureChart(p);
  expect("pmv.signature.end", d.end === 13, String(d.end));
  expect("pmv.signature.marks", (html.match(/<g class="mk /g) ?? []).length === 3);
  expect("pmv.signature.kind", /<g class="mk k-requested"><circle[^>]*\/><text[^>]*>3<\/text>/.test(html));
  const nums = [...html.matchAll(/<tr><th scope="row">([\d-]+)<\/th><td class="n">(\d+)<\/td><td class="n">(\d+)<\/td>/g)];
  expect("pmv.signature.numbers", nums.length > 0 && Number(nums.at(-1)[3]) === d.end, String(nums.at(-1)?.[3]));
  const draft = fixturePlan({ status: "draft", baselined: "none", log: "- 2026-10-01 · status → draft · plan\n" });
  expect("pmv.signature.draft", /class="predicted pre"/.test(signatureChart(draft)) && /draft 3/.test(signatureChart(draft)));
});

assertion("pmv.discovery", (expect) => {
  const names = readLayerNames();
  const fromDoc = [...readFileSync(LAYERS_MD, "utf8").matchAll(/^## (\d{1,2})\. (.+?)\s*$/gm)].map((m) => m[2].replace(/\s*\*\(.*\)\*\s*$/, ""));
  const p = fixturePlan({ amend: "- A1 · 2026-10-02 · discovered · +D4 · layer: 7.2 · a race\n- A2 · 2026-10-02 · requested · — · layer: — · scope" });
  const rows = discoveryRows(p, names);
  expect("pmv.discovery.names", JSON.stringify(rows.slice(0, 15).map((r) => r.name)) === JSON.stringify(fromDoc), rows.map((r) => r.name).join("|"));
  expect("pmv.discovery.row", rows.find((r) => r.marks.some((a) => a.id === "A1"))?.name === "States & lifecycle");
  expect("pmv.discovery.none", rows.at(-1).name === "no layer" && rows.at(-1).marks.some((a) => a.id === "A2"));
});

assertion("pages.chart-bounds", (expect) => {
  const names = readLayerNames();
  const charts = (p) => signatureChart(p) + discoveryMap(p, names) + variationChart(p);
  const log = (days) => `- ${days[0]} · status → draft · plan\n- ${days[0]} · status → ready · approve · review: codex\n- ${days[0]} · status → in-progress · start\n`
    + days.slice(1).map((d) => `- ${d} · note · worked\n`).join("");
  const am = (date, n, from = 1) => Array.from({ length: n }, (_, k) => `- A${from + k} · ${date} · ${k % 2 ? "defect" : "discovered"} · ~D${(k % 3) + 1} · layer: ${(k % 3) + 10}.1 · x`).join("\n");
  const passes = (date, n) => Array.from({ length: n }, (_, k) => `- ${date} · D${k + 1} · pass · test: t · abc1234 · claude\n`).join("");
  const iso = (k) => new Date(Date.UTC(2026, 8, 1 + k)).toISOString().slice(0, 10);
  const cases = {
    lastDay: fixturePlan({ n: 6, amend: am("2026-10-03", 6), log: log(["2026-10-02", "2026-10-03"]) + passes("2026-10-03", 6) }),
    eightOneDay: fixturePlan({ n: 8, amend: am("2026-10-02", 8), log: log(["2026-10-01", "2026-10-02", "2026-10-04"]) + passes("2026-10-04", 8) }),
    oneDay: fixturePlan({ n: 3, amend: am("2026-10-01", 3), log: log(["2026-10-01"]) + passes("2026-10-01", 3) }),
    sixtyDays: fixturePlan({ n: 5, amend: [am(iso(0), 2), am(iso(30), 3, 3), am(iso(59), 2, 6)].join("\n"), log: log([iso(0), iso(59)]) + passes(iso(59), 5) }),
  };
  for (const [k, p] of Object.entries(cases)) {
    const html = charts(p);
    expect(`pages.chart-bounds.${k}`, (html.match(/<g class="mk /g) ?? []).length === 3 * p.amendments.length && chartBoundProblems(html).length === 0, JSON.stringify(chartBoundProblems(html).slice(0, 4)));
  }
  // the old drawing, a fixed step to the right of the last day, is caught
  const old = '<svg viewBox="0 0 650 236" role="img" aria-labelledby="var-t" data-plot="52 628 4 208" data-band="52 288.000 2026-10-02"><g class="mk k-defect"><circle cx="628.0" cy="100.0" r="8.5"/><text x="628.0" y="103.4" text-anchor="middle">2</text><title>A2 · defect · layer 12.1 · 2026-10-03</title></g><g class="mk k-defect"><circle cx="648.0" cy="100.0" r="8.5"/><text x="648.0" y="103.4" text-anchor="middle">6</text><title>A6 · defect · layer 12.4 · 2026-10-03</title></g></svg>';
  expect("pages.chart-bounds.old-offset", chartBoundProblems(old).some((x) => /A6 is outside the picture/.test(x)) && chartBoundProblems(old).some((x) => /A2 is outside the plot/.test(x)), JSON.stringify(chartBoundProblems(old)));
  expect("pages.chart-bounds.label", chartBoundProblems('<svg viewBox="0 0 650 260" role="img" aria-labelledby="sig-t"><text class="lbl" x="628" y="2">observed 48</text></svg>').length === 1);
  expect("pages.chart-bounds.rate", chartBoundProblems(rateAcross([{ label: "a", rate: 40 }, { label: "b", rate: 100 }, { label: "c", rate: 88, me: true }])).length === 0);
  // every plan in the lab's store, when this runs in the lab
  const store = resolve(SKILL_DIR, "..", "..", "docs", "dod");
  let files = []; try { files = readdirSync(store).filter((f) => /^[a-z0-9-]+\.md$/.test(f) && f !== "README.md" && !f.endsWith(".reviews.md") && f !== "profile.md"); } catch { /* not in the lab */ }
  const bad = [];
  for (const f of files) { let p; try { p = parsePlan(readFileSync(join(store, f), "utf8"), join(store, f)); } catch { continue; } if (!p?.fm?.slug) continue; const pr = chartBoundProblems(charts(p)); if (pr.length) bad.push(`${f}: ${pr[0]}`); }
  expect("pages.chart-bounds.store", bad.length === 0, JSON.stringify({ plans: files.length, bad: bad.slice(0, 4) }));
});

assertion("pmv.variation", (expect) => {
  const p = fixturePlan({ amend: "- A1 · 2026-10-02 · discovered · ~D3 · layer: 4.1 · x\n- A2 · 2026-10-02 · discovered · ~D3 +D9 · layer: 4.1 · y\n- A3 · 2026-10-03 · emergent · — · layer: — · finding: z" });
  const v = variationData(p);
  expect("pmv.variation.a2", v[1].y === 2 && v[1].size === 2, JSON.stringify(v[1]));
  expect("pmv.variation.a3", v[2].y === 0 && v[2].size === 1, JSON.stringify(v[2]));
});

assertion("pmv.kpis", (expect) => {
  const p = fixturePlan({ n: 9, current: Array.from({ length: 10 }, (_, k) => `D${k + 1}`), amend: "- A1 · 2026-10-02 · discovered · +D10 · layer: 6.1 · a miss",
    wbs: "- W1 · **Build**\n- W1.1 · **First** · items: D1 D2 D3 D4 D5 · steps: 1\n- W1.2 · **Second** · items: D6 D7 D8 D9 D10 · steps: 2",
    log: "- 2026-10-01 · status → draft · plan\n- 2026-10-01 · status → ready · approve · review: codex\n- 2026-10-01 · status → in-progress · start\n- 2026-10-02 · note · effort · W1.1 · 1 h 05 min measured · 300 k tokens measured\n" });
  const rows = kpiRows(p, []);
  expect("pmv.kpis.order", rows.map((r) => r.key).join() === "rate,completion,changes,rework,rounds,draft-to-done,per-day,missed,hours,tokens", rows.map((r) => r.key).join());
  expect("pmv.kpis.rate", pageRate(kpiRegister(p, [])) === reportNumbers(p).rate, `${pageRate(kpiRegister(p, []))} vs ${reportNumbers(p).rate}`);
  const h = rows.find((r) => r.key === "hours").value;
  expect("pmv.kpis.hours", /1 h 05 min/.test(h) && /1 of 2 packages recorded/.test(h), h);
  expect("pmv.kpis.targets", RATE_FLOOR === 75 && RATE_TARGET === 90);
});
plant("4.4", "a page number differing from reportNumbers", () => {
  const p = fixturePlan({ n: 4, current: ["D1", "D2", "D3", "D4", "D5"], amend: "- A1 · 2026-10-02 · discovered · +D5 · layer: 6.1 · a miss" });
  const html = kpiRegister(p, []);
  const agrees = (h) => pageRate(h) === reportNumbers(p).rate;
  return agrees(html) && !agrees(html.replace(/(data-kpi="rate"><th scope="row">[^<]*<\/th><td class="v">)\d+/, "$1" + "99"));
});
plant("4.4", "the earlier effort line winning", () => {
  const p = fixturePlan({ log: "- 2026-10-01 · status → draft · plan\n- 2026-10-01 · status → ready · approve · review: codex\n- 2026-10-01 · status → in-progress · start\n- 2026-10-02 · note · effort · plan · 10 min measured · 5 k tokens measured\n- 2026-10-02 · note · effort · plan · 20 min measured · 9 k tokens measured\n" });
  return effortLines(p).latest.get("plan").minutes === 20;
});

assertion("pmv.summarise", (expect) => {
  const a = summarise([80, 90, 100, 70]), b = summarise([]), c = summarise([NOT_RECORDED, 80, null]);
  expect("pmv.summarise.even", a.median === 85 && a.mean === 85 && a.n === 4, JSON.stringify(a));
  expect("pmv.summarise.empty", b.n === 0 && b.mean === null && b.median === null && /not recorded/.test(summaryCell(b)), JSON.stringify(b));
  expect("pmv.summarise.skip", c.n === 1 && c.mean === 80, JSON.stringify(c));
  expect("pmv.summarise.n", /n 4/.test(summaryCell(a)));
});

assertion("pmv.versions", (expect) => {
  const p = fixturePlan({ amend: "- A1 · 2026-10-02 · discovered · +D4 · layer: 6.1 · x\n- A2 · 2026-10-04 · requested · +D5 · layer: — · y",
    log: "- 2026-10-01 · status → draft · plan\n- 2026-10-01 · status → ready · approve · review: codex\n- 2026-10-01 · status → in-progress · start\n- 2026-10-03 · version · v2 · split W1 at 1a2b3c4\n" });
  const r = versionRows(p);
  expect("pmv.versions.order", r.map((x) => x.label).join() === "draft,baseline,A1,v2,A2", r.map((x) => x.label).join());
  expect("pmv.versions.baseline", r.some((x) => x.base));
  expect("pmv.versions.commit", r.filter((x) => x.commit).map((x) => x.label).join() === "v2");
});

assertion("pmv.gantt", (expect) => {
  const p = ganttPlan([["D1", "bbbbbbb"], ["D2", "bbbbbbb"], ["D3", "ccccccc"], ["D4", "ccccccc"]]);
  const times = { aaaaaaa: "2026-10-02T09:00:00-04:00", bbbbbbb: "2026-10-02T10:00:00-04:00", ccccccc: "2026-10-02T12:30:00-04:00" };
  const html = ganttChart(p, { commitTimes: stubTimes(times) });
  expect("pmv.gantt.w12", /data-pkg="W1.2" data-from="2026-10-02 10:00" data-to="2026-10-02 12:30"/.test(html), (html.match(/data-pkg="W1.2"[^>]*/) ?? [""])[0]);
  expect("pmv.gantt.offset", /UTC−04:00/.test(html));
  const none = ganttChart(p, { commitTimes: () => ({ error: "git is not installed" }) });
  expect("pmv.gantt.fallback", /Times from dates: git is not installed/.test(none) && !/\d{2}:\d{2}"/.test(none), none.slice(-200));
  let seen = [];
  const run = (cmd, args) => { seen = seen.concat(args); return { status: 0, stdout: "" }; };
  gitCommitTimes(".", { run })(["--upload-pack=x", "abc1234"]);
  expect("pmv.gantt.sha", !seen.includes("--upload-pack=x") && seen.includes("abc1234"), seen.join(" "));
  const evil = ganttPlan([["D1", "--upload-pack=x"]]);
  let called = false;
  ganttChart(evil, { commitTimes: () => { called = true; return { times: new Map(), added: null }; } });
  expect("pmv.gantt.sha-line", !called);
});
for (const [name, r] of [["git missing", { error: { code: "ENOENT" } }], ["git slow", { error: { code: "ETIMEDOUT" } }], ["git exiting non-zero", { status: 128, stdout: "" }], ["git not knowing a sha", { status: 0, stdout: "aaaaaaa000 2026-10-02T09:00:00-04:00\n" }]]) {
  plant("6.2", `${name} ends in an hour figure`, () => {
    const html = ganttChart(ganttPlan([["D1", "bbbbbbb"], ["D2", "bbbbbbb"]]), { commitTimes: gitCommitTimes(".", { run: () => r }) });
    return /Times from dates: /.test(html);
  });
}
plant("10.1", "a sha holding an option reaches git", () => {
  let args = [];
  gitCommitTimes(".", { run: (c, a) => { args = a; return { status: 0, stdout: "" }; } })(["--upload-pack=x"]);
  return !args.includes("--upload-pack=x");
});

assertion("pmv.design-spec", (expect) => {
  const t = readOr(DESIGN_MD);
  expect("pmv.design-spec", designSpecProblems(t).length === 0, designSpecProblems(t).join("; "));
  expect("pmv.design-spec.missing", designSpecProblems(String(t).replace("## Shapes", "## Forms")).length > 0);
  expect("pmv.design-spec.order", designSpecProblems(String(t).replace("## Colors", "## Colours").replace("## Layout", "## Colors\n\n## Layout")).length > 0);
  expect("pmv.design-spec.group", designSpecProblems(String(t).replace(/^rounded:/m, "roundness:")).length > 0);
  expect("pmv.design-spec.frontmatter", designSpecProblems(String(t).replace(/^---/, "--")).length > 0);
  expect("pmv.design-spec.unreadable", designSpecProblems(null).length > 0);
});

assertion("pmv.docs", (expect) => {
  const f = (rel) => readOr(join(SKILL_DIR, rel)) ?? "";
  const skill = f("SKILL.md"), life = f(join("references", "lifecycle.md")), tpl = f(join("references", "plan-template.md")), design = f(join("references", "design.md"));
  const section = (text, head) => { const i = text.indexOf(head); if (i < 0) return ""; const j = text.indexOf("\n## ", i + head.length); return text.slice(i, j < 0 ? undefined : j); };
  for (const w of ["--dashboard", "--audit", "--benchmark", "dod-effort.mjs"]) expect(`pmv.docs.skill ${w}`, skill.includes(w));
  expect("pmv.docs.start", section(life, "## `start").includes("dod-effort.mjs"));
  expect("pmv.docs.close", section(life, "## `close").includes("--dashboard"));
  expect("pmv.docs.template", tpl.includes("note · effort ·"));
  expect("pmv.docs.artifact", /Claude artifact must show the generated file unchanged/.test(design) && /supporting file/.test(design) && /never as its main page/.test(design)); // A2
  expect("pmv.docs.length", skill.split("\n").length < 500, String(skill.split("\n").length));
});

// pm-views A6: two rules no case reached — each forbidden tag (D2), and the plan limit (D20; dod-wbs reaches only the
// project limit, since 5,000 plans is too many to write in a selftest)
plant("9.2", "a page holding a forbidden tag or a url( passes", () => {
  const samples = ["<script src=x></script>", "<link rel=x>", "<img alt=x>", "<iframe></iframe>", "<object></object>", "<embed>", "<base href=x>",
    "<p srcset=\"x\">", "<style>@import x;</style>", "<p style=\"background:url(x)\">"];
  return samples.length === FORBIDDEN.length && samples.every((s, k) => offlineProblems(s).includes(`the page holds ${FORBIDDEN[k][1]}`))
    && !offlineProblems("<svg><path fill=\"url(#g)\"/></svg>").some((p) => p.startsWith("the page holds"));
});
plant("13.2", "the walk reading past the plan limit", () => {
  const root = tempDir();
  makeProject(join(root, "p1"), [{ slug: "a1" }, { slug: "a2" }, { slug: "a3" }]);
  const b = benchmarkRows(root, { maxPlans: 2 });
  return b.plans === 2 && b.stopped === "2 plans";
});
// the benchmark's gating plants (2.1, 3.3, 6.2, 10.1, 12.4, 4.4); the full cases are dod-wbs.mjs's pmv.bench*
plant("2.1", "the benchmark reading a store outside the folder", () => {
  const root = tempDir(), outside = tempDir();
  makeProject(join(outside, "elsewhere"));
  makeProject(join(root, "p1"), [{}], { pointer: join(outside, "elsewhere", "docs", "dod") });
  const b = benchmarkRows(root);
  return b.projects.length === 0 && b.skipped.some((x) => /outside the folder/.test(x.reason));
});
plant("2.1", "a folder swapped for a link after the walk is read", () => {
  const root = tempDir(), outside = tempDir();
  makeProject(join(root, "p1"));
  makeProject(join(outside, "q"));
  const b = benchmarkRows(root, { between: () => { rmSync(join(root, "p1", "docs", "dod"), { recursive: true, force: true }); link(join(outside, "q", "docs", "dod"), join(root, "p1", "docs", "dod")); } });
  return b.projects.every((p) => !p.rows.length) && b.skipped.some((x) => /moved outside the folder/.test(x.reason));
});
plant("3.3", "a temporary folder left behind", () => { const d = tempDir(); cleanTemps(); return !existsSync(d); });
plant("3.3", "a page written outside its container", () => typeof WRITE_UNDER === "function" && (() => { const root = tempDir(); try { WRITE_UNDER(root, join(root, "..", "x-outside.html"), "x"); return false; } catch { return !existsSync(join(root, "..", "x-outside.html")); } })());
plant("4.4", "disagreeing instruction files guessed", () => {
  const root = tempDir();
  makeProject(join(root, "p1"), [{}], { pointer: "docs/dod", agents: "plans" });
  const b = benchmarkRows(root);
  return b.projects.length === 0 && b.skipped.some((x) => /different stores/.test(x.reason));
});
plant("6.2", "an unreadable store ends in a figure", () => {
  const root = tempDir();
  makeProject(join(root, "p1"));
  const b = benchmarkRows(root, { between: (w) => { for (const p of w.projects) { rmSync(p.store, { recursive: true, force: true }); } } });
  return b.projects.every((p) => p.rows.length === 0) && b.skipped.length > 0;
});
plant("6.2", "a plan that does not parse ends in a figure", () => {
  const root = tempDir();
  makeProject(join(root, "p1"), [{ slug: "good" }]);
  write(join(root, "p1", "docs", "dod", "bad.md"), "---\ndod: 2\nnot a field\n---\n");
  const b = benchmarkRows(root);
  return b.skipped.some((x) => /bad\.md/.test(x.path) && /does not parse/.test(x.reason)) && b.projects[0]?.rows.length === 1;
});
plant("10.1", "a link followed", () => {
  const root = tempDir(), outside = tempDir();
  makeProject(join(outside, "linked"));
  link(join(outside, "linked"), join(root, "via-link"));
  const b = benchmarkRows(root);
  return b.projects.length === 0 && b.skipped.some((x) => x.path === "via-link" && /link/.test(x.reason));
});
plant("12.4", "an empty store reading as a pass", () => /no plans yet/.test(renderDashboard({ dir: "x", plans: [] })) && /no plans yet/.test(renderAudit({ dir: "x", plans: [], indexFresh: false, today: "2026-10-03", folder: "f" })));
plant("12.4", "an empty root reading as a pass", () => { try { RENDERERS.get("benchmark").context({ roots: tempDir() }); return false; } catch (e) { return e instanceof PageError; } });

let WRITE_UNDER = null;

export async function selftest(io = console, { gating = false } = {}) {
  // the plan and review pages register from dod-wbs.mjs; the registry test needs all five, and the containment
  // plant needs its writer — the one place this script reads its sibling, and only under --selftest
  const wbs = await import("./dod-wbs.mjs");
  WRITE_UNDER = wbs.writeUnderStore;
  let pass = 0, fired = 0, never = 0;
  const failed = [];
  try {
    if (gating) {
      const byProbe = new Map();
      for (const p of PLANTS) { let ok = false; try { ok = p.run() === true; } catch { ok = false; } const e = byProbe.get(p.probe) ?? { k: 0, caught: 0, missed: [] }; e.k++; if (ok) e.caught++; else e.missed.push(p.name); byProbe.set(p.probe, e); }
      for (const [probe, want] of Object.entries(GATING_COUNTS)) {
        const e = byProbe.get(probe) ?? { k: 0, caught: 0, missed: [] };
        io.log(`gating ${probe}: ${e.caught} of ${e.k} plants caught${e.missed.length ? ` — missed: ${e.missed.join("; ")}` : ""}`);
        if (e.k !== want || e.caught !== e.k) failed.push(`gating ${probe}`);
      }
      return failed.length ? 1 : 0;
    }
    const expect = (id, ok, detail = "") => { fired++; if (ok) pass++; else failed.push(`${id}${detail ? ` — ${plainText(String(detail)).slice(0, 300)}` : ""}`); };
    for (const { id, fn } of ASSERTIONS.values()) {
      const before = fired;
      try { fn(expect); } catch (e) { failed.push(`${id} — threw ${plainText(String(e?.message ?? e))}`); continue; }
      if (fired === before) { never++; failed.push(`${id} — registered but never asserted`); }
    }
    for (const p of PLANTS) { let ok = false; try { ok = p.run() === true; } catch { ok = false; } expect(`plant ${p.probe} ${p.name}`, ok); }
    const total = pass + failed.length;
    io.log(`dod-pages selftest: ${pass}/${total} cases${failed.length ? ` (${failed.join(" | ")})` : " (all pass)"}`);
    io.log(`checked ${ASSERTIONS.size} assertions · ${PLANTS.length} plants · ${fired} fired · ${never} never asserted`);
    return failed.length ? 1 : 0;
  } finally {
    cleanTemps();
  }
}

const invoked = process.argv[1] && realpathSync(process.argv[1]) === SELF;
if (invoked) {
  const args = process.argv.slice(2);
  if (args[0] !== "--selftest" || args.some((a) => !["--selftest", "--gating"].includes(a))) {
    console.error("usage: dod-pages.mjs --selftest [--gating]   (the pages are written by dod-wbs.mjs --html)");
    process.exitCode = 1;
  } else {
    selftest({ log: (s) => console.log(s), error: (s) => console.error(s) }, { gating: args.includes("--gating") })
      .then((c) => { process.exitCode = c; }, (e) => { console.error(`pages: ${plainText(String(e?.message ?? e))}`); process.exitCode = 1; });
  }
}
