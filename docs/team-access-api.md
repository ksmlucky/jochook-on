# 팀 접속 API 구현 계약

2026-10-14 구현 기준. 사용자 승인: 기획 정책 P01~P14를 채택한다. 실제 검증 결과는 완료 후 별도로 기록한다. 경로는 `/api/v1` 기준이며 변경 요청에는 기존 CSRF 헤더를 사용한다. 날짜/시간은 ISO-8601 UTC이며 화면에서 한국 시간으로 표시한다. 비밀 원문은 예시·로그에 넣지 않는다.

추가 변경: 회원 접속에 코드와 자동 생성 팀 비밀번호를 함께 사용한다. 12자 코드 + 숫자 6자리 비밀번호와 V17의 구현·로컬 적용·자동 검증을 완료했다. 실제 실행한 범위와 미검증 항목은 [검증 기록](verification.md), 화면 흐름은 [팀 비밀번호 명세](team-code-password.md)를 따른다.

현재 계약은 V18의 DIRECTOR / COACH / MEMBER 구분과 감독의 코치 관리를 반영한다. 이 문서 갱신만으로 V18 검증·실제 DB 적용을 완료한 것으로 보지 않는다. 운영 정책과 추가 화면은 [감독·코치 권한 명세](team-staff-permissions.md)를 따른다.

## 공통 형식

```ts
type Team = { id: number; name: string; description: string | null; status: 'ACTIVE' | 'PENDING' | 'INACTIVE' }
type TeamRole = 'DIRECTOR' | 'COACH' | 'MEMBER'
type StaffRole = 'DIRECTOR' | 'COACH'
type MyTeam = Team & { role: TeamRole }
type CurrentUser = {
  username: string | null; role: TeamRole;
  authType: 'ACCOUNT' | 'TEAM_CODE'; serviceAdmin: boolean;
  team: Team | null; teams: MyTeam[];
}
type Member = { id: number; username: string; role: TeamRole; active: boolean }
type Invite = { id: number; label: string; role: StaffRole; status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'; expiresAt: string }
type InviteIssued = Invite & { token: string } // 성공 응답에서만 1회
type TeamDetail = { team: Team; members: Member[]; invitations: Invite[] }
type CodeState = { status: 'NONE' | 'ACTIVE' | 'REVOKED' | 'EXPIRED'; version: number; issuedAt: string | null; expiresAt: string | null }
type CodeIssued = CodeState & { code: string; password: string } // 두 원문은 성공 응답에서만 1회
type TeamError = { code: string; message: string; retryAfterSeconds?: number }
```

팀 선택이 없는 계정도 인증은 유효하며 `team=null`, `role=MEMBER`가 될 수 있다. `serviceAdmin`과 현재 팀의 운영 권한은 독립적이다. 매 요청의 활성 소속으로 권한을 확인하며 선수의 `clubRole`은 인증 권한이 아니다. V18은 기존 소속 ADMIN과 구 운영진 초대를 COACH로 이전하며, 별도 결정한 초기 계정 하나만 DIRECTOR로 지정한다.

## 인증·팀 전환

| 메서드·경로 | 요청 | 결과 |
| --- | --- | --- |
| GET `/auth/csrf` | 없음 | 기존 `{headerName,token}` |
| POST `/auth/login` | 기존 form username/password | 성공 204; GET `/auth/me`로 상태 조회 |
| GET `/auth/me` | 세션 | CurrentUser; 비인증 401 |
| POST `/auth/logout` | 없음 | 204, 세션 종료 |
| POST `/auth/team-code` | `{code: string, password: string}` | CurrentUser; 두 값이 모두 유효할 때만 기존 조회 세션 교체 |
| POST `/auth/team` | `{teamId: number}` | CurrentUser; 개인 계정의 활성 소속만 선택 |
| POST `/auth/invitation/inspect` | `{token: string}` | `{team: Team, label: string, expiresAt: string, role: StaffRole}`; 유효 초대만 정보 반환 |
| POST `/auth/invitation/accept` | `{token: string, username?: string, password?: string}` | CurrentUser; 새 계정은 ID·비밀번호 필요, 로그인 계정은 token만 |

초대 원문은 `/#invite=<token>` 링크의 fragment에서 읽은 뒤 주소에서 지우고 메모리에서만 보관한다. 이미 존재하는 ID는 덮어쓰지 않고 `ACCOUNT_EXISTS`로 기존 계정 로그인을 안내한다. 코드 접속자로 초대 수락하려면 새 계정 입력 또는 개인 로그인 필요.

초대 확인·수락은 발급자의 현재 계정 활성 상태와 권한도 검사한다. 활성 서비스 관리자가 발급했거나, COACH 초대의 발급자가 해당 팀의 활성 DIRECTOR일 때만 사용할 수 있다. 권한 상실 뒤 미사용 링크는 거부하며 현 권한자가 재발급할 수 있다. COACH 초대를 이미 활성 DIRECTOR인 계정이 수락해도 DIRECTOR를 유지한다.

팀 비밀번호는 숫자 6자리 문자열이며 맨 앞 0을 유지한다. 코드는 기존 대소문자·공백·구분 하이픈 정규화를 유지한다. 코드만 먼저 검증하는 공개 API는 없고 팀 이름도 성공 전 공개하지 않는다. 틀린 코드·비밀번호, 없는 코드, 만료·폐기는 동일한 `INVALID_CODE`(401) 응답으로 처리한다. 코드 단독 접속은 허용하지 않는다. 두 값은 URL·로그·브라우저 영구/세션 저장소에 남기지 않는다.

## 서비스 관리자

| 메서드·경로 | 요청 | 결과 |
| --- | --- | --- |
| GET `/service/teams` | 없음 | `Team[]` |
| GET `/service/teams/{teamId}` | 없음 | TeamDetail |
| POST `/service/teams` | `{requestId: UUID, name, description?, assignmentType:'EXISTING'|'INVITE', username?, inviteLabel?}` | `{team:Team, invitation:InviteIssued|null, replayed:boolean}`; 최초 지정·초대 역할 DIRECTOR |
| POST `/service/teams/{teamId}/members` | `{username:string, role?:StaffRole}` | TeamDetail; role 생략은 DIRECTOR |
| DELETE `/service/teams/{teamId}/members/{membershipId}` | 없음 | 204; 소속 비활성화, 마지막 활성 DIRECTOR 보호 |
| POST `/service/teams/{teamId}/invitations` | `{label:string, role?:StaffRole}` | InviteIssued; role 생략은 DIRECTOR |
| POST `/service/teams/{teamId}/invitations/{inviteId}/reissue` | 없음 | InviteIssued; 이전 원문 무효 |
| DELETE `/service/teams/{teamId}/invitations/{inviteId}` | 없음 | 204 |

생성의 동일 requestId+동일 내용은 같은 팀 상태를 반환하고 초대 원문을 다시 표시하지 않는다(`invitation=null,replayed=true`). 같은 requestId의 다른 내용은 409. 초대 원문을 놓쳤으면 상세에서 재발급한다. membership id는 계정/선수 id와 다르다.

서비스 관리자는 팀 소속 역할을 지정·변경할 수 있으나, 마지막 활성 DIRECTOR의 강등 또는 소속 해제는 `LAST_DIRECTOR`(409)로 거부한다. 활성 계정과 활성 DIRECTOR 소속만 대체 감독으로 계산하며 코치와 미수락 초대는 포함하지 않는다. 서비스 관리자 플래그 자체는 선수·경기 쓰기 권한을 부여하지 않는다.

## 감독의 현재 팀 코치 관리

아래 모든 요청은 개인 계정의 현재 팀 DIRECTOR 권한과 `X-Team-Id`가 필요하다. 변경에는 CSRF 헤더도 필요하다. 팀 ID는 URL로 지정하지 않으며 서버가 확인한 현재 팀을 사용한다.

| 메서드·경로 | 요청 | 결과 |
| --- | --- | --- |
| GET `/team/coaches` | 없음 | TeamDetail; 팀 소속 목록과 COACH 초대 목록 |
| POST `/team/coaches/members` | `{username:string}` | TeamDetail; 활성 계정을 COACH로 임명·재활성화 |
| DELETE `/team/coaches/members/{membershipId}` | 없음 | 204; COACH를 MEMBER로 변경, 기존 활성 상태 유지 |
| POST `/team/coaches/invitations` | `{label:string}` | InviteIssued; 서버가 COACH 역할로 고정 |
| POST `/team/coaches/invitations/{inviteId}/reissue` | 없음 | InviteIssued; 현재 팀 COACH 초대만 재발급 |
| DELETE `/team/coaches/invitations/{inviteId}` | 없음 | 204; 현재 팀 COACH 초대만 취소 |

직접 임명은 기존 DIRECTOR 또는 본인 계정을 변경하지 않는다. 해제는 COACH 소속만 가능하며 감독 소속·감독 초대 변경은 `PROTECTED_MEMBER`(409)로 거부한다. 감독은 요청에 다른 role 값을 끼워 보내도 감독을 임명할 수 없다. 코치 해제는 계정·선수 삭제가 아니며, 활성 소속이면 해당 팀 조회와 다른 팀 권한은 유지한다. 팀·역할은 다음 요청에 다시 검사해 이미 열린 편집 화면에서도 권한 회수가 적용된다.

## 팀 운영진 코드 관리

현재 팀의 DIRECTOR 또는 COACH만 아래 API를 사용한다. 코드 접속자는 MEMBER이며 어떤 변경 권한도 갖지 않는다.

| 메서드·경로 | 요청 | 결과 |
| --- | --- | --- |
| GET `/team/code` | `X-Team-Id` | CodeState |
| GET `/team/code/history?limit=20` | `X-Team-Id`, limit 1~100 | 현재 팀의 최신순 코드 발급·재발급·폐기 이력 |
| POST `/team/code` | `X-Team-Id`, `{version:number}` | `CodeIssued`; 코드·팀 비밀번호 함께 발급/재발급 |
| DELETE `/team/code` | `X-Team-Id`, `{version:number}` | CodeState; 기존 코드·팀 비밀번호·해당 조회 세션 무효 |

미발급 version은 0. 코드 변경은 버전 검사 후 원자적으로 처리한다. 12자 코드의 표시 구분자는 별도이며 저장/검증은 정규화한 값의 SHA-256 해시로 한다. 독립적으로 생성한 숫자 6자리 팀 비밀번호는 BCrypt 해시만 저장한다. 두 값은 같은 version으로 함께 갱신하고 유효기간은 공통으로 90일이다. 신규 초대 24시간, 조회 세션 유휴 24시간/최대 7일, 계정 유휴 30분은 유지한다. `CodeState`·이력·폐기 응답에는 두 원문과 해시가 없다.

이력 응답은 `{id, action: 'ISSUED'|'ROTATED'|'REVOKED', actorUsername, version, occurredAt, expiresAt}` 배열이다. 화면은 최근 20건을 표시한다. V16 이후의 코드 변경을 같은 DB 트랜잭션에서 추가 기록하며, 코드·비밀번호 원문과 해시는 이력에 저장하거나 반환하지 않는다. 이전에 발급된 코드의 과거 작업을 추정해서 복원하지 않는다. V17 이후 비밀번호 해시가 없는 구 코드는 신규 접속과 기존 코드 세션 모두 거부하며 운영진이 두 값을 새로 발급해야 한다.

## 기존 선수·경기 API의 팀 경계

- `/players/**`, `/matches/**`, `/team/**` 요청은 조회를 포함해 `X-Team-Id`가 필수다. 해당 브라우저 세션의 선택 팀 및 현재 활성 소속과 검증한다. 서버 요청 필터가 승인한 팀만 `TeamContext.requireTeamId()`에서 읽는다.
- 선수·경기 조회는 DIRECTOR/COACH/MEMBER, 등록·수정·일괄·용병·엑셀·자동 편성은 DIRECTOR/COACH에 한정한다. 팀 코드와 서비스 관리자 플래그만으로 변경할 수 없다.
- 화면은 요청 시작 당시 팀 ID를 명시한다. 팀 변경으로 이전 응답이 늦게 돌아오면 버리고, 새 팀으로 키를 바꿔 선수·경기 컴포넌트를 다시 만든다. 오래된 탭이 이전 팀 초안을 저장하면 `TEAM_CHANGED`(409)를 반환한다.
- 다른 팀 데이터 ID는 조회/변경하지 않으며 소속 팀 내 존재하지 않는 리소스와 같은 404를 사용한다. 다른 팀 선수가 섞인 경기·엑셀·편성은 전체 요청을 거부한다.
- 팀이 없거나 코드/팀이 만료·비활성화되면 해당 팀 데이터 접근을 거부한다. 운영진 코드 폐기는 개인 계정 로그인을 끝내지 않는다.
- 공개 엔드포인트인 코드/초대 입력에는 실패 제한을 적용한다. IP 및 브라우저 세션별 10분 내 실패 10회 뒤 10분 대기, 응답은 429와 Retry-After. 프록시 전달 IP는 신뢰할 프록시 구성 없이는 사용하지 않는다.
- 일반 실패는 `TeamError`이며 권한 403, 입력 400, 세션 401, 팀/동시 수정 409, 재시도 제한 429로 구분한다. 실제 계정·코드·팀의 존재를 공개 오류에 노출하지 않는다.

## 담당 경계

- 백엔드 에이전트: auth/config/team, V18 역할 이전과 관련 테스트.
- 총괄: 공통 설계, 기존 테스트·통합 검증·데이터 백업/이전·실행.
- 프론트 에이전트: frontend 전체와 프론트 검증.
- 기획 에이전트: 요구사항/스토리보드 승인 반영·인수 검토.
