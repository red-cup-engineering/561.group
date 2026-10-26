#!/usr/bin/env node
// Unpack a privately carried output of the original section publisher.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,isAbsolute,join,resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
const [archive,archiveSha,output,manifestSha]=process.argv.slice(2);
const digest=b=>createHash('sha256').update(b).digest('hex');
if(!archive||!isAbsolute(output??'')||!/^[a-f0-9]{64}$/u.test(archiveSha??'')||!/^[a-f0-9]{64}$/u.test(manifestSha??''))
  throw Error('Expected archive, exact archive SHA256, absolute new output directory and exact manifest SHA256');
const bytes=await readFile(archive);
if(bytes.length>32*1024*1024||digest(bytes)!==archiveSha)throw Error('Section release archive differs from selected source');
const payload=JSON.parse(gunzipSync(bytes,{maxOutputLength:192*1024*1024}));
if(payload.format!=='561.section-release-bundle/v1'||typeof payload.manifest!=='string'||digest(payload.manifest)!==manifestSha||!Array.isArray(payload.files))
  throw Error('Invalid selected section release payload');
const manifest=JSON.parse(payload.manifest);
if(manifest.format!==payload.format||!Array.isArray(manifest.files)||manifest.files.length>50000||manifest.files.length!==payload.files.length)
  throw Error('Release inventory mismatch');
const expected=new Map(manifest.files.map(x=>[x.path,x]));
if(expected.size!==manifest.files.length)throw Error('Duplicate release inventory');
const entries=new Map();let total=0;
for(const file of payload.files){
  const path=file.path;
  if(typeof path!=='string'||path.length>500||!(/^[A-Za-z0-9._/-]+$/u.test(path))||path.startsWith('/')||path.split('/').some(x=>!x||x==='.'||x==='..')||entries.has(path))
    throw Error('Unsafe release payload path');
  const record=expected.get(path);
  if(!record||!Number.isSafeInteger(record.bytes)||record.bytes<0||typeof file.base64!=='string'||file.base64.length!==4*Math.ceil(record.bytes/3))throw Error('Unexpected release payload');
  const b=Buffer.from(file.base64,'base64');total+=b.length;
  if(total>128*1024*1024||b.toString('base64')!==file.base64||b.length!==record.bytes||digest(b)!==record.sha256)throw Error('Release payload differs from manifest');
  entries.set(path,b);
}
await mkdir(output); // An existing directory belongs to another attempt.
for(const [path,b] of entries){const target=join(output,path);await mkdir(dirname(target),{recursive:true});await writeFile(target,b,{flag:'wx'});}
await writeFile(join(output,'manifest.json'),payload.manifest,{flag:'wx'});
execFileSync(process.execPath,[join(output,'engine/sites/release-bundle.mjs'),'verify','--bundle',output,'--manifest',manifestSha],{stdio:'inherit'});
console.log(JSON.stringify({archive:resolve(archive),output,archiveSha256:archiveSha,manifestSha256:manifestSha,files:entries.size}));
