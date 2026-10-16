import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assessBackupState,runBackupCheck} from '../Check-NorthflankBackups.mjs';
const now=Date.parse('2026-10-15T05:00:00Z');
const schedule={backupType:'dump',backupCompressionType:'gz',retentionTime:7,scheduling:{interval:'daily',hour:[19],minute:[0]}};
const backup={createdAt:'2026-10-15T03:00:00Z',completedAt:'2026-10-15T03:01:00Z',status:'completed',config:{source:{type:'sameAddon'},compressionType:'gz',size:'100'}};
test('configured schedule and recent native backup pass without claiming scheduled execution',()=>{
 const result=assessBackupState([schedule],[backup],now);assert.equal(result.ok,true);assert.equal(result.scheduledExecutionVerified,false);
});
test('manual backup does not replace missing schedule',()=>{
 const result=assessBackupState([],[backup],now);assert.equal(result.ok,false);assert.equal(result.recentBackupAvailable,true);
});
test('backup older than 26 hours is stale',()=>assert.equal(assessBackupState([schedule],[backup],now+27*3600000).ok,false));
test('empty or future-dated backups cannot pass',()=>{
 assert.equal(assessBackupState([schedule],[{...backup,config:{...backup.config,size:'0'}}],now).ok,false);
 assert.equal(assessBackupState([schedule],[{...backup,completedAt:'2027-01-01T00:00:00Z'}],now).ok,false);
});
test('new failure is visible even if previous backup succeeded',()=>{
 const result=assessBackupState([schedule],[backup,{...backup,createdAt:'2026-10-15T04:00:00Z',status:'failed'}],now);
 assert.equal(result.latestFailed,true);assert.equal(result.ok,false);
});
test('pending backup over thirty minutes is stalled',()=>{
 const result=assessBackupState([schedule],[backup,{...backup,createdAt:'2026-10-15T04:00:00Z',status:'in-progress'}],now);
 assert.equal(result.stalled,true);assert.equal(result.ok,false);
});
test('wrong time, retention, destination or non-native backups do not satisfy policy',()=>{
 for(const changed of [{...schedule,retentionTime:60},{...schedule,scheduling:{...schedule.scheduling,hour:[0,19]}},{...schedule,customDestinationId:'external'}])assert.equal(assessBackupState([changed],[backup],now).scheduleConfigured,false);
 assert.equal(assessBackupState([schedule],[{...backup,config:{...backup.config,source:{type:'snapshot'}}}],now).recentBackupAvailable,false);
});

test('failed verification replaces stale success and never persists SDK error details',async t=>{
 const work=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../work');
 await fs.mkdir(work,{recursive:true});
 const directory=await fs.mkdtemp(path.join(work,'backup-status-test-'));
 t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 await fs.mkdir(path.join(directory,'dist'));
 await fs.writeFile(path.join(directory,'dist/api-client.mjs'),`
 export class ApiClientFileContextProvider { getCurrentName(){return 'jochook-on-deploy';} }
 export class ApiClient { constructor(){throw Object.assign(new Error('SECRET_SENTINEL signed-url token'),{status:401});} }
 `);
 const output=path.join(directory,'status.json');
 await fs.writeFile(output,JSON.stringify({ok:true,verified:true,checkedAt:'2020-01-01T00:00:00Z'}));
 const messages=[];const logger={log:value=>messages.push(value),error:value=>messages.push(value)};
 assert.equal(await runBackupCheck(['--sdk-dir',directory,'--output',output],logger),2);
 const raw=await fs.readFile(output,'utf8');const report=JSON.parse(raw);
 assert.equal(report.ok,false);assert.equal(report.verified,false);assert.equal(report.status,401);
 assert.ok(Date.parse(report.checkedAt)>Date.parse('2020-01-01T00:00:00Z'));
 assert.equal((raw+messages.join('')).includes('SECRET_SENTINEL'),false);
});

test('missing SDK and unwritable output warn that the prior report is not current',async()=>{
 const messages=[];const logger={log:value=>messages.push(value),error:value=>messages.push(value)};
 const missing=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../work/nonexistent-backup-test-directory');
 assert.equal(await runBackupCheck(['--sdk-dir',missing,'--output',path.join(missing,'status.json')],logger),2);
 const report=JSON.parse(messages.at(-1));
 assert.equal(report.verified,false);assert.equal(report.reportPersisted,false);
});
