# 현재 DB 구조

실제 로컬 DB의 적용·검증 기준은 **V19**입니다. 경기 변경 이력 테이블을 추가했고 기존 13개 업무 테이블의 값과 관계를 그대로 보존했습니다. 전체 선수 40명(활동 39명), 경기 2건이며 실제 팀은 하나입니다. 회원 조회 코드는 발급된 상태이고 원문은 문서에 보관하지 않습니다. 새 변경 이력은 기능 적용 이후부터 기록하며 기존 경기의 과거 이력은 만들지 않았습니다. 값 보존 대조와 적용 이력은 [검증 기록](verification.md)을 따릅니다. 이미 적용된 마이그레이션은 수정하지 않습니다.

## 경기 변경 이력: V19

`match_record_events`는 등록·수정·삭제의 작업자 계정 ID/당시 아이디, UTC 시각, 팀/경기 식별자, 전후 버전과 전체 경기 JSON 스냅샷을 저장합니다. 경기 저장과 같은 트랜잭션으로 기록하고 삭제된 경기의 이력도 유지합니다. 앱에서 이력은 감독·코치가 조회만 할 수 있습니다. [컬럼·API·운영 정책](player-filters-and-match-history.md)

## 팀과 계정·선수·경기의 연결

```text
accounts ──< team_memberships >── teams
                                  ├──< players (정회원·용병)
                                  ├──< match_records ──< 참가·계획·실제 기록
                                  ├──  team_codes (팀당 한 행)
                                  ├──< team_code_events (코드 변경 이력)
                                  └──< team_invites
accounts ──< team_creation_requests >── teams / team_invites
```

계정과 선수는 별개입니다. 한 계정이 여러 팀의 운영진일 수 있지만 선수 프로필과 경기의 `team_id`는 한 클럽을 가리키며 수정 API로 이동시키지 않습니다. 하위 경기 기록은 경기 ID를 통해 클럽에 속하고 서비스가 연결 선수의 클럽 일치까지 검사합니다. 기존 자체전의 `team=A/B`는 클럽 안의 편 구분이며 클럽 `team_id`와 다릅니다.

## 팀 접속 테이블: V14~V18

| 테이블 | 주요 컬럼 | 식별·제약과 용도 |
| --- | --- | --- |
| teams | id BIGINT, name/description VARCHAR(40), status VARCHAR(16), version BIGINT, created_at TIMESTAMP(6) | id PK, PENDING/ACTIVE/INACTIVE CHECK. 같은 팀명 허용, 첫 운영진 활성화 전 PENDING |
| team_memberships | id/team_id/account_id BIGINT, role VARCHAR(10), active BIT(1), created_at TIMESTAMP(6) | id PK, (team_id, account_id) UNIQUE, 팀·계정 FK. V18부터 DIRECTOR/COACH/MEMBER CHECK. 현재 팀 권한의 근거 |
| team_invites | id/team_id/created_by BIGINT, display_name VARCHAR(60), token_hash CHAR(64), role VARCHAR(10), version BIGINT, expires_at/used_at/cancelled_at/created_at TIMESTAMP(6) | 토큰 해시 UNIQUE, 팀·발급 계정 FK. V18부터 대상 역할 DIRECTOR/COACH CHECK. 원문은 43자 무작위 토큰이며 DB 저장 안 함. 발급 후 24시간·1회 사용 |
| team_codes | team_id BIGINT, code_hash CHAR(64) NULL, version BIGINT, issued_at/expires_at/revoked_at TIMESTAMP(6) NULL, issued_by BIGINT NULL. V17 추가: password_hash VARCHAR(100) NULL | team_id PK·FK, 코드 해시 UNIQUE. 팀당 한 행, 코드 12자·90일. V17부터 독립적인 숫자 6자리 비밀번호의 BCrypt 해시를 함께 보관. 재발급/폐기 시 version 증가 |
| team_creation_requests | account_id BIGINT, request_id CHAR(36), request_hash CHAR(64), team_id/invite_id BIGINT NULL, created_at TIMESTAMP(6) | (account_id, request_id) PK, 계정·팀·초대 FK. 동일 내용 재시도는 기존 결과, 다른 내용은 충돌 |
| team_code_events (V16) | id/team_id/actor_account_id BIGINT, action VARCHAR(10), version BIGINT, occurred_at TIMESTAMP(6), expires_at TIMESTAMP(6) NULL | id PK, (team_id, version) UNIQUE, 팀·담당 계정 FK, ISSUED/ROTATED/REVOKED CHECK, version > 0, (team_id, occurred_at, id) 인덱스 |

초대·코드는 SHA-256 해시만 보관하고 원문은 성공 응답에서 한 번 표시합니다. V17의 팀 비밀번호는 BCrypt 해시만 저장하며 두 원문은 발급 때만 함께 반환합니다. 소속 상태나 초대 상태를 선수의 직책·활동 여부와 연결하지 않습니다. 초대 상태는 사용·취소·만료 시각으로, 코드 상태는 해시·폐기·만료 시각으로 판단하며 비밀번호 해시가 없는 구 코드는 접속을 허용하지 않습니다. 원문 재조회는 없으며 V16의 `team_code_events`가 발급·재발급·폐기 시각과 담당 계정을 별도 이력으로 보관합니다. 코드·비밀번호 원문과 해시는 이력에 복제하지 않습니다.

코드 변경과 이력 추가는 같은 트랜잭션으로 성공·취소되며 이력을 수정·삭제하는 API는 없습니다. `GET /api/v1/team/code/history?limit=20`은 현재 팀 운영진에게 최근 20건을 최신순으로 반환합니다(요청 범위 1~100). V16 적용 전 과거 작업은 시간·담당자를 추측해 채우지 않고 적용 이후 실제 변경부터 기록합니다. V16에서는 기존 코드 상태를 유지했으며 V17에서는 아래와 같이 구 코드 접속을 종료합니다.

### V17 팀 코드 비밀번호 변경

- 파일: `V17__add_team_code_password.sql`. `team_codes.password_hash VARCHAR(100) NULL`을 추가합니다. NULL은 미발급·폐기·이전 코드 상태를 표현하며 비밀번호 없이 접속해도 된다는 뜻이 아닙니다.
- 기존 `code_hash`가 남은 행은 `code_hash=NULL`, `revoked_at=COALESCE(revoked_at, CURRENT_TIMESTAMP(6))`, `version=version+1`로 폐기합니다. 이미 미발급·폐기된 행은 버전을 유지합니다. 운영진이 재발급해야 새 코드·비밀번호 조합을 사용할 수 있습니다.
- 서버는 비밀번호 해시가 NULL 또는 빈 값이면 신규 접속과 기존 조회 세션을 모두 거부합니다. 세션은 매 요청 현재 코드 버전·기간·팀 상태와 함께 이 조건을 확인합니다.
- 새 발급·재발급은 코드와 비밀번호 해시, version, 공통 90일 만료일과 이력을 같은 트랜잭션으로 갱신합니다. 폐기는 두 해시를 제거합니다. 기존 개인 계정의 `accounts.password_hash`와 선수·경기·소속 ID는 변경하지 않습니다.
- V17 적용·이전·테스트 결과는 [검증 기록](verification.md)을 따릅니다. 원문이나 실제 코드 조합은 문서·마이그레이션에 쓰지 않습니다. [기능 명세와 인수 기준](team-code-password.md)

### V18 감독·코치 권한 분리

- `V18__add_director_and_coach_roles.sql`은 기존 소속 `ADMIN`을 `COACH`로 바꾸고 역할 제약을 `DIRECTOR/COACH/MEMBER`로 변경합니다. 기존 운영진의 기록 수정 권한을 유지하면서 감독 임명 권한을 일괄 부여하지 않습니다.
- 기존 초대에는 `role=COACH`를 채웁니다. 이후 서비스 관리자가 처음 팀을 만들 때는 `DIRECTOR`를 지정하며 감독 화면의 초대는 서버에서 `COACH`로 고정합니다. 활성 감독이 코치 초대를 수락해도 감독 권한을 낮추지 않습니다.
- 감독의 코치 해제는 해당 `team_memberships.role`을 `MEMBER`로 바꿉니다. 계정과 조회 소속, 기존 선수·경기 기록을 삭제하지 않습니다. 이후 요청은 DB의 새 역할로 판정합니다.
- `accounts.role`은 기존 로그인 호환 컬럼으로 유지하고 선수·경기 수정 권한에는 사용하지 않습니다. 선수의 `club_role`도 권한 근거가 아닙니다. 선수 명단의 감독·코치 표시는 개인 계정 권한을 자동으로 부여하지 않습니다.
- 첫 로컬 감독은 사용자 위임에 따라 기존 초기 계정에 별도로 지정합니다. 실명·계정명·선수 등록 등 일회성 운영 데이터는 Flyway에 넣지 않습니다. [정책과 화면 흐름](team-staff-permissions.md)

기존 HANA FC는 V14에서 `teams.id=1`로 연결하고 기존 계정의 ADMIN/MEMBER를 그 팀 소속으로 옮깁니다. 모든 계정의 `service_admin` 초기값은 false이며 운영 초기 설정에서 지정한 계정만 서비스 관리자가 됩니다. V15는 기존 선수·경기 ID·계정 해시·하위 기록을 유지하면서 `team_id=1`을 채운 뒤 NOT NULL/FK를 적용합니다. `team_id`에 신규 행용 기본값을 두지 않아 새 저장은 반드시 승인된 팀을 명시해야 합니다.

## players: 선수 기본 정보

| 컬럼 | MySQL 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| id | BIGINT | 예 | 자동 증가 기본 키. 선수 식별자 |
| team_id | BIGINT | 예 | 소속 클럽 teams.id FK. 기본값 없음, 생성 시 서버에서 지정 |
| name | VARCHAR(60) | 예 | 선수 이름 |
| player_type | VARCHAR(6) | 예 | MEMBER / GUEST. 기본 MEMBER, 기존 선수 유지. 로그인 권한과 별개 |
| shirt_number | INT | 아니요 | 등번호 1~99. 모르면 NULL |
| position | VARCHAR(2) | 예 | GK / DF / MF / FW / UN(미확인) |
| birth_year | INT | 아니요 | 생년. API 1900~현재 한국 연도, DB 1900~9999 CHECK. 모르면 NULL |
| club_role | VARCHAR(30) | 예 | 정회원/코치/감독/총무/회장 CHECK, 기본 정회원. 로그인 권한과 별개 |
| active_shirt_number | INT (생성 컬럼) | 자동 | active=1이면 shirt_number, 아니면 NULL. team_id와 묶은 UNIQUE로 같은 팀 활동 번호 중복 방지 |
| joined_on | DATE | 아니요 | 가입일. 모르면 NULL |
| active | BIT(1) | 예 | 활동 여부. 기본값 1 |
| version | BIGINT | 예 | 수정 충돌 감지용 버전. 기본값 0. PUT 요청의 version을 비교하고 JPA가 변경 시 증가시킴 |
| first_choice | VARCHAR(3) | 기존 행·UN은 NULL 허용 | 선호 1지망. UN 이외 신규 등록·수정에서는 필수 |
| second_choice | VARCHAR(3) | 아니요 | 선호 2지망 |
| third_choice | VARCHAR(3) | 아니요 | 선호 3지망. 2지망 없이 등록 불가 |

- `id`가 기본 키입니다. 등번호는 변경·미등록·활동 종료 후 재사용이 가능하므로 선수 식별자로 쓰지 않습니다. 동명이인은 허용합니다. V15의 `uq_players_team_active_shirt(team_id, active_shirt_number)`는 같은 클럽 활동 선수의 번호만 중복을 금지하며 다른 팀의 같은 번호와 여러 NULL은 허용합니다. 활동 종료·복귀 UI는 후속 단계이지만 DB는 복귀 시 같은 팀 번호 충돌도 거부합니다.
- CHECK 제약으로 등번호 범위와 포지션 값을 검사합니다.
- V11의 `player_type`으로 외부 용병을 구분합니다. 용병도 고유 선수 ID와 기존 경기 FK를 사용하므로 다음 경기에도 같은 선수로 연결됩니다. 등번호·생년은 NULL 가능하고 이름은 필수입니다. 일반 선수단 목록은 MEMBER만 조회하며 용병은 별도 목록에서 선택합니다. `(player_type, active, id)` 인덱스를 추가합니다. 현재 club_role은 용병도 내부 기본값 정회원이지만 회원 여부는 오직 player_type으로 구분하며 용병 입력/화면에 직책을 사용하지 않습니다.
- `(active, id)` 복합 인덱스는 활동 중인 선수를 ID 순서로 조회하는 패턴을 위한 것입니다.
- V15는 `(team_id, active, player_type)` 인덱스를 추가해 클럽별 정회원·용병 목록의 조회 범위를 좁힙니다.
- 엔진은 InnoDB, 문자셋은 utf8mb4, 정렬 규칙은 utf8mb4_0900_ai_ci입니다.
- 경기 참가·출전 테이블이 선수 ID를 외래 키로 참조합니다. 기록이 연결된 선수의 물리 삭제는 DB에서 막습니다.
- 선호 포지션은 LB/CB/RB/CDM/CM/LW/ST/RW/GK만 허용합니다. 세 지망의 중복과 순서 건너뛰기는 API·Entity·DB CHECK에서 검사합니다. 기본 포지션 GK/DF/MF/FW와는 별개입니다.
- `V3__add_player_preferences.sql`은 기존 선수 정보를 보존하며 선호 컬럼만 NULL로 추가합니다. 편성용 가중치는 선수 데이터에 저장하지 않고 이후 정책으로 관리합니다.
- V6의 UN은 정보 미확인 상태입니다. 선호 세 칸을 모두 NULL로 유지하도록 DB와 API가 검사하며 활동 여부와는 무관합니다. V6에서 NULL로 추가한 직책은 V7에서 정회원으로 정리합니다. 기존 '골키퍼' 직책도 정회원으로 정리하되 포지션은 유지하고 변경 행의 version을 증가시킵니다.
- V8 적용 시 기존 활동 선수에 중복 번호가 있으면 마이그레이션이 실패합니다. 임의로 번호를 바꾸지 않고 원본을 확인하여 정리해야 합니다. 생성 컬럼은 DB 내부 제약 용도이며 API·JPA의 수정 필드가 아닙니다.
- 나이·연령대는 별도 저장하지 않습니다. 생일과 무관하게 기준 연도에서 생년을 뺍니다. 선수단은 현재 한국 연도, 경기 명단·스쿼드는 경기 연도를 사용합니다. 선수 프로필 정정 시 과거 경기 화면의 나이도 정정된 생년으로 다시 계산하며 별도 스냅샷은 아직 없습니다.

## flyway_schema_history: 변경 이력

Flyway가 실행한 SQL의 버전·파일·체크섬·적용 시각·성공 여부 등을 관리합니다. V1 선수 → V2 계정 → V3 선호 포지션 → V4 경기 기록 → V5 교체·쿼터 길이 제거 → V6 생년·직책·미확인 포지션 → V7 직책 제한 → V8 활동 선수 번호 UNIQUE → V9 번호 1~99 → V10 계획 스쿼드 → V11 회원·용병 구분 → V12 경기 스코어 → V13 자체전 → V14 팀 접속 → V15 선수·경기 팀 연결 → V16 코드 변경 이력 → V17 팀 코드 비밀번호 → V18 감독·코치 권한 분리 순서입니다. 실제 명단과 일회성 가입일 변경은 마이그레이션에 넣지 않습니다.

## accounts: 로그인 계정

| 컬럼 | MySQL 타입 | 설명 |
| --- | --- | --- |
| id | BIGINT | 자동 증가 기본 키 |
| username | VARCHAR(40) | 중복 불가 로그인 아이디 |
| password_hash | VARCHAR(100) | BCrypt로 해시한 비밀번호. 평문 비밀번호를 저장하지 않음 |
| role | VARCHAR(10) | ADMIN / MEMBER, CHECK 제약. 기존 호환 필드이며 현재 팀 권한은 team_memberships로 판정 |
| enabled | BIT(1) | 계정 사용 가능 여부, 기본값 1 |
| service_admin | BIT(1) | 서비스 팀 생성·운영진 지정 권한. 기본 false, 명시적 초기 설정으로만 부여 |

선수와 로그인 계정은 별개이며 아직 둘 사이의 외래 키는 없습니다. 초기 관리자 생성 설정이 있고 계정 테이블이 비어 있을 때만 ADMIN 한 명을 생성합니다. 재시작 시 기존 계정이나 비밀번호를 덮어쓰지 않습니다.

## 경기 기록: V15 기준

`match_planned_lineups`는 V13부터 `(match_id, quarter_number, team, slot, entry_order)` 기본 키, `player_id` 외래 키, `(match_id, quarter_number, player_id)` UNIQUE를 사용합니다. 팀 A/B, 쿼터 1~4, 출전 구분 0/1, 11개 자리 CHECK가 있고 득점·도움 컬럼은 없습니다. API는 참석 예정자만 배치하고 같은 팀·자리에 선발 없는 교체를 거부합니다. 경기 전 계획은 아래 실제 출전 테이블과 분리하며 실제 통계에 포함하지 않습니다.

| 테이블 | 주요 컬럼 | 식별·제약 |
| --- | --- | --- |
| match_records | id/team_id BIGINT, match_kind VARCHAR(16), played_on DATE, kickoff TIME NULL, venue/opponent VARCHAR(100), notes VARCHAR(3000), score_for/score_against INT NULL, version BIGINT | id PK, team_id NOT NULL·팀 FK·기본값 없음, (team_id, played_on, id) 인덱스, EXTERNAL/INTERNAL CHECK, 수정 충돌 감지, 양쪽 스코어 NULL 또는 양쪽 0~99 CHECK |
| match_participants | match_id, player_id BIGINT, vote/attendance VARCHAR(16) | (경기, 선수) PK, 경기·선수 FK |
| match_quarters | match_id BIGINT, quarter_number INT | (경기, 쿼터 번호) PK, 경기 FK, 번호 1~4 CHECK |
| match_appearances | match_id/player_id BIGINT, quarter_number INT, team VARCHAR(1), slot VARCHAR(3), entry_order/goals/assists INT | (경기, 쿼터, 팀, 자리, 출전 구분) PK, (경기, 쿼터, 선수) UNIQUE, 경기·선수 FK, A/B·번호·자리·출전 구분·0~99 기록 CHECK |

- `vote`: ATTENDING 참석 예정 / ABSENT 불참 예정 / UNDECIDED 미정 / UNANSWERED 미투표.
- `attendance`: PRESENT 참석 / LATE 지각 / ABSENT 불참 / UNCONFIRMED 미확인. 투표와 자동 동기화하지 않습니다.
- `slot`: GK, LB, LCB, RCB, RB, CDM, LCM, RCM, LW, ST, RW. LCB/RCB와 LCM/RCM은 각각 CB·CM의 두 배치 자리이며 선수 선호 포지션은 기존 CB/CM을 유지합니다.
- `entry_order`: 0은 선발, 1은 교체. 같은 쿼터·자리에 선발 1명과 교체 1명까지 기록합니다. 교체만 있는 기록, 재투입, 같은 쿼터의 포지션 이동은 거부합니다.
- 한 경기의 참가자 최대 200명, 쿼터는 1~4를 정확히 한 번씩 저장하며 각 팀·쿼터의 배치는 0~22명(자체전 양 팀 합계 최대 44명)입니다. 실제 참석·지각한 참가자만 출전할 수 있고 도움 합계는 해당 쿼터·팀의 득점 합계를 넘지 못합니다. 이 교차 테이블 규칙은 서비스/도메인에서 검증합니다.
- 선발만 있는 자리는 1쿼터, 선발·교체가 함께 있는 자리는 각각 0.5쿼터로 계산합니다. 출전량은 원본에서 계산해 응답하며 별도 컬럼에 중복 저장하지 않습니다.
- V5는 기존 출전 기록에 `entry_order=0`을 부여하여 선수·득점·도움을 보존합니다. `duration_minutes`는 제거되므로 적용 전 DB 백업이 필요합니다.
- 경기 날짜·시작 시간은 신규/수정 API에서 필수이며 시간의 분은 00/30, 초·소수초는 0이어야 합니다. 기존 데이터에 시간을 임의로 부여하지 않도록 DB의 kickoff NULL 허용은 유지합니다. 과거 미입력·비정규 시간은 조회할 수 있고 수정 시 새 규칙을 적용합니다. 장소·상대·코멘트 미입력은 빈 문자열입니다. 화면의 종료 시간은 시작 + 2시간으로 계산하며 실제 출전 분·쿼터 길이로 저장하지 않습니다.
- V12의 스코어는 기존 경기에서 모두 NULL로 시작합니다. 양쪽 NULL은 미입력, 0/0은 무득점으로 구분합니다. 선수 득점 합계와 독립적으로 저장해 미기록 득점자·상대 자책골을 허용합니다. 목록의 득점자는 실제 출전 기록을 선수 ID별로 합산하고 현재 등번호 오름차순(NULL 마지막)·ID순으로 최대 3명 표시합니다. 계획 기록은 합산하지 않습니다.
- 하위 기록은 `@ElementCollection`으로 경기와 함께 트랜잭션 저장합니다. 쿼터 배치만 변경해도 경기의 `@Version`이 증가합니다. 선수 이름·등번호는 현재 선수 정보로 조회하므로 과거 이름의 별도 스냅샷은 없습니다.

V13은 기존 경기를 `EXTERNAL`, 기존 계획·출전을 `A`로 보존합니다. `INTERNAL`이면 하루 4쿼터 전체 자체전이며 스코어의 `score_for`/`score_against`는 A팀/B팀 합계입니다. 외부 경기는 A(우리 팀)만 배치할 수 있습니다. 최초 저장 후 경기 유형 변경은 API에서 막으며, 출석은 팀과 무관하게 `(match_id, player_id)` 한 행입니다. 선수의 팀은 쿼터별 배치에 있으므로 쿼터 간 팀 변경이 가능하고 출전량 계산은 같은 팀·자리끼리만 교체로 봅니다.

별도 모임 테이블, 기록 확정과 몸값 이력은 후속 단계입니다. 프로 비교의 4쿼터=1경기는 미확정 후보입니다. V19까지 적용했으며 이후 DB 변경은 V20 이후 새 마이그레이션으로 추가합니다.
