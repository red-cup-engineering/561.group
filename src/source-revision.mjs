// An original site-source receipt is enriched with metadata from the actual
// Cloudflare Worker version executing this request. A source claim alone is
// not an authenticated provider release receipt.
const SHA=/^[a-f0-9]{40}$/iu;
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/iu;
const noStore={'cache-control':'no-store','content-type':'application/json; charset=utf-8'};
const unavailable=reason=>Response.json({error:reason},{status:503,headers:noStore});

/** Preserve authored assets as producer; only enrich the exact release route. */
export async function readSourceRevision(request,env){
  const asset=await env.ASSETS.fetch(new Request(request.url,{method:'GET'}));
  if(asset.status!==200)return asset;
  const version=env.CF_VERSION_METADATA?.id;
  if(typeof version!=='string'||!UUID.test(version))
    return unavailable('Cloudflare Worker version identity not available');
  let source;
  try{
    const text=await asset.text();
    if(text.length>8192) return unavailable('Source receipt exceeds admission bound');
    source=JSON.parse(text);
  }catch{
    return unavailable('Original source receipt is not valid JSON');
  }
  if(source?.repository!=='561-group/561.group'||source?.origin!=='https://561.group'||
     source?.renderer!=='TUFTE'||source?.application!=='LivingWebServer'||
     !SHA.test(source?.sourceCommit??'')){
    return unavailable('Source revision is missing its original producer identity');
  }
  const observed=JSON.stringify({...source,workerVersionId:version.toLowerCase()})+'\n';
  return new Response(request.method==='HEAD'?null:observed,{status:200,headers:noStore});
}
