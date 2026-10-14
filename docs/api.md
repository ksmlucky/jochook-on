# 현재 API

## 세션 로그인

로그인은 브라우저의 HttpOnly `JSESSIONID` 쿠키를 사용합니다. 프론트와 API는 같은 출처의 `/api` 프록시로 통신하고, 토큰이나 비밀번호를 localStorage에 저장하지 않습니다.

| 요청 | 인증 | 결과 |
| --- | --- | --- |
| `GET /api/v1/auth/csrf` | 불필요 | `{headerName, token}` 반환, CSRF 토큰을 세션에 저장 |
| `POST /api/v1/auth/login` | 불필요, CSRF 필요 | 성공 204, 아이디·비밀번호 불일치 401 |
| `GET /api/v1/auth/me` | 필요 | `{username, role}` 반환, 미로그인 401 |
| `POST /api/v1/auth/logout` | CSRF 필요 | 세션 무효화·쿠키 삭제 후 204 |

로그인 본문은 `application/x-www-form-urlencoded`의 `username`, `password`입니다. CSRF 응답의 `headerName`을 헤더 이름으로, `token`을 값으로 전달합니다. 로그인과 로그아웃 후 CSRF 토큰이 바뀌므로 각 변경 요청 전에 다시 조회합니다. 누락되거나 유효하지 않은 CSRF 토큰은 403입니다.

로그인 성공 시 세션 ID를 바꾸며, 세션은 30분간 요청이 없으면 만료됩니다. 역할은 ADMIN(운영진), MEMBER(회원)입니다. `/api/v1/admin/**`는 ADMIN만 접근할 수 있도록 보호하지만, 관리 기능 API 자체는 아직 없습니다. 계정 생성·비밀번호 변경 API도 아직 제공하지 않습니다.

## 활동 중인 선수 목록

일반 목록은 `playerType=MEMBER`만 반환합니다. 선수 상세 및 경기 참가자 응답에는 `playerType` (`MEMBER`/`GUEST`)이 포함됩니다. 회원 여부와 로그인 계정 역할은 별개입니다.

`GET /api/v1/players?page=0&size=20`

| 매개변수 | 기본값 | 허용 범위 |
| --- | --- | --- |
| page | 0 | 0 이상의 정수, 0부터 시작 |
| size | 20 | 1~100 |
| sort | id | id / shirtNumber / age / name / preferredPosition |
| direction | asc | asc / desc |

활동 중인 선수 전체를 먼저 정렬한 뒤 페이지를 나눕니다. API의 기존 기본값은 ID 오름차순이며 선수단 UI는 `size=20&sort=shirtNumber&direction=asc`를 기본으로 요청합니다. UI에서 10/20/30명 및 양방향 정렬을 선택할 수 있습니다. 나이 오름차순은 생년 내림차순(어린 순)입니다. 생년·등번호 NULL은 양방향 모두 마지막, 동률은 ID 오름차순입니다. `preferredPosition`은 **firstChoice만** 사용하며 asc는 GK → LB/CB/RB → CDM/CM → LW/ST/RW, desc는 그룹 순서를 반대로 적용합니다. firstChoice NULL은 항상 마지막이며, 각 그룹 내에서는 등번호 오름차순(NULL 마지막) → ID 오름차순으로 정렬합니다. 기본 position이나 2·3지망은 정렬에 사용하지 않습니다. 잘못된 정렬 키/방향, 범위를 벗어나거나 정수가 아닌 페이지 입력은 400입니다. 마지막 페이지 이후의 items는 빈 배열이며 totalElements는 전체 활동 선수 수를 유지합니다.

최초 빈 DB 응답:

```json
{
  "items": [],
  "page": 0,
  "size": 20,
  "totalElements": 0,
  "totalPages": 0
}
```

선수 응답 항목의 형식 (설명용 예시이며 실제 DB에 넣지 않음):

```json
{
  "id": 1,
  "name": "예시 선수",
  "shirtNumber": null,
  "position": "MF",
  "joinedOn": null,
  "version": 0,
  "firstChoice": "CM",
  "secondChoice": "CDM",
  "thirdChoice": null,
  "birthYear": 1996,
  "clubRole": "코치"
}
```

position은 GK·DF·MF·FW 또는 UN(미확인)입니다. 등번호 null은 미등록이며 0번은 허용하지 않습니다. 이름은 선수의 고유 식별자로 사용하지 않으며 동명이인을 허용합니다.

ADMIN 또는 MEMBER로 로그인해야 조회할 수 있습니다. 미로그인은 401이며, 그 외 미구현 API는 기본적으로 차단됩니다.

## 선수 상세·등록·수정

| 요청 | 권한 | 성공 |
| --- | --- | --- |
| `GET /api/v1/players/{id}` | ADMIN / MEMBER | 200, 선수 응답 |
| `POST /api/v1/players` | ADMIN + CSRF | 201, 선수 응답과 Location 헤더 |
| `PUT /api/v1/players/{id}` | ADMIN + CSRF | 200, 저장 후 선수 응답 |

등록 본문 (`application/json`, 설명용 예시):

```json
{"name":"예시 선수","position":"MF","shirtNumber":null,"joinedOn":null,"firstChoice":"CM","secondChoice":null,"thirdChoice":null}
```

수정 본문은 같은 아홉 필드와 마지막으로 조회한 `version`을 전달합니다. 전체 기본 정보를 교체하며 등번호·가입일·생년·2·3지망을 null로 보내면 기존 값을 비웁니다. 직책의 null/빈칸은 정회원입니다. version은 읽은 값을 그대로 보내고 클라이언트에서 증가시키지 않습니다. 실제 값이 바뀌면 JPA가 버전을 증가시킵니다.

- 이름은 앞뒤 공백 제거 후 1~60자, 기본 포지션은 GK/DF/MF/FW 또는 미확인 UN을 선택합니다.
- 등번호는 정수 1~99 또는 null, 가입일은 `YYYY-MM-DD` 또는 null입니다. 날짜는 MySQL DATE 범위인 1000~9999년을 허용합니다. 모르는 가입일을 오늘 날짜로 자동 입력하지 않습니다.
- 동명이인은 허용합니다. 활동 선수의 등번호 중복은 금지하며, 미등록 null은 여러 명 허용합니다. 본인의 현재 번호는 그대로 수정할 수 있고 활동 종료 선수의 번호는 재사용 가능합니다. 단건 중복은 HTTP 400, `code=DUPLICATE_SHIRT_NUMBER`, `fieldErrors.shirtNumber`로 안내합니다. DB UNIQUE 충돌도 같은 응답으로 처리합니다. 활동 종료·삭제 API는 아직 없습니다.
- 선호 포지션 firstChoice/secondChoice/thirdChoice는 LB/CB/RB/CDM/CM/LW/ST/RW/GK만 허용합니다. firstChoice 필수, 나머지는 선택이며 중복이나 순서 건너뛰기는 400입니다. 포지션이 UN이면 세 지망을 모두 null로 보내야 합니다. 그 외 기존 선수의 firstChoice가 null이면 수정 시 채워야 합니다.

주요 실패 응답: 입력 오류 400, 미로그인 401, 회원의 변경 요청 또는 CSRF 누락 403, 없는 선수·비활동 선수 404, 오래된 version 또는 동시 저장 충돌 409. 인증·CSRF 검사는 본문 검사보다 먼저 실행됩니다.

선수 본문 입력 검증·선수 없음·충돌 오류는 `{code, message, fieldErrors}` 형식입니다. `fieldErrors`는 이름·포지션·등번호·version 등의 필드별 오류이며, 본문 형식 오류나 충돌일 때는 빈 객체입니다. 인증·권한 오류나 URL 매개변수 형식 오류의 본문은 이 형식을 보장하지 않습니다.

```json
{"code":"PLAYER_CONFLICT","message":"다른 운영진이 먼저 수정했습니다. 최신 정보를 확인한 뒤 다시 수정해 주세요.","fieldErrors":{}}
```

화면은 충돌 시 입력 중인 값을 유지합니다. 사용자가 **최신 정보로 다시 불러오기**를 눌러 서버 값으로 교체한 뒤 다시 수정하도록 합니다.

## 외부 용병

ADMIN 전용 `GET /api/v1/players/guests?page=0&size=100`은 활동 용병을 이름순으로 페이지 조회합니다. page는 0 이상, size는 1~100이며 응답 구조는 선수 목록과 같습니다.

`POST /api/v1/players/guests`는 CSRF가 필요하며 `{name, shirtNumber, birthYear, firstChoice, secondChoice, thirdChoice}`를 받습니다. 이름만 필수이고 등번호는 1~99 또는 NULL, 생년은 1900~현재 연도 또는 NULL입니다. 선호는 중복 없이 순서대로 선택하며 모두 NULL이면 미확인(UN)으로 저장합니다. 201 선수 응답과 Location을 반환하며 type은 서버가 GUEST로 설정합니다. 기존 활동 선수와 등번호가 겹치면 409입니다. 가입일은 NULL, 기존 선수 등록/일괄 등록은 MEMBER입니다.

용병 프로필 등록은 경기 저장과 별개입니다. 경기에는 기존 participants/plannedLineup/quarters의 playerId로 연결하며 경기 저장 트랜잭션·version 검사도 동일하게 적용합니다. 경기 엑셀 미리보기 행에도 playerType을 포함합니다. 03의 계획대로 저장 버튼은 기존 경기 POST/PUT을 사용하여 현재 전체 초안과 출석·실제 배치를 한 번에 저장합니다. 계획은 별도로 보존되고 저장 후에도 수정할 수 있습니다.

## 여러 선수 등록과 Excel

모든 아래 경로는 ADMIN 전용입니다. POST에는 CSRF 토큰이 필요합니다.

| 요청 | 결과 |
| --- | --- |
| `GET /api/v1/players/import/template` | .xlsx 양식 다운로드 (시트 1개, 헤더 9개, 포지션 드롭다운) |
| `POST /api/v1/players/import/preview` | multipart `file` 업로드 → 미리보기. DB 쓰기 없음 |
| `POST /api/v1/players/bulk/preview` | JSON rows 검사 → 미리보기. DB 쓰기 없음 |
| `POST /api/v1/players/bulk` | JSON rows 전체 저장 → 201, 생성된 선수 응답 배열 |

bulk의 본문은 `{rows: [...]}`입니다. 각 행의 키는 name/position/shirtNumber/joinedOn/firstChoice/secondChoice/thirdChoice/birthYear/clubRole이며 **미리보기에서 잘못된 입력을 보존하기 위해 모두 문자열**입니다. 선택 값은 빈 문자열 또는 생략 가능합니다. 개별 등록 API의 숫자·날짜 DTO와 구분합니다. 1~200행을 허용하며 null 행은 거부합니다.

미리보기 응답은 `{rows:[{rowNumber,values,errors,warnings}],valid}`입니다. Excel의 rowNumber는 원본 시트 행 번호이고, JSON 검토에서는 1부터 시작하는 입력 행 순서입니다. errors는 저장을 막으며 warnings는 동명이인 확인용입니다. 업로드한 문자열 포지션은 대문자로 정규화합니다. 빈 행은 Excel에서 제외하고, UI 직접 입력에서도 검토 전에 제외합니다.

Excel은 .xlsx / 2MB 이하 / 시트 한 개 / 헤더 `이름 (필수), 기본 포지션 (필수), 등번호 (선택), 가입일 (선택), 1지망 (필수: UN 제외), 2지망 (선택), 3지망 (선택), 생년 (선택), 직책 (선택)` 순서만 지원합니다. 기존 7열 양식(필수·선택 표시 유무 모두)도 읽으며 생년·직책은 빈 값으로 처리합니다. 9열 양식에서 생년·직책은 선택입니다. 수식·매크로·추가 열의 데이터는 허용하지 않고 압축 해제 크기도 제한합니다. 업로드 파일은 별도 영구 저장하지 않습니다.

bulk 저장은 같은 검증을 다시 수행한 뒤 하나의 트랜잭션에서 처리합니다. 잘못된 행이 있으면 400 `{code:"BULK_VALIDATION_ERROR",message,rows}`이며 아무 행도 저장하지 않습니다. 이름·등번호의 자동 중복 제거 또는 기존 선수 갱신은 하지 않습니다. 같은 파일을 재등록하면 새 선수가 생깁니다. 화면은 저장 버튼 연타를 막고, 네트워크 단절 등으로 저장 결과를 잃으면 목록을 확인하도록 재전송을 멈춥니다.

## 경기 기록

| 요청 | 권한·결과 |
| --- | --- |
| GET /api/v1/matches?page=0&size=10 | ADMIN/MEMBER. 날짜 내림차순, 동일 날짜는 ID 내림차순. size 기본 10, 1~100 허용. UI는 10개씩. `{items,page,totalPages,totalElements}` |
| GET /api/v1/matches/{id} | ADMIN/MEMBER. 기본 정보·참가자 이름/등번호·투표/출석·4쿼터 기록 |
| POST /api/v1/matches | ADMIN + CSRF. 전체 경기 생성, 201 + Location |
| PUT /api/v1/matches/{id} | ADMIN + CSRF. 전체 경기 수정, version 필수, 성공 시 갱신 버전 반환 |

투표만 입력한 경기 요청 예시 (선수 ID는 실제 등록된 ID를 사용):

```json
{
  "playedOn": "2026-10-18", "kickoff": "07:00", "venue": "", "opponent": "", "notes": "",
  "version": null,
  "participants": [{"playerId": 1, "vote": "ATTENDING", "attendance": "UNCONFIRMED"}],
  "quarters": [
    {"number": 1, "lineup": []},
    {"number": 2, "lineup": []},
    {"number": 3, "lineup": []},
    {"number": 4, "lineup": []}
  ]
}
```

경기 상세 participants의 birthYear는 현재 선수 프로필의 생년입니다. 화면은 경기 날짜의 연도를 기준으로 연령대를 계산합니다.

스코어 요청·목록·상세 필드는 `scoreFor`(외부 경기 우리 팀 / 자체전 A팀), `scoreAgainst`(외부 경기 상대 팀 / 자체전 B팀)입니다. 하루 4쿼터 합계이며 두 값 모두 null/생략은 미입력, 둘 다 0~99 정수여야 합니다. 0:0과 미입력을 구분하고 선수 득점 합계와 달라도 저장합니다. 목록은 `scorers:[{playerId,name,shirtNumber,playerType,goals,goalsA,goalsB}]`와 `scorerCount`를 추가 반환합니다. 실제 출전의 양수 득점 합계를 선수별로 모아 등번호 오름차순(NULL 마지막) → ID순으로 최대 3명 반환하며, scorerCount는 전체 득점자 수입니다. 팀이 바뀐 선수도 하나로 집계하고 goalsA/goalsB로 팀별 득점을 표시합니다.

V13부터 요청·상세·목록에 `kind: "EXTERNAL" | "INTERNAL"`을 사용합니다. 생략/null은 기존 요청과 호환되도록 EXTERNAL입니다. 최초 저장 후 유형 변경은 400입니다. INTERNAL은 4쿼터 전부 자체전이며 `opponent`는 빈 문자열이어야 합니다. 실제 `lineup`과 `plannedLineup`의 각 항목에는 `team: "A" | "B"`가 추가되고 생략/null은 A입니다. 외부 경기는 A만 허용합니다. 자체전에서는 같은 쿼터·팀·자리의 선발/교체를 구분하고, 선수 중복은 팀 구분 없이 검사합니다. 다른 쿼터에는 팀을 바꿀 수 있습니다. 출석 참가자는 팀과 무관하게 한 번만 보내며, 도움 검증·0.5쿼터 계산은 같은 팀 안에서 수행합니다.

실제 출석을 PRESENT/참석 또는 LATE/지각으로 바꾼 뒤 `lineup`에 `{"slot":"ST","playerId":1,"goals":2,"assists":0,"entryOrder":0}` 형태로 입력합니다. `entryOrder`는 선발 0(생략 시 0), 교체 1입니다. vote는 ATTENDING/ABSENT/UNDECIDED/UNANSWERED, attendance는 PRESENT/LATE/ABSENT/UNCONFIRMED입니다. 두 값은 독립적입니다.

- 참가자 0~200명, 정확히 1~4쿼터, 팀·쿼터당 0~22명(자체전 합계 44명). 빈 배치는 미기록으로 저장 가능합니다. 쿼터 길이는 받거나 반환하지 않습니다.
- 자리 코드는 GK/LB/LCB/RCB/RB/CDM/LCM/RCM/LW/ST/RW입니다. 같은 쿼터·자리에 선발 1명과 교체 1명까지 허용하고 교체만 있는 기록은 거부합니다. 동일 쿼터의 선수 중복·재투입·포지션 이동은 금지하며 다른 쿼터에는 다시 뛸 수 있습니다.
- 상세 응답의 참가자별 `creditedQuarters`는 계산된 출전량입니다. 같은 자리에 선발·교체가 함께 있으면 각각 0.5, 선발만 있으면 1로 합산합니다. 수정 요청에는 보내지 않습니다. 프로 경기 환산과는 별개입니다.
- 날짜는 필수(1000~9999년), 시작 시간 필수(분은 00/30, 초·소수초는 0), 장소/상대는 각 100자 이하 빈 문자열 허용, 코멘트는 3,000자 이하. null 문자열은 거부합니다. 기존 미입력·비정규 시간은 조회만 허용하고 수정 때 새 시간 규칙을 적용합니다. 화면의 종료 시간은 시작 + 2시간으로 계산하며 API에 종료 시간을 보내거나 저장하지 않습니다.
- 득점·도움은 0~99 정수, 팀·쿼터 도움 합계 ≤ 해당 팀 득점 합계. 실제 참석자 명단에 없는 선수의 출전도 거부합니다.
- 400은 입력 오류, 404는 없는 경기, 409는 수정 충돌입니다. 한 경기 전체를 트랜잭션으로 저장하며 실패 시 일부 기록만 남기지 않습니다.
- 새 경기 version은 null/생략, 수정은 조회한 version을 보냅니다. 기본 정보가 같고 하위 배치만 바뀌어도 버전이 증가합니다.
- 신규 생성의 서버 멱등성 키는 아직 없습니다. UI는 연타를 막고 네트워크 오류 등으로 결과가 불확실하면 재전송을 차단하고 목록 확인을 안내합니다.
- 삭제, 카카오톡 자동 수집, 모임 묶음, 기록 확정과 시즌 순위 API는 아직 없습니다.

### 경기 엑셀 가져오기

자체전 UI는 기존 양식을 A팀·B팀별로 업로드합니다. 미리보기의 team은 A이며 UI에서 선택한 팀으로 명시적으로 변환합니다. 선택한 팀의 4쿼터만 대체하며 상대 팀은 보존하고, 같은 쿼터의 양 팀 중복 선수가 있으면 초안에 반영하지 않습니다.

ADMIN 전용이며 POST에는 CSRF가 필요합니다.

| 요청 | 결과 |
| --- | --- |
| GET /api/v1/matches/import/template | `hana-fc-match.xlsx`: 쿼터기록·작성안내 시트, 4×11×선발/교체의 빈 양식 |
| POST /api/v1/matches/import/preview | multipart `file` → `{valid,rows,quarters}`. DB 쓰기 없음 |

8개 열은 `쿼터 (필수)`, `포지션 (필수)`, `출전 구분 (필수)`, `이름 (필수)`, `등번호 (선택)`, `득점 (선택: 기본 0)`, `도움 (선택: 기본 0)`, `선수 ID (선택)` 순서입니다. 열 제목을 유지합니다. 이름·등번호·스탯·ID가 모두 빈 행은 비어 있는 배치로 제외합니다. 선발/교체 값은 한글이며 다른 선택지는 허용하지 않습니다.

등록된 선수 이름을 기준으로 찾고 선택 등번호·ID로 좁힙니다. 모호하거나 없는 선수는 행 오류이며 자동 생성하지 않습니다. `rows` 항목은 `{rowNumber,values,playerId,name,shirtNumber,errors,birthYear}`이고 values는 원본 8열 문자열입니다. 오류가 없을 때만 `quarters`에 1~4쿼터 초안을 반환합니다. UI에서 반영하면 기존 4쿼터를 모두 대체하되 투표·출석은 유지하고, 새 참가자만 미투표/미확인으로 추가합니다. 최종 저장은 기존 경기 POST/PUT의 전체 검증을 다시 통과해야 합니다.

.xlsx 2MB / 최대 88행 / 쿼터기록 + 선택 작성안내만 허용합니다. 수식·매크로·추가 열 데이터·압축 해제 20MB 초과를 거부하고 원본 파일을 영구 저장하지 않습니다. 입력 오류는 400, HTTP 업로드 크기 제한 초과는 413입니다.

## 상태 확인

`GET /actuator/health`

DB를 포함한 애플리케이션의 상태를 반환합니다. 정상일 때 `{"status":"UP"}`이며, 내부 접속 정보와 상세 오류는 외부에 표시하지 않습니다.

## 경기 계획 스쿼드 (V10)

### 자동 편성 계산

`POST /api/v1/matches/lineup-suggestion` — ADMIN 세션과 CSRF 필요. DB 쓰기 없음.

```json
{"playedOn":"2026-10-18","playerIds":[1,2,3],"matchId":null,"seed":123}
```

ID는 설명용이다. 날짜·playerIds(중복 없는 활동 선수 1~200명)·seed(0~2147483647 정수)는 필수, matchId는 편집 중인 경기 ID 또는 null/생략이다. 화면은 ATTENDING 선수 ID만 보낸다. 신규 경기의 미저장 투표이므로 서버는 전달된 명단을 편성 입력으로 취급하고 선호 포지션·출석률은 DB에서 읽는다. 편집 중인 경기는 출석률에서 제외한다.

응답은 `{policyVersion, seed, plannedLineup, allocations, warnings, optimal}`이다. allocations 항목은 `{playerId,group,attended,recorded,quarters,restQuarters,nonPreferredAppearances}`이며 group은 GK/FIELD/UNKNOWN이다. 출석률은 attended/recorded로 계산하고 recorded=0은 기록 없음이다. optimal은 두 단계 각각의 최적 종료 여부이며 전체 전역 최적을 뜻하지 않는다. 자세한 조건과 시간 제한은 [자동 편성 설명](automatic-lineup.md)을 참고한다.

중복·없는 선수·비활동 선수·불가능한 인원·동시 계산·제한 시간 내 출전표 생성 실패는 400, 없는 matchId는 404이다. 오류 응답 후 기존 계획을 유지하며 재시도해도 경기가 중복 생성되지 않는다. 성공한 계획의 영구 저장은 아래 기존 POST/PUT을 사용한다.

### 계획 저장

경기 POST/PUT/GET의 `plannedLineup` 항목은 `{quarterNumber: 1, team: "A", slot: "ST", entryOrder: 0, playerId: 1}` 형식입니다. 설명용 ID이며 실제 선수를 의미하지 않습니다. 팀당 최대 88개(자체전 합계 176개), 쿼터 1~4, 선발 0/교체 1, 기존 11개 slot을 사용합니다. 같은 쿼터에 선수를 중복할 수 없고 같은 팀·자리의 교체에는 선발이 필요합니다. 해당 경기 참가자의 vote가 ATTENDING이어야 하며 실제 attendance는 미확인이어도 됩니다. 누락/null은 빈 계획이며 PUT은 전체 계획을 교체합니다.

실제 `quarters`와 별도로 저장하며 계획만 있어도 실제 creditedQuarters는 0입니다. 계획 변경도 경기 version을 증가시키며 오래된 PUT은 409입니다. 계획을 실제 기록으로 복사하는 것은 프론트의 명시적 초안 변경이고, 기존 저장 API의 실제 참석·지각 검증을 그대로 받습니다.

## 생년과 팀 직책 입력 규칙

선수 등록·수정·조회에 birthYear(INT 또는 null), clubRole을 사용합니다. 생년은 1900~현재 한국 연도의 정수이며 소수·미래 연도는 거부합니다. PUT에서 생년을 생략하거나 null로 보내면 비웁니다. 직책은 정회원/코치/감독/총무/회장만 허용하며 null·빈 문자열·생략은 정회원으로 정규화합니다. 팀 직책으로 로그인 권한을 부여하지 않습니다. UI 나이는 기준 연도 − 생년으로 계산하며 생일은 사용하지 않습니다.

일괄 UI와 Excel도 같은 직책·등번호 규칙을 적용합니다. Excel 직책 열에는 다섯 값의 목록과 기본값 안내가 있습니다. 입력 내 중복 번호(예: 7과 07)와 DB 활동 선수의 번호 충돌을 행별 오류로 표시하고, 저장 시 다시 확인합니다. 한 행이라도 오류이면 전체를 취소합니다.
