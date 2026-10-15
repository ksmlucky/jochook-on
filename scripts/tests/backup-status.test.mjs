import test from 'node:test';
import assert from 'node:assert/strict';
import {assessBackupState} from '../Check-NorthflankBackups.mjs';
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
