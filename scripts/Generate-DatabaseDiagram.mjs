import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

// Schema documentation only. No database connection or row data is used.
const out = fileURLToPath(new URL('../docs/diagrams/database/', import.meta.url))
const migrationDir = new URL('../backend/src/main/resources/db/migration/', import.meta.url)
const basis = 'V32 로컬 개발 · 운영 V31 유지 · 2026.10.19'
// Fields below are selected important columns, not a substitute for the Flyway DDL.
// FK identifiers are validated against V1..V32 on every generation.
const tables = [
  { name:'teams', title:'서비스 안의 축구팀', domain:'core', fields:[
    ['PK','id','BIGINT'],['','name / description','VARCHAR'],['','status','PENDING / ACTIVE / INACTIVE'],['','version / created_at','수정 충돌 확인 / 생성 시각']], notes:['모든 팀별 업무 자료의 기준점'] },
  { name:'players', title:'회원·용병 프로필', domain:'core', fields:[
    ['PK','id','BIGINT · 등번호와 별개'],['FK','team_id','teams.id'],['','name / birth_year','이름 / 생년'],['','shirt_number','1~99 또는 NULL'],['','first_choice / second_choice / third_choice','선호 포지션 순위'],['','position / club_role','포지션 분류 / 명단 직책'],['','player_type / active','MEMBER·GUEST / 활동 여부'],['','joined_on / version','가입일 / 수정 버전'],['UK','team_id + active_shirt_number','활동 선수 등번호 중복 방지']], notes:['active_shirt_number는 생성 컬럼','players와 accounts 사이에는 연결 FK 없음'] },
  { name:'tournaments', title:'연도별 참가 대회', domain:'core', fields:[
    ['PK','id','BIGINT'],['FK','team_id','teams.id'],['','name','대회명'],['','start_date / end_date','대회 기간'],['','venue / division / notes','장소 / 참가 부문 / 메모'],['','version','수정 충돌 확인'],['UK','team_id + id','경기의 복합 FK 참조 대상']], notes:['한 대회에 여러 외부 경기 연결 가능'] },
  { name:'match_records', title:'경기 한 건의 기본 정보', domain:'core', fields:[
    ['PK','id','BIGINT'],['FK','team_id','teams.id'],['FK','team_id + tournament_id','tournaments.(team_id,id) · 대회 선택'],['','played_on / kickoff','경기 날짜 / 시작 시각'],['','match_kind','EXTERNAL / INTERNAL'],['','match_format','FOUR_QUARTERS / TWO_HALVES_30'],['','formation_a / formation_b','포메이션 · 자체전 A/B 독립'],['','score_for / score_against','우리:상대 또는 A:B'],['','tournament_stage / recording_stage','대회 단계 / 입력 진행 상태'],['','venue / opponent / notes / version','장소 / 상대 / 메모 / 버전']], notes:['tournament_id NULL = 리그','DB 기본값은 4쿼터 · 새 대회 UI는 전·후반 선택'] },
  { name:'match_participants', title:'01 · 투표와 실제 출석', domain:'lineups', fields:[
    ['PK·FK','match_id','match_records.id'],['PK·FK','player_id','players.id'],['','vote','참석 예정 / 불참 / 미정 / 미투표'],['','attendance','참석 / 지각 / 불참 / 미확인'],['','planned_team','자체전 사전 A/B 배정 · NULL 가능']], notes:['PK (match_id, player_id)','참석 예정과 실제 참석은 별도 기록'] },
  { name:'match_quarters', title:'경기에 포함된 구간', domain:'lineups', fields:[
    ['PK·FK','match_id','match_records.id'],['PK','quarter_number','1~4 · 전·후반은 1/2'],['','goal_events_linked','BOOLEAN · 기본 FALSE · 연결 기록 사용'],['','goals_against','INT NULL · 외부 경기 구간 실점 · V32 개발']], notes:['PK (match_id, quarter_number)','NULL 미입력 / 0 무실점 · 구간 길이 컬럼 없음','자체전 실점은 반대 팀 득점으로 계산'] },
  { name:'match_planned_lineups', title:'02 · 경기 전 계획 배치', domain:'lineups', fields:[
    ['PK·FK','match_id','match_records.id'],['PK','quarter_number / team','구간 번호 / A·B'],['PK','slot / entry_order','자리 / 선발 0·교체 1'],['FK','player_id','players.id'],['UK','match_id + quarter_number + player_id','같은 구간의 양 팀 중복 배치 금지']], notes:['PK (match_id, quarter_number, team, slot, entry_order)','계획은 득점·출전 통계에 합산하지 않음'] },
  { name:'match_appearances', title:'02 · 출전과 스탯 집계값', domain:'lineups', fields:[
    ['PK·FK','match_id','match_records.id'],['PK','quarter_number / team','구간 번호 / A·B'],['PK','slot / entry_order','자리 / 선발 0·교체 1'],['FK','player_id','players.id'],['','goals / assists','골 / 도움'],['','free_kick_goals / penalty_goals','총 골 안의 직접 FK / PK'],['UK','match_id + quarter_number + player_id','같은 구간 중복 출전 금지']], notes:['PK (match_id, quarter_number, team, slot, entry_order)','FK골 + PK골 ≤ goals · 교체 2명은 각각 0.5쿼터'] },
  { name:'match_goal_events', title:'03 · 골 한 건과 도움 연결', domain:'lineups', fields:[
    ['PK·FK','match_id','match_records.id · 경기 삭제 시 CASCADE'],['PK','event_order','경기 전체 이벤트 목록 순서 · 0부터'],['','quarter_number / team','구간 번호 / 득점 팀 A·B'],['FK','scorer_id','players.id · 득점 선수'],['FK','assist_id','players.id · 도움 선수 · NULL 가능'],['','goal_type','NORMAL / FREE_KICK / PENALTY']], notes:['PK (match_id, event_order) · 분/초를 기록하지 않음','자기 도움 금지 · 직접 FK/PK는 도움 없음','같은 구간·같은 팀 출전은 서비스에서 검증'] },
  { name:'accounts', title:'운영진 개인 로그인 계정', domain:'access', fields:[
    ['PK','id','BIGINT'],['UK','username','로그인 ID'],['','password_hash','해시만 저장'],['','credential_version','BIGINT · 이전 로그인 무효화'],['','enabled / service_admin','계정 활성 / 서비스 관리자 여부'],['','role','기존 호환 역할 ADMIN / MEMBER']], notes:['현재 팀 권한은 team_memberships.role에서 결정','선수 명단의 club_role과 권한은 별개'] },
  { name:'account_password_resets', title:'일회용 계정 비밀번호 재설정', domain:'access', fields:[
    ['PK','id','BIGINT'],['FK','account_id','accounts.id · 재설정 대상'],['FK','issued_by','accounts.id · 발급한 서비스 관리자'],['UK','token_hash','재설정 토큰 해시 · 원문 저장 안 함'],['','credential_version','발급 당시 계정 인증 버전'],['','created_at / expires_at','발급 시각 / 30분 유효기간'],['','used_at / revoked_at','사용 / 폐기 시각 · NULL 가능']], notes:['사용·폐기·만료된 링크는 다시 사용 불가','계정 인증 버전이 달라져도 사용 불가'] },
  { name:'team_memberships', title:'계정의 팀별 권한', domain:'access', fields:[
    ['PK','id','BIGINT'],['FK','team_id','teams.id'],['FK','account_id','accounts.id · 삭제 시 CASCADE'],['','role','DIRECTOR / COACH / MEMBER'],['','active / created_at','활성 여부 / 등록 시각'],['UK','team_id + account_id','계정당 같은 팀에 한 행']], notes:['accounts ↔ teams의 다대다 연결 테이블'] },
  { name:'team_invites', title:'감독·코치 초대', domain:'access', fields:[
    ['PK','id','BIGINT'],['FK','team_id','teams.id'],['FK','created_by','accounts.id'],['UK','token_hash','초대 토큰의 해시'],['','display_name / role','초대 이름 / DIRECTOR·COACH'],['','expires_at / used_at / cancelled_at','만료 / 사용 / 취소 시각'],['','version / created_at','수정 버전 / 생성 시각']], notes:['초대받은 계정 ID를 직접 저장하는 컬럼은 없음'] },
  { name:'team_codes', title:'회원 공유 접속 정보', domain:'access', fields:[
    ['PK·FK','team_id','teams.id · 팀당 최대 한 행'],['UK','code_hash','접속 코드의 해시 · NULL 가능'],['','password_hash','팀 비밀번호의 해시'],['FK','issued_by','accounts.id · NULL 가능'],['','version','교체·폐기 때 세션 유효성 검사'],['','issued_at / expires_at / revoked_at','발급 / 만료 / 폐기 시각']], notes:['코드 접속 회원에게 개인 계정 생성은 불필요'] },
  { name:'team_creation_requests', title:'팀 생성 요청의 재시도 보호', domain:'access', fields:[
    ['PK·FK','account_id','accounts.id'],['PK','request_id','요청 UUID'],['','request_hash','요청 내용의 해시'],['FK','team_id','teams.id · 결과 전에는 NULL'],['FK','invite_id','team_invites.id · NULL 가능'],['','created_at','생성 시각']], notes:['PK (account_id, request_id)','같은 팀 생성 요청을 중복 처리하지 않도록 보관'] },
  { name:'team_code_events', title:'팀 코드 발급·교체·폐기 이력', domain:'access', fields:[
    ['PK','id','BIGINT'],['FK','team_id','teams.id'],['FK','actor_account_id','accounts.id'],['','action','ISSUED / ROTATED / REVOKED'],['','occurred_at / expires_at','변경 시각 / 당시 만료 시각'],['UK','team_id + version','팀 코드 버전별 한 행']], notes:['이력에 원문 코드·비밀번호를 보관하지 않음'] },
  { name:'match_record_events', title:'경기 등록·수정·삭제 이력', domain:'audit', fields:[
    ['PK','id','BIGINT'],['FK','team_id','teams.id'],['REF','match_id','match_records.id · FK 없음'],['REF','actor_account_id','accounts.id · FK 없음'],['','actor_username / action / occurred_at','당시 작업자 / 동작 / UTC 시각'],['','before_version / after_version','변경 전후 버전'],['','before_snapshot / after_snapshot','변경 전후 JSON'],['','played_on / match_kind / opponent','당시 경기 요약']], notes:['경기·계정 삭제 후에도 이력을 남기는 구조'] },
  { name:'match_save_requests', title:'경기 저장 영수증', domain:'audit', fields:[
    ['PK·REF','team_id / actor_account_id','팀 / 작업자 · FK 없음'],['PK','request_key','요청 UUID'],['','request_method','POST / PUT'],['REF','target_match_id / match_id','수정 대상 / 저장 결과 · FK 없음'],['','request_fingerprint','본문 대신 해시만 저장'],['','result_version','저장 결과 버전'],['','created_at / completed_at','요청 / 완료 시각']], notes:['PK (team_id, actor_account_id, request_key)','실제 경기 삭제 후 재시도로 새 경기가 생기지 않게 보호'] },
  { name:'flyway_schema_history', title:'Flyway가 관리하는 스키마 이력', domain:'metadata', fields:[
    ['PK','installed_rank','적용 순서'],['','version / description / script','마이그레이션 버전과 파일'],['','checksum / success','스크립트 지문 / 성공 여부'],['','installed_by / installed_on','적용 주체 / 시각']], notes:['업무 테이블과 FK 없음','Flyway가 생성·관리 · 직접 편집하지 않음'] },
]
const fk = [
 ['fk_goal_event_match','match_records','match_goal_events','match_id'],['fk_goal_event_scorer','players','match_goal_events','scorer_id'],['fk_goal_event_assist','players','match_goal_events','assist_id',true],
 ['fk_password_reset_account','accounts','account_password_resets','account_id'],['fk_password_reset_issuer','accounts','account_password_resets','issued_by'],
 ['fk_players_team','teams','players','team_id'],['fk_match_records_team','teams','match_records','team_id'],
 ['fk_tournament_team','teams','tournaments','team_id'],['fk_match_team_tournament','tournaments','match_records','team_id+tournament_id',true],
 ['fk_participant_match','match_records','match_participants','match_id'],['fk_participant_player','players','match_participants','player_id'],
 ['fk_quarter_match','match_records','match_quarters','match_id'],['fk_planned_match','match_records','match_planned_lineups','match_id'],['fk_planned_player','players','match_planned_lineups','player_id'],
 ['fk_appearance_match','match_records','match_appearances','match_id'],['fk_appearance_player','players','match_appearances','player_id'],
 ['fk_membership_team','teams','team_memberships','team_id'],['fk_membership_account','accounts','team_memberships','account_id'],
 ['fk_invite_team','teams','team_invites','team_id'],['fk_invite_creator','accounts','team_invites','created_by'],
 ['fk_code_team','teams','team_codes','team_id',false,true],['fk_code_issuer','accounts','team_codes','issued_by',true],
 ['fk_creation_account','accounts','team_creation_requests','account_id'],['fk_creation_team','teams','team_creation_requests','team_id',true],['fk_creation_invite','team_invites','team_creation_requests','invite_id',true],
 ['fk_code_event_team','teams','team_code_events','team_id'],['fk_code_event_actor','accounts','team_code_events','actor_account_id'],['fk_match_event_team','teams','match_record_events','team_id'],
]
const logical = [
 ['match_quarters','match_goal_events','match_id + quarter_number · DB 복합 FK 없음'],
 ['match_appearances','match_goal_events','구간·팀·득점자·도움 선수 출전 검증 · DB FK 없음'],
 ['match_records','match_record_events','match_id'],['accounts','match_record_events','actor_account_id'],
 ['teams','match_save_requests','team_id'],['accounts','match_save_requests','actor_account_id'],
 ['match_records','match_save_requests','target_match_id / match_id'],
 ['match_quarters','match_appearances','match_id + quarter_number · DB 복합 FK 없음'],
 ['match_participants','match_appearances','match_id + player_id · 서비스가 참가·출석 검증'],
 ['match_participants','match_planned_lineups','match_id + player_id · 서비스가 투표·팀 검증'],
]
const sources = (await fs.readdir(migrationDir)).filter(file=>/^V\d+__.*\.sql$/.test(file)&&Number(file.match(/^V(\d+)/)[1])<=31).sort((a,b)=>Number(a.match(/^V(\d+)/)[1])-Number(b.match(/^V(\d+)/)[1]))
const sql = (await Promise.all(sources.map(file=>fs.readFile(new URL(file,migrationDir),'utf8')))).join('\n')
const actualNames=[...sql.matchAll(/CREATE TABLE\s+(\w+)/g)].map(m=>m[1]).sort()
const mappedNames=tables.filter(t=>t.domain!=='metadata').map(t=>t.name).sort()
const actualFks=[...sql.matchAll(/(?:ADD )?CONSTRAINT\s+(\w+)\s+FOREIGN KEY/g)].map(m=>m[1]).sort()
if(JSON.stringify(actualNames)!==JSON.stringify(mappedNames)) throw Error('Database table catalog differs from V1..V32 CREATE TABLE statements')
if(JSON.stringify(actualFks)!==JSON.stringify(fk.map(r=>r[0]).sort())) throw Error('FK catalog differs from V1..V32 constraints')
const sqlFkSignatures=[]
for(const statement of sql.replace(/^\s*--.*$/gm,'').split(';')){
 const owner=statement.match(/(?:CREATE TABLE|ALTER TABLE)\s+(\w+)/)?.[1]
 for(const match of statement.matchAll(/CONSTRAINT\s+(\w+)\s+FOREIGN KEY\s*\(([^)]+)\)\s+REFERENCES\s+(\w+)/g))
  sqlFkSignatures.push([match[1],match[3],owner,match[2].replace(/\s/g,'').replaceAll(',','+')].join('|'))
}
if(JSON.stringify(sqlFkSignatures.sort())!==JSON.stringify(fk.map(r=>r.slice(0,4).join('|')).sort())) throw Error('FK endpoints or columns differ from V1..V32')
await fs.mkdir(out,{recursive:true})
await fs.writeFile(path.join(out,'schema.json'),JSON.stringify({basis,scope:'Important columns, physical FK constraints and selected logical references; not row data.',tables,foreignKeys:fk.map(([name,parent,child,column,parentOptional=false,childUnique=false])=>({name,parent,child,column,parentOptional,childUnique})),logicalReferences:logical.map(([parent,child,column])=>({parent,child,column})),sources},null,2)+'\n')

const C={bg:'#f7f8f4',ink:'#203a33',muted:'#5d7168',line:'#9bb0a4',green:'#246b51',mint:'#e7f3eb',blue:'#285d86',sky:'#edf4fa',amber:'#8b5b18',cream:'#fff4df',border:'#cfddd4'}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))
let a=[],w=1800,h=1200
function text(x,y,lines,{size=21,color=C.ink,weight=400,gap=30,anchor='start',mono=false}={}){for(const [i,line] of (Array.isArray(lines)?lines:[lines]).entries()) a.push(`<text x="${x}" y="${y+i*gap}" font-size="${size}" fill="${color}" font-weight="${weight}" text-anchor="${anchor}"${mono?' font-family="Consolas, monospace"':''}>${esc(line)}</text>`)}
function rect(x,y,width,height,{fill='#fff',stroke=C.border,r=18,dash=false}={}){a.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"${dash?' stroke-dasharray="9 6"':''}/>`)}
function line(points,label='',{dashed=false,x,y,size=18}={}){a.push(`<path d="${points.map(([xx,yy],i)=>`${i?'L':'M'} ${xx} ${yy}`).join(' ')}" stroke="${dashed?C.amber:C.green}" stroke-width="2.4" fill="none"${dashed?' stroke-dasharray="9 7"':''} marker-end="url(#arrow)"/>`);if(label){const p=points[Math.floor(points.length/2)];text(x??p[0],y??p[1]-14,label,{size,color:dashed?C.amber:C.green,anchor:'middle',weight:600})}}
function begin(title,subtitle,height=1200,width=1800){w=width;h=height;a=[`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title desc"><title id="title">${esc(title)}</title><desc id="desc">${esc(subtitle)}. ${basis}. 실선은 DB 외래키, 점선은 DB 외래키가 없는 논리 참조.</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 L9 5 L1 9" fill="none" stroke="${C.line}" stroke-width="1.6"/></marker></defs><rect width="${w}" height="${h}" fill="${C.bg}"/><g font-family="Malgun Gothic, Apple SD Gothic Neo, Noto Sans KR, sans-serif">`];text(52,43,'JOCHOOK ON / 조축ON',{size:20,color:C.green,weight:700});text(w-52,43,basis,{size:19,color:C.muted,anchor:'end'});text(52,99,title,{size:38,weight:700});text(52,140,subtitle,{size:22,color:C.muted})}
const rendered=[]
async function end(id,label){text(52,h-29,'PK 기본키 · FK 실제 외래키 · UK 유일키 · REF 논리 참조 · 핵심 필드만 표시',{size:17,color:C.muted});text(w-52,h-29,'실제 회원·경기·계정·비밀값 없음',{size:17,color:C.muted,anchor:'end'});a.push('</g></svg>');const svg=a.join('\n');await fs.writeFile(path.join(out,id+'.svg'),svg+'\n');rendered.push({id,label,svg,width:w,height:h})}
function group(x,y,width,height,title,lines,fill='#fff'){rect(x,y,width,height,{fill});text(x+23,y+39,title,{size:27,color:C.green,weight:700});text(x+23,y+84,lines,{size:21,gap:32})}
function table(name,x,y,width,{ref=false}={}){const t=tables.find(t=>t.name===name);const rows=ref?t.fields.slice(0,1):t.fields;const notes=ref?['같은 테이블을 연결 설명을 위해 다시 표시']:t.notes;const height=106+rows.length*54+notes.length*28;rect(x,y,width,height,{fill:ref?C.sky:'#fff'});text(x+22,y+33,name,{size:23,color:C.green,weight:700,mono:true});text(x+22,y+65,t.title+(ref?' · 참조 노드':''),{size:20,color:C.muted});a.push(`<path d="M ${x} ${y+82} H ${x+width}" stroke="${C.border}"/>`);rows.forEach(([key,name,detail],i)=>{const yy=y+111+i*54;const color=key.includes('REF')?C.amber:key.includes('FK')?C.blue:key.includes('PK')?C.green:C.ink;if(key)text(x+20,yy,key,{size:16,color,weight:700});text(x+94,yy,name,{size:18,color,weight:key?600:400,mono:true});text(x+94,yy+24,detail,{size:17,color:C.muted})});notes.forEach((n,i)=>text(x+22,y+103+rows.length*54+i*28,n,{size:16,color:C.muted}));return {x,y,w:width,h:height}}
function relation(x,y,parent,child,relation,{logical=false}={}){line([[x,y],[x+95,y]],'',{dashed:logical});text(x+115,y+6,`${parent} → ${child}`,{size:20,color:logical?C.amber:C.green,weight:600});text(x+115,y+36,relation,{size:18,color:C.muted})}

begin('데이터베이스 구조 · 무엇이 어디에 저장될까?','18개 업무 테이블 + Flyway 관리 테이블 1개. 선수 명단, 실제 기록, 접속 권한을 나눠 저장합니다.',1310)
group(60,190,490,230,'팀과 선수',['teams · 축구팀','players · 회원·용병 프로필','등번호는 선수 PK가 아님','활동 선수 등번호는 팀 안에서 중복 금지'],C.mint)
group(655,190,490,230,'대회와 경기',['tournaments · 대회 기간·부문','match_records · 날짜·스코어·형식','팀 1 : 선수/대회/경기 0..N','대회 1 : 경기 0..N · 리그는 대회 없음'],C.mint)
group(1250,190,490,230,'기록이 쌓이는 단계',['match_participants · 01 투표·출석','match_quarters · 구간 1/2 또는 1~4','match_planned_lineups · 02 배치 호환','match_appearances · 02 배치 / 03 스탯','match_goal_events · 골·도움 연결'],C.mint)
line([[550,298],[655,298]],'팀 FK',{x:602,y:278});line([[1145,298],[1250,298]],'경기 FK',{x:1197,y:278})
group(60,545,800,355,'개인 계정과 팀 접근',['accounts · 개인 로그인 / 서비스 관리자','account_password_resets · 일회용 비밀번호 재설정','team_memberships · 팀별 감독·코치·회원 권한','team_invites · 운영진 초대','team_codes · 회원용 팀 코드·비밀번호 해시','team_creation_requests · 팀 생성 중복 방지','team_code_events · 코드 발급·교체·폐기 이력'],C.sky)
group(965,545,775,355,'이력과 중복 저장 보호',['match_record_events · 변경 전후 JSON와 작업 시각','match_save_requests · 요청 키와 저장 결과 영수증','','이력: team_id만 실제 FK','영수증: 모든 ID가 논리 참조 · FK 없음','원본 경기 삭제 후에도 이력·영수증을 보존'],C.cream)
line([[300,420],[300,545]],'팀 1 → 권한·접속 0..N',{x:470,y:495})
line([[1470,420],[1470,545]],'경기·작업자 ID 논리 참조',{dashed:true,x:1470,y:495})
line([[860,720],[965,720]],'작업자',{dashed:true,x:913,y:700})
group(60,960,800,245,'집계 테이블은 따로 만들지 않았어요',['선수 스탯 = 실제 출전 + 실제 출석을 조회해서 계산','연결한 골 → 출전별 스탯 → 완료 경기 집계','교체 각각 0.5쿼터 · 새 대회 풀타임 2쿼터','리그·대회 합산은 시간 환산 없이 구간 수를 합산'])
group(965,960,775,245,'별도 관리와 읽는 법',['flyway_schema_history · 스키마 변경 이력','DB 세션 테이블 없음 · 현재 서버 HttpSession 사용','실선 = DB FK / 점선 = FK 없는 논리 참조','확대 상세 5장과 전체 Mermaid 관계도를 함께 제공'])
await end('00-overview','전체 구조')

begin('01 · 팀, 선수, 대회, 경기','FK 행의 오른쪽은 참조 대상입니다. team_id로 자료를 구분하고, 대회 연결은 같은 팀인지 DB에서도 확인합니다.',1760)
table('teams',60,190,510);table('tournaments',665,190,530);table('players',60,760,600);table('match_records',1110,700,630)
line([[570,320],[665,320]],'1 → 0..N',{x:618,y:300})
line([[315,540],[315,760]],'팀 1 → 선수 0..N',{x:440,y:680})
line([[570,490],[615,490],[615,170],[1650,170],[1650,700]],'팀 1 → 경기 0..N',{x:1460,y:195})
line([[1195,500],[1300,500],[1300,700]],'대회 1 → 경기 0..N',{x:1480,y:550})
text(1480,580,'경기당 대회 0..1',{size:18,color:C.muted,anchor:'middle'})
group(60,1490,1680,180,'연결에서 중요한 점',['선수의 club_role은 명단용 직책이고, 로그인 수정 권한은 team_memberships.role에서 결정합니다.','대회 FK는 (team_id, tournament_id) → tournaments.(team_id, id)입니다. 선수·경기·대회는 각각 같은 팀에 속합니다.','계정과 선수 프로필을 자동으로 같은 사람으로 묶는 FK는 아직 없습니다.'])
await end('01-team-match','팀·선수·대회·경기')

begin('02 · 참석, 배치, 출전','현재 UI는 02에서 배치·기록을 함께 저장합니다. 기존 계획 테이블은 호환을 위해 유지하며 통계는 출전 기록을 조회합니다.',1860)
table('match_records',60,190,760,{ref:true});table('players',980,190,760,{ref:true})
table('match_participants',60,470,760);table('match_quarters',980,470,760)
table('match_planned_lineups',60,1080,760);table('match_appearances',980,1080,760)
line([[440,378],[440,470]],'1 → 0..N 참가자',{x:580,y:435})
line([[820,280],[900,280],[900,425],[1360,425],[1360,470]],'경기 1 → 구간 0..N',{x:1150,y:453})
line([[1360,378],[1360,405],[760,405],[760,470]],'선수 1 → 참가 0..N',{x:810,y:392})
relation(60,965,'match_records / players','계획·실제 출전','각 행은 경기 1개·선수 1명에 연결 · 경기/선수 1 : 배치 0..N')
relation(980,920,'match_quarters / match_participants','배치','구간·참가·출석·사전 팀 일치는 서비스가 검증 · 복합 FK 없음',{logical:true})
group(60,1660,1680,125,'구간·교체 규칙',['구간 수 2/4 · 같은 구간 선수 중복 금지 · 선발 0 / 교체 1 · 한 자리에 두 명이면 각각 0.5쿼터'])
await end('02-lineups','투표·계획·실제')

begin('03 · 로그인, 팀 권한, 초대와 복구','FK 행마다 참조 대상이 명시되어 있습니다. 계정 복구 토큰은 해시로만 보관하고 30분 안에 한 번 사용합니다.',2840)
table('teams',60,190,510,{ref:true});table('accounts',665,190,530);table('team_memberships',1280,190,460)
line([[570,280],[610,280],[610,150],[1510,150],[1510,190]],'팀 1 → 소속 0..N',{x:1000,y:175})
line([[1195,350],[1280,350]],'1 → 0..N',{x:1238,y:330,size:16})
table('team_invites',60,780,510);table('team_codes',665,780,530);table('team_code_events',1280,780,460)
table('team_creation_requests',60,1420,710)
group(875,1440,865,365,'카디널리티 · 부모 : 자식',['teams 1 : team_memberships / team_invites 0..N','teams 1 : team_codes 0..1','teams 1 : team_code_events 0..N','accounts 1 : memberships / invites / events 0..N','accounts 0..1 : team_codes 0..N (issued_by 선택)','accounts 1 : team_creation_requests 0..N'])
group(875,1845,865,350,'팀 생성과 로그인은 이렇게 이어져요',['team_creation_requests.team_id → teams.id (선택)','team_creation_requests.invite_id → team_invites.id (선택)','한 결과 팀·초대에 요청 여러 개를 연결할 수 있는 DB 구조','회원 코드 세션: 24시간 미사용 / 최대 7일','운영진은 개인 계정 + 활성 팀 소속 권한으로 입력·수정','service_admin은 팀 감독 권한과 별개의 서비스 관리 권한','로컬 개인 계정: 7일 미사용 만료','메모리 세션 · 서버 재시작 시 재로그인'])
table('account_password_resets',60,2220,860)
table('accounts',1100,2220,640,{ref:true})
line([[1100,2331],[1010,2331],[1010,2385],[920,2385]])
line([[1100,2331],[1050,2331],[1050,2439],[920,2439]])
group(1100,2470,640,270,'복구 대상과 발급자는 별개의 FK',['accounts 1 : 재설정 요청 0..N (account_id)','accounts 1 : 발급한 요청 0..N (issued_by)','계정 인증 버전 = 발급 당시 버전일 때만 사용','새 비밀번호 설정 후 이전 로그인 무효화','원문 토큰·새 비밀번호는 이 표에 저장 안 함'])
await end('03-access','인증·권한·복구')

begin('04 · 변경 이력과 중복 저장 보호','실제 FK가 없어도 이름이 비슷한 ID가 존재합니다. 이력·영수증은 원본 삭제 후에도 남도록 설계했습니다.',1900)
table('teams',60,190,480,{ref:true});table('accounts',660,190,480,{ref:true});table('match_records',1260,190,480,{ref:true})
table('match_record_events',60,620,800);table('match_save_requests',940,620,800)
line([[300,378],[300,620]],'1 → 0..N · 실제 FK',{x:480,y:510})
line([[900,378],[900,500],[680,500],[680,620]],'작업자 참조',{dashed:true,x:780,y:480})
line([[1500,378],[1500,470],[780,470],[780,620]],'경기 참조',{dashed:true,x:1180,y:450})
line([[900,500],[1240,500],[1240,620]],'팀·계정·경기: FK 없이 ID만 보관',{dashed:true,x:1320,y:560})
table('flyway_schema_history',60,1390,800)
group(940,1390,800,345,'이력이 남는 이유',['match_record_events: team_id만 FK가 있어요.','match_id·actor_account_id는 원본이 없어도 유지해요.','match_save_requests는 FK를 하나도 두지 않아요.','그래서 원본을 지워도 같은 요청 키의 재시도를 식별해요.','논리 참조는 부모 행이 이미 없어졌을 수 있어 0..1이에요.','Flyway 관리 테이블은 업무 데이터와 연결하지 않아요.'])
await end('04-audit','이력·저장 영수증')

begin('05 · 골 한 건, 득점 선수, 도움 선수','V31 운영 반영. 구간별 연결 기록에서 출전별 골·도움을 계산하고 기존 시즌 조회에 전달합니다.',1840)
table('match_records',60,190,700,{ref:true});table('players',1040,190,700,{ref:true})
table('match_goal_events',430,565,940)
line([[410,378],[410,676],[430,676]],'경기 1 : 골 0..N',{x:235,y:500})
line([[1390,378],[1390,838],[1370,838]],'득점자 1',{x:1570,y:715})
line([[1510,378],[1510,892],[1370,892]],'도움 선수 0..1',{x:1570,y:955})
text(1530,1000,'각 선수 1 : 골 기록 0..N',{size:18,color:C.muted,anchor:'middle'})
group(60,1190,800,240,'구간마다 기록 방식을 구분',['match_quarters.goal_events_linked 기본 FALSE','FALSE: 기존 선수별 합계만 유지 · 연결을 추측하지 않음','TRUE: 골 목록이 원본 · 빈 목록은 명시적인 0골','기존 합계와 일치하는 연결 기록을 입력한 뒤 전환'])
group(940,1190,800,240,'DB 제약과 서비스 검증',['DB: 자기 도움 금지 · 직접 FK/PK에 도움 금지','서비스: 득점자·도움 선수 같은 구간·같은 팀 출전','구간·출전 테이블과 복합 FK는 없음','team은 같은 구간 출전 배치의 A/B팀과 일치'])
group(60,1480,1680,290,'집계와 기존 자료 보호',['V32 개발: match_quarters.goals_against → UI 최종 스코어 합산','연결 기록 → match_appearances 골·도움·직접 FK·PK 합계 → 기존 선수 시즌 조회','기록 완료 여부와 기간·리그·대회 필터는 기존 집계 규칙을 유지합니다.','기존 골·도움을 임의의 선수 조합으로 연결하지 않습니다. 이전 입력 방식의 구간을 그대로 조회할 수 있습니다.','운영 DB V31 적용과 기존 자료 지문 일치를 확인했습니다. 이 그림에는 실제 자료를 넣지 않았습니다.'])
await end('05-goals','골·도움 연결')

// Mermaid records every physical FK individually. Dotted Mermaid edges are
// non-identifying relationships, so comments and labels explicitly say REF / NO FK.
let mermaid='%% 조축ON · '+basis+'\n%% Solid lines: physical FK. Dotted REF lines: application-only logical references.\n%% Important columns only; exact SQL types/checks are in Flyway V1..V32.\nerDiagram\n'
function sqlType(tableName,name){
 if(tableName==='flyway_schema_history'&&name==='version')return 'VARCHAR'
 if(['before_snapshot','after_snapshot'].includes(name))return 'JSON'
 if(['active','enabled','service_admin','goal_events_linked'].includes(name))return 'BIT'
 if(name==='success')return 'BOOLEAN'
 if(['goals_against','quarter_number','event_order','entry_order','shirt_number','active_shirt_number','birth_year','goals','assists','free_kick_goals','penalty_goals','score_for','score_against','installed_rank','checksum'].includes(name))return 'INT'
 if(['id','team_id','player_id','scorer_id','assist_id','match_id','tournament_id','actor_account_id','account_id','invite_id','target_match_id','created_by','issued_by','version','before_version','after_version','result_version','credential_version'].includes(name))return 'BIGINT'
 if(['played_on','start_date','end_date','joined_on'].includes(name))return 'DATE'
 if(name==='kickoff')return 'TIME'
 if(name.endsWith('_at')||name==='installed_on')return ['match_record_events','match_save_requests'].includes(tableName)?'DATETIME':'TIMESTAMP'
 if(['code_hash','token_hash','request_hash','request_id','request_key','request_fingerprint'].includes(name))return 'CHAR'
 return 'VARCHAR'
}
for(const t of tables){
 mermaid+=`  ${t.name} {\n`;const columns=new Map()
 for(const [key,n,description]of t.fields){
  if(key==='UK'&&n.includes('+')){
   for(const name of n.split(/\s*\+\s*/))if(!columns.has(name))columns.set(name,{marks:new Set(),description:'복합 UK 일부: '+n})
   continue
  }
  for(const name of n.split(/\s*[\/+]+\s*/)){
   if(!/^[a-z_]+$/.test(name))continue
   const previous=columns.get(name);const marks=new Set(previous?.marks??[])
   for(const marker of ['PK','FK','UK'])if(key.includes(marker))marks.add(marker)
   columns.set(name,{marks,description:previous?.description??description})
  }
 }
 if(t.name==='players')columns.set('active_shirt_number',{marks:new Set(),description:'generated from active and shirt_number; composite UK with team_id'})
 for(const [name,{marks,description}]of columns)mermaid+=`    ${sqlType(t.name,name)} ${name}${marks.size?' '+[...marks].join(', '):''} "${description.replaceAll('"','')}"\n`
 mermaid+='  }\n'
}
for(const [,parent,child,column,optional=false,unique=false]of fk)mermaid+=`  ${parent} ${optional?'|o':'||'}--${unique?'o|':'o{'} ${child} : "FK ${column}"\n`
for(const [parent,child,column]of logical)mermaid+=`  ${parent} |o..o{ ${child} : "REF NO FK ${column}"\n`
await fs.writeFile(path.join(out,'schema.mmd'),mermaid)
const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>조축ON DB 구조 · V32 로컬 / 운영 V31</title><style>*{box-sizing:border-box}body{margin:0;font-family:'Malgun Gothic',sans-serif;background:${C.bg};color:${C.ink}}header{position:sticky;top:0;z-index:1;background:#fff;padding:16px 22px;border-bottom:1px solid ${C.border}}h1{font-size:22px;margin:0 0 10px}nav{display:flex;gap:8px;flex-wrap:wrap}button,a{font:inherit}button{padding:10px 14px;background:white;color:${C.ink};border:1px solid ${C.border};border-radius:9px;cursor:pointer}button[aria-selected=true]{background:${C.green};color:white}button:focus-visible,a:focus-visible{outline:3px solid #b48128;outline-offset:2px}main{max-width:1800px;margin:auto}section[hidden]{display:none}.figure{overflow:auto}.figure img{display:block;width:100%;height:auto;min-width:1050px}section p{padding:0 24px;line-height:1.7}footer{padding:16px 24px;line-height:1.7;color:${C.muted}}a{color:${C.green}}@media print{header,footer,section p{display:none}section[hidden]{display:block}.figure img{min-width:0}section{break-after:page}@page{size:A3 landscape;margin:7mm}}</style></head><body><header><h1>조축ON 데이터베이스 · ${basis}</h1><nav role="tablist" aria-label="DB 그림 선택">${rendered.map(({label},i)=>`<button id="tab-${i}" role="tab" aria-controls="panel-${i}" aria-selected="${i===0}" type="button">${label}</button>`).join('')}</nav></header><main>${rendered.map(({id,label},i)=>`<section id="panel-${i}" role="tabpanel" aria-labelledby="tab-${i}"${i?' hidden':''}><div class="figure"><img src="${id}.svg" alt="${label} 데이터베이스 관계도"></div><p><a href="${id}.svg" target="_blank" rel="noopener">이 그림 크게 열기 / SVG 저장</a> · <a href="schema.mmd">전체 Mermaid 원본</a> · <a href="schema.json">구조 JSON</a></p></section>`).join('')}</main><footer>실선은 실제 DB 외래키, 점선은 DB 외래키가 없는 논리 참조입니다. 1은 한 행, 0..1은 없거나 한 행, 0..N은 없거나 여러 행을 뜻합니다.<br>모바일에서는 그림을 가로로 밀어 볼 수 있습니다. 그림은 Flyway V1~V32과 로컬 코드로 생성했습니다. 운영 DB는 V31이며, V32 쿼터 실점은 아직 로컬 개발 상태입니다. 실제 DB 행을 포함하지 않으며, 그림 갱신은 운영 마이그레이션 적용을 뜻하지 않습니다.</footer><script>const tabs=[...document.querySelectorAll('[role=tab]')],panels=[...document.querySelectorAll('[role=tabpanel]')];tabs.forEach((t,i)=>t.addEventListener('click',()=>{tabs.forEach((x,j)=>{x.setAttribute('aria-selected',String(i===j));panels[j].hidden=i!==j})}));</script></body></html>`
await fs.writeFile(path.join(out,'index.html'),html)
if(process.argv.includes('--png')){const require=createRequire(import.meta.url);const sharp=require(process.env.JOCHOOK_DIAGRAM_SHARP||'sharp');for(const {id,svg}of rendered)await sharp(Buffer.from(svg)).png().toFile(path.join(out,id+'.png'))}
console.log(JSON.stringify({output:out,basis,businessTables:actualNames.length,metadataTables:1,foreignKeys:fk.length,logicalReferences:logical.length,diagrams:rendered.length,png:process.argv.includes('--png')}))
