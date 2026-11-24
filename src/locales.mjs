// Site-owned, limited ARB/ICU projection for the three languages this Worker serves.
// The former @red-cup-engineering/l-space package has no independently installable
// public release. This module does NOT purport to implement generalized L-Space.
// Original authored ARB messages and translator evidence remain the inputs.
// Evidence records are provenance, not proof that a rendering remains current.
import {contentCatalog} from "./words.mjs";

export const LOCALES=Object.freeze(["en","zh-Hans","lkt"]);
export const DEFAULT_LOCALE="en";
export const POLICY=Object.freeze({"zh-Hans":{machine:true},lkt:{machine:true}});
const FACES=Object.freeze({
  en:Object.freeze({tag:"en",direction:"ltr",ogLocale:"en_US",autonym:"English"}),
  "zh-Hans":Object.freeze({tag:"zh-Hans",direction:"ltr",ogLocale:"zh_CN",autonym:"简体中文"}),
  lkt:Object.freeze({tag:"lkt",direction:"ltr",ogLocale:"lkt_US",autonym:"Lakȟótiyapi"})
});
const safeTag=/^[a-z][a-z0-9-]*$/iu;
const argumentName=/^[a-z][a-z0-9_.-]*$/iu;
const esc=value=>String(value).replace(/[&<>"']/gu,c=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
})[c]);
const TRUSTED=Symbol("site-approved-html");
export const trustedHtml=value=>Object.freeze({[TRUSTED]:String(value)});
export function locale(tag){
  const known=FACES[tag];if(!known)throw new RangeError("Unsupported public locale");
  return known;
}
export const localePath=tag=>tag===DEFAULT_LOCALE?"/":"/"+locale(tag).tag.toLowerCase()+"/";

export function parseArb(input){
  const data=typeof input==="string"?JSON.parse(input):input;
  if(!data||typeof data!=="object"||Array.isArray(data)||!FACES[data["@@locale"]])
    throw new TypeError("One original ARB locale and a mapping of messages is required");
  const units=new Map();
  for(const [key,value] of Object.entries(data)){
    if(key.startsWith("@"))continue;
    if(typeof value!=="string"||value.length>10000)
      throw new TypeError("Invalid authored message "+key);
    const meta=data["@"+key]??{};
    if(!meta||typeof meta!=="object"||Array.isArray(meta))
      throw new TypeError("Invalid authored message metadata "+key);
    units.set(key,Object.freeze({
      message:value,
      evidence:meta["x-l-space"]??null,
      description:meta.description??null
    }));
  }
  return Object.freeze({locale:data["@@locale"],units});
}

export function siteSpace({interfaceSource,renderings,home,estate}={}){
  const original=parseArb(interfaceSource);
  if(original.locale!=="en")throw new TypeError("English original interface source is required");
  const content=parseArb(contentCatalog(home,estate));
  const merged=new Map([...original.units,...content.units]);
  const source=Object.freeze({locale:"en",units:merged});
  const targets=renderings.map(parseArb);
  if(new Set(targets.map(t=>t.locale)).size!==targets.length||
     targets.some(t=>t.locale==="en"))throw new TypeError("Ambiguous translated ARB catalog");
  return Object.freeze({source,targets:Object.freeze(targets)});
}

function matchingClose(input,start){
  let depth=0,quoted=false;
  for(let i=start;i<input.length;i++){
    const c=input[i];
    if(c==="'"){
      if(input[i+1]==="'"){i++;continue;}
      if(input[i+1]==="{"||input[i+1]==="<"||quoted){quoted=!quoted;continue;}
    }
    if(quoted)continue;
    if(c==="{")depth++;
    else if(c==="}"&&--depth===0)return i;
  }
  throw new SyntaxError("Unbalanced ICU message braces");
}
function alternatives(input){
  const out={};let i=0;
  while(i<input.length){
    while(/\s/u.test(input[i]??""))i++;
    if(i===input.length)break;
    const m=/^(zero|one|two|few|many|other|=\d+)\s*\{/u.exec(input.slice(i));
    if(!m)throw new SyntaxError("Invalid ICU plural selection");
    const at=i+m[0].length-1,stop=matchingClose(input,at);
    if(out[m[1]]!==undefined)throw new SyntaxError("Repeated ICU plural arm");
    out[m[1]]=input.slice(at+1,stop);i=stop+1;
  }
  if(out.other===undefined)throw new SyntaxError("ICU plural requires an other arm");
  return out;
}
function renderPattern(message,values={},tags={},html=false,language="en",plural=null){
  let out="";
  const add=text=>{out+=html?esc(text):String(text);};
  for(let i=0;i<message.length;){
    const c=message[i];
    if(c==="'"){
      if(message[i+1]==="'"){add("'");i+=2;continue;}
      if(["{","}","<",">"].includes(message[i+1])){
        const close=message.indexOf("'",i+2);
        if(close<0)throw new SyntaxError("Unterminated ICU quoted literal");
        add(message.slice(i+1,close));i=close+1;continue;
      }
    }
    if(c==="<"){
      const tag=/^<([a-z][a-z0-9-]*)>/iu.exec(message.slice(i));
      if(tag){
        const end="</"+tag[1]+">";
        const next=message.indexOf(end,i+tag[0].length);
        if(next<0)throw new SyntaxError("Unclosed ICU rich tag "+tag[1]);
        const inner=renderPattern(message.slice(i+tag[0].length,next),values,tags,html,language,plural);
        const fn=tags[tag[1]];
        out+=html&&typeof fn==="function"?fn(inner):inner;
        i=next+end.length;continue;
      }
    }
    if(c==="{"){
      const end=matchingClose(message,i),body=message.slice(i+1,end);
      const parts=/^([a-z][a-z0-9_.-]*)(?:\s*,\s*plural\s*,([\s\S]+))?$/iu.exec(body);
      if(!parts||!argumentName.test(parts[1]))
        throw new SyntaxError("Unsupported or malformed ICU argument");
      const value=values[parts[1]];
      if(value===undefined||value===null)
        throw new TypeError("Missing ICU value "+parts[1]);
      if(parts[2]!==undefined){
        const count=Number(value);
        if(!Number.isSafeInteger(count)||count<0)throw new TypeError("ICU plural requires a nonnegative count");
        const arms=alternatives(parts[2]);
        const category=new Intl.PluralRules(language).select(count);
        out+=renderPattern(arms["="+count]??arms[category]??arms.other,
          values,tags,html,language,String(count));
      }else if(html&&value&&typeof value==="object"&&TRUSTED in value){
        out+=value[TRUSTED];
      }else{
        add(value);
      }
      i=end+1;continue;
    }
    if(c==="}")throw new SyntaxError("Unexpected ICU closing brace");
    if(c==="#"&&plural!==null){add(plural);i++;continue;}
    add(c);i++;
  }
  return out;
}
function terms(message){
  // Type-level inventory only. A translation may reorder placeholders and
  // tags but may not invent/remove either.
  const argumentsUsed=[...new Set([...message.matchAll(/\{([a-z][a-z0-9_.-]*)(?=\s*[,}])/giu)]
    .map(m=>m[1]))].sort();
  // ICU plural variants can repeat a tag in distinct arms. Multiplicity
  // of a tag is not its type; preserving its set of names is.
  const tagsUsed=[...new Set([...message.matchAll(/<\/?([a-z][a-z0-9-]*)>/giu)]
    .map(m=>m[1]))].sort();
  return JSON.stringify([argumentsUsed,tagsUsed]);
}
function resolve(space,tag,key){
  const source=space.source.units.get(key);
  if(!source)throw new RangeError("Message has no English source: "+key);
  if(tag==="en")return {unit:source,language:"en",machine:false};
  const unit=space.targets.find(t=>t.locale===tag)?.units.get(key);
  if(!unit||terms(unit.message)!==terms(source.message))
    return {unit:source,language:"en",machine:false};
  // No false integrity claim: x-l-space.source cannot be independently
  // revalidated while the original publisher/source-hash algorithm is absent.
  return {unit,language:tag,machine:(unit.evidence?.for??[]).some(w=>w.kind==="machine")};
}
export function speaker(space,tag,{origin}={}){
  const faces=locale(tag);
  if(new URL(origin).origin!==origin)throw new TypeError("Canonical site origin required");
  const translate=(key,values={},tags={},html=false)=>{
    const reading=resolve(space,tag,key);
    const answer=renderPattern(reading.unit.message,values,tags,html,reading.language);
    return html&&reading.language!==tag
      ?'<span lang="'+esc(reading.language)+'">'+answer+"</span>":answer;
  };
  return Object.freeze({
    tag:faces.tag,faces,prefix:tag==="en"?"":"/"+tag.toLowerCase(),
    has:key=>space.source.units.has(key),
    text:(key,values={})=>translate(key,values,{},false),
    html:(key,values={},tags={})=>translate(key,values,tags,true),
    machine:()=>tag!=="en"&&[...space.source.units.keys()]
      .some(key=>resolve(space,tag,key).machine),
    alternates:()=>[
      ...LOCALES.map(other=>({hreflang:other,href:origin+localePath(other)})),
      {hreflang:"x-default",href:origin+"/"}
    ]
  });
}
// The report is honest about unverified provenance; it never reports a
// "current" translation based solely on a digest from an unavailable codec.
export function report(space){
  const locales={};
  for(const target of space.targets){
    let coverage=0,invalid=0,unchecked=0;
    for(const [key,unit] of target.units){
      const original=space.source.units.get(key);
      if(!original)continue;
      if(terms(original.message)!==terms(unit.message)){invalid++;continue;}
      coverage++;
      if(unit.evidence?.source)unchecked++;
    }
    locales[target.locale]={
      coverage:coverage/space.source.units.size,"ill-typed":invalid,
      "source-witness-unverified":unchecked
    };
  }
  return Object.freeze({locales,sourceIntegrity:"unverified",
    agree:false,counterexamples:["Upstream L-Space witness hash cannot be independently verified"]});
}
const xml=value=>esc(value);
export function sitemapXml(pages){
  if(!Array.isArray(pages))throw new TypeError("Sitemap requires source-owned entries");
  return '<?xml version="1.0" encoding="UTF-8"?>\n'+
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'+
    pages.map(({loc,lastmod,alternates=[]})=>
      "<url><loc>"+xml(loc)+"</loc>"+(lastmod?"<lastmod>"+xml(lastmod)+"</lastmod>":"")+
      alternates.map(x=>'<xhtml:link rel="alternate" hreflang="'+xml(x.hreflang)+
        '" href="'+xml(x.href)+'"/>').join("")+"</url>").join("")+"</urlset>\n";
}
export function localeOfPath(pathname,locales=LOCALES){
  return locales.find(tag=>tag!=="en"&&pathname.toLowerCase().startsWith("/"+tag.toLowerCase()+"/"))??null;
}
function preferred(request,locales){
  const cookie=request.headers.get("cookie")??"";
  const raw=cookie.split(";").map(x=>x.trim()).find(x=>x.startsWith("lang="));
  if(raw){
    let preference;
    try{preference=decodeURIComponent(raw.slice(5));}catch{return "en";}
    if(locales.includes(preference))return preference;
  }
  const accepted=(request.headers.get("accept-language")??"").split(",")
    .map((entry,index)=>{const [language,...attrs]=entry.trim().split(";");
      const rawQ=attrs.find(x=>x.trim().startsWith("q="))?.trim().slice(2);
      const q=rawQ===undefined?1:Number(rawQ);
      return {language:language.toLowerCase(),q:Number.isFinite(q)&&q>=0&&q<=1?q:0,index};})
    .sort((a,b)=>b.q-a.q||a.index-b.index);
  for(const {language,q} of accepted){
    if(q===0)continue;
    if(language==="zh-cn"||language==="zh"||language==="zh-hans")
      return locales.includes("zh-Hans")?"zh-Hans":"en";
    if(language==="lkt"||language.startsWith("lkt-"))
      return locales.includes("lkt")?"lkt":"en";
    if(language==="en"||language.startsWith("en-"))return "en";
  }
  return "en";
}
export function localeRedirect(request,{locales=LOCALES}={}){
  const url=new URL(request.url);
  if(url.pathname!=="/"||!["GET","HEAD"].includes(request.method))return null;
  const tag=preferred(request,locales);
  if(tag==="en")return null;
  return new Response(null,{status:302,headers:{
    location:url.origin+localePath(tag)+url.search,
    vary:"Accept-Language, Cookie",
    "cache-control":"private, no-store"
  }});
}
