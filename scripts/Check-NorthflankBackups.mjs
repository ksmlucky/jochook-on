import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';

export function assessBackupState(schedules, backups, now = Date.now()) {
  const scheduleConfigured = schedules.some(s => s.backupType === 'dump'
    && s.backupCompressionType === 'gz' && !s.customDestinationId
    && s.retentionTime === 7 && s.scheduling?.interval === 'daily'
    && JSON.stringify(s.scheduling.hour) === '[19]'
    && JSON.stringify(s.scheduling.minute) === '[0]');
  const native = backups.filter(b => b.config?.source?.type === 'sameAddon'
    && ['gz', 'zstd'].includes(b.config?.compressionType))
    .sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const completed = native.filter(b => b.status === 'completed'
    && Number(b.config.size) > 0 && Number.isFinite(Date.parse(b.completedAt)));
  const newest = completed.sort((a,b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))[0];
  const ageHours = newest ? (now - Date.parse(newest.completedAt)) / 3600000 : null;
  const recentBackupAvailable = ageHours !== null && ageHours >= 0 && ageHours <= 26;
  const latestFailed = ['failed','aborted','not-supported'].includes(native[0]?.status);
  const stalled = native.some(b => ['scheduled','in-progress','aborting'].includes(b.status)
    && now - Date.parse(b.createdAt) > 30 * 60000);
  return {
    checkedAt: new Date(now).toISOString(),
    ok: scheduleConfigured && recentBackupAvailable && !latestFailed && !stalled,
    scheduleConfigured, expectedTimeKst:'04:00', expectedRetentionDays:7,
    recentBackupAvailable, latestCompletedAt:newest?.completedAt ?? null,
    ageHours:ageHours === null ? null : Math.round(ageHours * 100) / 100,
    latestAttemptStatus:native[0]?.status ?? null, latestFailed, stalled,
    // A successful manual backup is not proof that the daily scheduler ran.
    scheduledExecutionVerified:false,
  };
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const {values} = parseArgs({options:{
    'sdk-dir':{type:'string',default:path.join(root,'work/tools/northflank/node_modules/@northflank/js-client')},
    context:{type:'string',default:'jochook-on-deploy'},
    project:{type:'string',default:'default'}, addon:{type:'string',default:'jochook-on-mysql'},
    output:{type:'string',default:path.join(root,'work/northflank-backup-status.json')},
  }});
  const {ApiClient,ApiClientFileContextProvider} = await import(pathToFileURL(path.resolve(values['sdk-dir'],'dist/api-client.mjs')));
  const context = new ApiClientFileContextProvider();
  if(context.getCurrentName() !== values.context) throw Error('Unexpected CLI context.');
  const client = new ApiClient(context,{throwErrorOnHttpErrorCode:true});
  const parameters = {projectId:values.project,addonId:values.addon};
  const [schedules,backups] = await Promise.all([
    client.get.addon.backupSchedules.all({parameters}),client.get.addon.backups.all({parameters}),
  ]);
  const report = assessBackupState(schedules.data.schedules ?? [],backups.data.backups ?? []);
  await fs.writeFile(values.output,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
  if(!report.ok) process.exitCode=1;
}

if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error=>{
    // Do not log SDK errors verbatim: they can carry connection details or signed URLs.
    console.error(JSON.stringify({ok:false,verified:false,status:error.status ?? null,message:'Backup status unavailable; check CLI login, read permission and SDK path.'}));
    process.exitCode=2;
  });
}
