# 운영 DB 백업과 복구

## 후속 읽기 점검 — 2026-10-16 15:03 KST

API 조회는 성공(`verified:true`)했으나 자동 일정은 없고, native 최신 완료는 10/15 08:38 KST(약30.42시간 전)였다. 실패·정체는 없었다. **10/15 23:45 로컬 DPAPI 사본은 별도로 존재**하므로 모든 사본이 30시간 전이라는 뜻이 아니다. 이 점검은 백업 생성·복원·권한 변경을 수행하지 않았다.

`Check-NorthflankBackups.mjs`는 이제 인증·연결·SDK 실패 때도 최신 확인 시각과 `verified:false`를 상태 JSON에 기록한다. 과거 성공 JSON이 남아 최신 성공처럼 보이던 문제를 수정했다. 조회 성공/정책 불충족은 종료1, 확인 불가 또는 결과 기록 실패는 종료2다. 9개 회귀 검증 통과.

무료 cron 2개는 [공식 가격표](https://northflank.com/pricing)에 있으나, 자동 DB 백업·외부 저장·전송까지 무료라는 근거는 아니다. daily 거절 계정에서 weekly가 무료인지 공개 자료만으로 확인하지 못했다. [운영 저장소 문서](https://northflank.com/docs/v1/application/production-workloads/persistent-storage-in-production)의 job 백업·외부 반출은 후보로만 검토한다. [후속 과제·지원 문의 초안](home-account-followup-2026-10-16.md)의 허용 주기·독립 목적지·복구 키 보관을 확인한 뒤 실제 자동 실행과 격리 복원을 검증한다.

## 최신 배포 전 사본 — 2026-10-15 23:45 KST

대회·기록 확장 배포 전 V23 운영 자료 16개 테이블을 일관된 스냅샷으로 읽어 DPAPI 암호화하고 새 네이티브 MySQL에 격리 복원했습니다. 전체 행 지문과 스키마 이력을 대조한 뒤 임시 복원 데이터를 정리했습니다. API 정지 후 백업 이후 변경이 없음을 재확인하고, V28 배포 후 기존 업무 자료 보존도 확인했습니다. Git 제외 경로는 `backups/northflank/20261015-before-tournament-expansion/`이며 평문 SQL 파일은 만들지 않았습니다. [검증·복구 경계](release-tournament-expansion-2026-10-15.md).

**자동 daily 백업과 PC 밖 독립 사본은 여전히 미설정**입니다. 아래 08시 검증과 별도의 최신 수동 배포 사본입니다.

## 현재 상태 — 2026-10-15

- Northflank 기본 저장소에 native dump(gzip) 백업 한 개를 생성했다. 한국 시간 08:38 완료, 압축 크기 7,415바이트다. 서버의 백업 상태는 `completed`다.
- 내려받은 압축본은 메모리에서 Windows DPAPI로 암호화했다. `backups/northflank/20261015-native-recovery-check/`는 Git 제외 경로다. 다운로드 URL·DB 비밀번호·회원 원문을 보고서에 기록하지 않는다.
- 새 로컬 MySQL 8.4 인스턴스로 복원해 **15개 테이블의 CHECK TABLE, 행 수 조회, Flyway V20까지 성공 상태**를 확인했다. 실제 운영 DB와 같은 시점의 전체 행 해시 대조는 이번 검증 범위에 포함하지 않았다.
- 검증 서버는 종료했고, 임시 MySQL 데이터 디렉터리는 삭제했다. 평문 SQL 파일은 만들지 않는다. 검증 중에는 복원된 MySQL 데이터 파일이 생겼다가 정리된다.
- **매일 자동 백업은 무료 계정 제한으로 미설정이다.** 사용자 승인 후 Default 프로젝트의 기존 역할에 `Project > Addons > General > Update`만 잠깐 추가했으나, API가 HTTP 400 `Backup schedule interval daily is not permitted on free accounts.`로 거절했다. 즉시 권한을 회수하고 새로고침 후 전체 권한 버튼 상태가 변경 전과 같음을 확인했다. 08:50 KST API 재조회에서도 일정은 없고 기존 수동 백업은 완료 상태다.
- 준비한 일정: **매일 한국 시간 04:00(UTC 19:00), dump/gz, 7일 보관, Northflank 기본 저장소**. 유료 전환·추가 서버·외부 저장소·상시 토큰은 만들지 않았다.

## 이 구성을 선택한 이유

DB가 실행되는 플랫폼의 예약 기능을 쓰면 PC가 꺼져 있어도 백업할 수 있고, 백업을 위해 앱에 DB 관리 코드를 추가할 필요가 없다. Native dump는 다운로드해 다른 MySQL로 복원할 수 있다. 디스크 snapshot은 다운로드할 수 없으므로 이번 기본 형식은 dump다. [공식 백업 설명](https://northflank.com/docs/v1/application/databases-and-persistence/backup-restore-and-import-data)

2026-10-15 공식 요금표의 Developer 열에서 **Backups & restores: Included**, **Pricing: Free**를 확인했고 현재 addon도 Free 상태였다. 수동 native 백업은 유료 전환 없이 성공했다. **이 표시는 매일 예약 기능까지 무료라는 의미가 아니다. 실제 계정 API는 daily 일정을 거절했다.** 외부 반출·별도 저장소·미래 요금 변경까지 무료라고 보장하는 근거도 아니다. [요금표](https://northflank.com/pricing)

7일 보관은 하루 1회 백업의 초기 정책이다. 수동 백업은 일별 일정의 보관 정책으로 자동 정리된다고 가정하지 않는다. 수동 백업 삭제는 현재 작업에 포함하지 않았다.

## 운영 화면 흐름과 확인 기준

1. Northflank → Default → Addons → jochook-on-mysql → **Backup schedules**.
2. Dump / gz / Daily / Hour 19 / Minute 00 / Days 7 / custom destination 미선택으로 저장한다.
3. 새로고침과 API 재조회에서 일정 하나가 유지되는지 확인한다. 화면에 값이 보이는 것만으로 저장 성공을 선언하지 않는다.
4. 다음 예약 시간이 지난 뒤 **Backups**에서 Schedule이 있는 완료 백업을 확인한다. 지금 생성한 수동 백업은 예약 실행 성공의 증거가 아니다.
5. 최신 성공이 26시간을 넘거나 실패·장시간 실행 중이면 원인을 확인하고, 중복 백업 요청을 반복하지 않는다.

이번에는 사용자 승인에 따라 Default 프로젝트 범위의 Addons > General > Update 한 개만 추가했다가 무료 계정 오류 확인 직후 제거했다. 변경 전후 전체 권한 상태가 동일함을 확인했고, 토큰·프로젝트 범위·DB 공개 설정은 변경하지 않았다. 설정을 다시 시도하려면 먼저 무료 계정에서 허용되는 예약 주기나 다른 실행 방식의 비용·권한·키 보관을 확인해야 한다. 임의로 주기를 바꾸거나 유료 전환하지 않는다.

## 읽기 전용 상태 점검

이 PC에 설치된 공식 Northflank JS SDK와 `jochook-on-deploy` CLI context를 사용한다. 임시 인증이 만료되면 재인증이 필요하며, 만료를 백업 실패로 오인하지 않는다. 스크립트는 재설정·백업 생성·삭제를 하지 않는다.

```powershell
. ./scripts/Use-DevTools.ps1
node scripts/Check-NorthflankBackups.mjs
node --test --test-isolation=none scripts/tests/backup-status.test.mjs
```

- 기본 SDK 경로: `work/tools/northflank/node_modules/@northflank/js-client`. 다른 설치 위치는 `--sdk-dir`로 지정한다.
- 종료 코드 0: 기대한 일정 + 26시간 이내 완료 덤프 + 최신 실패/30분 초과 실행 없음.
- 종료 코드 1: 상태 확인은 됐지만 위 조건을 충족하지 못함. 현재는 수동 백업 성공·일정 미설정을 정확히 구분해 1을 반환한다.
- 종료 코드 2: 인증·권한·SDK 경로·연결 때문에 확인하지 못함.
- `scheduledExecutionVerified:false`는 예약 실행 성공 여부를 이 점검만으로 증명하지 않았다는 뜻이다. 실제 자동 실행 여부는 콘솔 Schedule 열에서 별도로 확인한다.
- 결과 파일은 `work/northflank-backup-status.json`이다. 내용은 시각·성공 여부 등 운영 메타데이터이며 선수 자료나 토큰이 없다.

## 격리 복원 시험

PowerShell 7, Windows DPAPI, 이 PC에 준비된 MySQL 8.4가 필요하다. Docker를 사용하지 않는다.

```powershell
./scripts/Test-EncryptedMysqlBackup.ps1 `
  -BackupDirectory 'backups/northflank/20261015-native-recovery-check'
```

이 명령은 SHA-256 검증 → 메모리 해독·압축 해제 → 고유한 `work/mysql-restore-check-<GUID>` 디렉터리 생성 → localhost 전용 MySQL 초기화 → 실제 datadir 확인 → 복원 → 테이블 무결성·마이그레이션 확인 → 서버 종료·해당 임시 디렉터리 삭제 순서로 실행한다. 외부 host/port를 입력받지 않으며 실제 로컬 DB의 디렉터리를 재사용하지 않는다.

결과는 백업 폴더의 `restore-check.json`에 남긴다. `restoreVerified:true`와 `temporaryDataRemoved:true`를 함께 확인한다. `manifest.json`의 생성 시점 `restoreVerified:false`보다 별도 복원 결과 파일이 최신 검증 결과다. 손상된 파일/지문은 서버 초기화 전에 거절한다. SQL 오류 원문은 개인 정보가 포함될 수 있어 출력하지 않는다.

## 실제 사고 때의 복구

1. 운영진 입력을 잠시 중단하고 장애 시점·최신 정상 백업·원인을 확인한다. 접근 가능한 현재 DB도 별도 보관한다.
2. 백업을 새 격리 환경에 복원해 테이블, 로그인/팀 격리, 선수·경기 대조를 확인한다.
3. 사용자와 복구 시점 및 이후 손실될 입력을 확인하고 운영 전환을 진행한다. **운영 addon의 Restore는 기존 데이터를 제거할 수 있으므로 시험용으로 누르지 않는다.**
4. 운영 연결·권한·화면을 확인한 뒤 입력을 재개한다. 변경 이력과 새 백업을 남긴다.

## 남은 작업

- 무료 계정의 허용 주기 또는 대체 자동화 방식 확인. 매일 04:00·7일 보관 설정은 계정 제한으로 거절됐으며 대체 주기와 유료 전환은 미승인·미실행이다. 실제 자동 실행 검증도 남아 있다.
- 실패 알림의 무료 제공 범위와 상시 읽기 전용 인증 방식. 현재 Codex가 계속 감시한다고 간주하지 않는다.
- Northflank 계정 장애까지 대비하는 별도 제공자/매체의 암호화 사본과 복구 키 관리. DPAPI 사본은 현재 Windows 사용자에 종속되므로 PC 분실 대비책이 아니다.
- 정기 복원 시험과 실제 복구 시간 측정. 하루 이내 손실(RPO 24시간), 2시간 내 복구(RTO 2시간)는 목표 초안이며 달성 보장은 아니다.
- 운영 앱에는 이번 작업으로 코드 배포·DB 마이그레이션을 하지 않았다. 다음 앱 개발 우선순위는 계정/팀 범위 초안 복원과 신규 경기 중복 저장 방지다.
