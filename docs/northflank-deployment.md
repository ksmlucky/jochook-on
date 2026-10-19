# Northflank 무료 시범 배포

최신 웹 운영 확인 2026-10-19 18:36:21 KST: `be49b2f` / API `dd29444`·DB V31 유지 / 가이드1.10. [선수 즉시 배치와 간결한 저장](squad-picker-2026-10-19.md). 무료 자원 변경 없음.

2026-10-17 22:35 KST 운영 반영: 웹 `072ac46`, API `d8b2763` 유지 / DB V30 변경 없음 / 가이드1.4. [배포 결과](release-roster-pagination-2026-10-17.md).

아래 이전 버전 표시는 해당 시점의 검증 이력입니다.

## 최신 운영 배포 — 홈·계정 보호 개선판

2026-10-16 16:31 KST 운영 검증 완료: `d8b2763` / Flyway V30 / 가이드1.3. [배포 결과·휴대폰 확인 항목](release-home-account-2026-10-16.md). 기존 무료 사양·네트워크·자동 빌드 비활성 유지. API/웹 완료, 기존 자료 보존, 공개 자산·로그인·조회 검증을 확인했다.

아래는 이전 배포 이력이다.

## 이전 운영 배포 — 대회·기록 확장판

2026-10-15 23:45 KST 확인. 웹/API 모두 `9d3d347`, DB V28, 역할별 가이드1.2입니다. CI(프론트245·Java454·MySQL145), 백업16개 테이블 복원·운영 원본 보존, 공개 HTTPS·인증·조회·권한과 자산 해시 검증을 완료했습니다. 무료 사양·인스턴스1개·비공개 API/DB·자동배포 비활성은 유지합니다. [배포 결과·휴대폰 점검·롤백 주의](release-tournament-expansion-2026-10-15.md).

V26 이후 구 API 이미지만 롤백하지 않습니다. 기존 API 쓰기를 멈춘 상태에서 새 API·DB를 확인한 뒤 웹을 갱신했습니다. 기존 계정·팀 코드·경기는 보존했고 로컬 시험 자료는 이전하지 않았습니다.

아래 배포별 항목은 이전 확인 시점의 이력입니다.

2026-10-14 Northflank Developer Sandbox에서 API·웹·MySQL 실행, 실제 DB 이전, 공개 HTTPS 로그인·조회 검증을 완료했다. **[조축ON 접속](https://http--jochook-on-web--wmjz5mzg84j4.code.run/)**. 아이폰 실기기 설치와 팀원 시범 사용은 다음 확인 단계다. Oracle 6시간 정기 확인은 유지하며, 서버 확보 후 성능·운영 부담과 DB 복구를 검증한 뒤 이전 여부를 결정한다.

## 기능확장판 운영 배포 (2026-10-15 18:57 KST)

- API·웹 동일 커밋 `b9d8738f080d49911b31fcf9ef42b463a23478d8`. Northflank 빌드 `wired-note-4630`(API), `breezy-spring-2201`(웹) 성공과 서비스 배포 완료 확인. 기존 무료 사양·계정·네트워크 유지.
- [GitHub Actions 38715102347](https://github.com/ksmlucky/jochook-on/actions/runs/38715102347) 성공: Java 단위/API **278개**, Docker MySQL 통합 **109개**, 프론트 **98개**, 백업 점검 **7개**. 실패·건너뜀 없음, JAR·웹 빌드 성공. 로컬 Gradle UP-TO-DATE 결과와 CI의 실제 실행을 구분한다.
- 배포 직전 DPAPI 암호화 백업을 새 로컬 MySQL에 복원해 **15개 테이블 전체 행 지문** 일치 확인, 임시 서버·데이터 정리. V21~V23 적용 후 **기존 14개 업무 테이블의 모든 원래 컬럼·행 지문** 일치. 새 포메이션 기본값 F4123, 저장 영수증 테이블 추가.
- 공개 HTTPS의 배포 JS·CSS와 역할별 PDF 바이트가 검증한 릴리스 빌드와 동일. 기존 감독 로그인, 세션 보안 속성, 선수·경기·이력·기본/전체 시즌 기록 조회, 포메이션 필드, 익명 접근·다른 팀 접근 차단과 외부 actuator 비공개 확인. 운영 선수·경기를 시험 저장하지 않았다.
- 가이드 1.1: 회원 4쪽·운영진 10쪽 전체 PDF 렌더링 및 링크·글꼴 확인. 기능 설명·구성도는 이번 배포를 기준으로 확정한다.
- 운영 브라우저 390×844에서 선수 기록 기본 필터, 운영진 가이드 1.1·목차 10개·PDF 연결을 확인했다. 02·03 전체보기는 11자리·약 489px 높이이며, 02 배치/교체와 03 골/도움 편집창을 열어 확인한 뒤 변경·저장 없이 닫았다. 기존 경기 포메이션 F4123 유지·6개 선택값·실제 기록이 있을 때 변경 잠금, 가로 넘침 없음도 확인했다. 회원 역할 화면은 기존 로컬 검증·회귀 테스트 기준이며 이번 운영 브라우저에서 팀 코드 접속을 다시 시험하지 않았다.
- 실제 iPhone Safari 터치·설치·장시간 다중 사용자 부하는 미검증. 휴대폰 사용자 확인 및 자동 백업 일정은 후속 과제다. DPAPI 로컬 백업은 PC 분실 대비 독립 사본이 아니다.

## 이전 배포: 모바일 경기 입력·작성 상태 (2026-10-15 00시 47분 · 한국 시간)

- 사용자의 배포 요청에 따라 API·웹 모두 `dd67f92`를 배포했다. Northflank 빌드 `full-cherries-3971`(API), `choice-shelter-2198`(웹)이 성공했고 두 서비스의 배포 완료 및 동일 커밋을 확인했다. 무료 사양·비공개 네트워크·기존 계정과 팀 코드는 유지했다.
- [GitHub Actions 38590851827](https://github.com/ksmlucky/jochook-on/actions/runs/38590851827): Java 단위/API 211개, Docker MySQL 통합 91개, 프론트 45개 통과. JAR·TypeScript/Vite 빌드도 통과했다. 로컬 Docker 엔진 시작 오류와 CI에서의 실제 Docker 통합 테스트 성공을 구분한다.
- 01 참석 선택과 02 후보를 모바일 4열로, 02·03을 작전판 배치와 작은 교체/상세 편집 방식으로 변경했다. 경기 목록에는 저장한 단계와 명시적 완료 여부를 표시한다. 이전 경기는 완료로 추정하지 않고 상태 미지정으로 남는다.
- 운영 DB를 배포 직전에 비공개 TLS로 읽어 `backups/northflank/20261015-before-mobile-progress/`에 DPAPI 암호화했다. 평문 SQL 파일을 만들지 않았고 격리된 네이티브 MySQL에 복원해 15개 테이블의 전체 행 지문을 대조했다. 복원 검증 서버는 종료했다.
- 운영 V20 적용 후 기존 14개 업무 테이블의 행 수와 모든 기존 컬럼의 SHA-256 지문이 백업과 일치했다. Flyway만 19→20이 되었고 기존 경기의 새 상태 컬럼은 NULL이다. 배포 직전 선수 40명(활동 39명), 경기 1건 기준이며 최초 이전 당시 경기 2건과는 시점이 다르다.
- 공개 HTTPS에서 새 번들 `index-DFr1if4x.js`·`index-Ba2Py8Mb.css`, 홈 200·헬스 204, 기존 감독 로그인, Secure/HttpOnly/SameSite=Lax 쿠키, 선수·경기·이력 조회, 목록/상세의 상태 필드, 익명 401·다른 팀 차단·actuator 404를 확인했다. 실제 운영 자료를 시험 저장·수정·삭제하지 않았다.
- 운영 브라우저의 390px 뷰포트에서 로그인·기존 경기의 상태 미지정 배지·01 카드 4열(간격 6px)·02 후보 4열과 11자리 작전판·03 요약 11개·04 완료 버튼을 확인했다. 콘텐츠 폭 375px(스크롤바 제외)에서 가로 넘침이 없었고, 탭만 이동한 뒤 저장 없이 목록으로 돌아와 로그아웃했다.
- 새 버전은 페이지 새로고침으로 받는다. 서버 재배포로 세션이 만료됐으면 기존 계정으로 다시 로그인한다. 실제 iPhone Safari 사용성은 사용자 확인이 남아 있다.

## 실제 계정에서 확인한 상태

### 백업 후속 점검 (2026-10-15 08시)

Native dump 백업을 기본 저장소에 생성하고 로컬 암호화 사본을 보관했다. 새 MySQL에 복원해 15개 테이블의 무결성과 V20 이력을 확인했고 임시 데이터를 정리했다. 사용자 승인으로 설정 수정 권한 한 개를 잠깐 추가했으나 API는 **무료 계정에서 daily 백업 일정 불가(400)**로 거절했다. 임시 권한을 즉시 회수하고 변경 전 상태와 일치함을 확인했다. 08:50 KST 재조회에서도 자동 일정은 없으며 수동 백업만 완료 상태다. 요금표의 백업·복원 포함을 매일 예약 허용으로 해석하지 않는다. 유료 전환은 하지 않았다. 자세한 현재 상태·명령·남은 범위는 [백업·복구 절차](backup-recovery.md)를 따른다. 아래 밤사이 검토 항목은 당시 확인 상태를 기록한 것이다.

- 사용자가 가입과 0달러 카드 인증을 완료했다. 카드 원문은 프로젝트에 보관하지 않는다.
- 무료 계정에서 선택 가능한 리전은 US - Central과 Europe - West였다. 아시아 리전은 유료 전환이 필요하여 US - Central을 선택했다.
- `jochook-on-mysql`은 Free 표시의 Running 상태다. MySQL 8.4.11, 0.2 vCPU / 512MB, NVMe 6GB, 인스턴스 1개, TLS 사용, Private networking only 구성이다. 실제 자료 복구 후 15개 테이블의 모든 행을 원본 SHA-256 지문과 대조해 일치했다.
- GitHub 앱의 기존 전체 저장소 접근을 `ksmlucky/jochook-on` 한 개로 줄이고 Northflank 연결 목록에서 확인했다.
- API는 `nf-compute-20` (0.2 shared CPU / 512MB), 웹은 `nf-compute-10` (0.1 shared CPU / 256MB)이며 각각 1개 인스턴스로 Running이다. 유료 업그레이드·도메인 구매는 하지 않았다. 무료 한도는 실제 계정에서 확인한 값이며 향후 정책 변경을 보장하지 않는다.
- 공식 CLI에 연결한 `jochook-on-deploy` 권한은 Default 프로젝트 한정, 토큰 만료는 발급 후 1일이다. GitHub 앱은 해당 저장소만 접근한다. 토큰·DB 비밀번호·실제 선수 정보는 Git에 넣지 않는다.

## 배포 구성

```text
휴대전화 / PC
    └─ HTTPS : Northflank 기본 code.run 주소
          └─ web:8080 (Caddy + React)
                 └─ /api/* → api:8080 (비공개)
                                  └─ MySQL (비공개 + TLS)
```

Northflank가 HTTPS 인증서와 외부 연결을 처리하므로 Caddy는 내부 HTTP 8080으로 실행한다. 화면과 API를 같은 주소로 묶어 기존 세션 쿠키와 CSRF 방식을 유지한다. DB와 API 포트는 공개하지 않는다. PWA는 이 HTTPS 주소에서 확인하며 도메인 구매는 필요하지 않다. [공식 네트워크 안내](https://northflank.com/docs/v1/application/network/networking-on-northflank).

기존 Oracle/직접 HTTPS 배포와 개발 서버 설정은 유지한다. 추가 Docker target은 `web-northflank`이고 설정 파일은 `deploy/Caddyfile.northflank`다. API는 기존 `api` target을 사용한다. Dockerfile 위치는 `/Dockerfile`, 빌드 컨텍스트는 저장소 루트 `/`다. [target 빌드 안내](https://northflank.com/docs/v1/application/build/build-with-a-dockerfile).

| 서비스 | 설정 |
| --- | --- |
| web | `web-northflank` target, 컨테이너 포트 8080, HTTP readiness `/healthz` |
| api | `api` target, 비공개 포트 8080, readiness `/actuator/health`, 초기 기동에 충분한 유예 시간 |
| mysql | 이미 생성한 MySQL 8.4.11, 비공개 주소·TLS 연결, DB 이름 `hana_fc` |

## 실행 환경변수

비밀번호는 런타임 Secret으로 주입하고 빌드 인수·이미지·Git 문서에 넣지 않는다. MySQL 인증서는 연결 상세에 맞춰 검증하고, 검증을 끄는 방식으로 TLS 오류를 우회하지 않는다. 필요하면 플랫폼 Secret file과 Java trust store를 사용한다.

API에는 `SERVER_ADDRESS=0.0.0.0`, `SERVER_PORT=8080`, `SERVER_FORWARD_HEADERS_STRATEGY=framework`, `SESSION_COOKIE_SECURE=true`를 지정한다. DB 접속은 `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` 등 Spring의 환경변수 덮어쓰기를 사용하여 TLS 설정을 포함한다. URL에 비밀번호를 넣지 않는다. 커넥션 풀과 JVM 메모리는 실제 무료 할당과 검증 결과에 맞춰 설정한다.

web에는 다음 값을 지정한다.

| 이름 | 값의 의미 |
| --- | --- |
| `JOCHOOK_ON_SITE_HOST` | `http--jochook-on-web--wmjz5mzg84j4.code.run` |
| `JOCHOOK_ON_API_UPSTREAM` | `jochook-on-api:8080` |
| `JOCHOOK_ON_TRUSTED_PROXY_CIDRS` | `private_ranges` — 실제 ingress 사설 주소 확인 및 프로젝트 내부 격리를 전제로 사용 |

Caddy는 전달 헤더를 정규화하고, 신뢰한 프록시에서 온 IP 목록만 오른쪽부터 판별한다. 임의의 `0.0.0.0/0`이나 `::/0`은 신뢰하지 않는다. 실제 ingress peer가 사설 주소임을 확인했고, 외부 요청에 위조 X-Forwarded-For·Forwarded·X-Real-IP·CF-Connecting-IP·Host/Proto 전달 헤더를 넣어도 실제 외부 접속 IP가 유지되는 것을 확인했다. 이 신뢰 설정은 현재 프로젝트 내부의 서비스들을 신뢰한다는 전제이므로 다른 조직·미신뢰 서비스와 네트워크를 공유할 때 다시 검토한다. `/actuator*`는 외부에 전달하지 않고 API 응답은 `no-store`로 처리한다. 요청 로그에서는 모든 요청 헤더와 URI를 제거해 쿠키·인증 정보·초대 URL을 기록하지 않는다.

실제 JDBC 연결은 `sslMode=VERIFY_IDENTITY`로 인증서와 호스트명을 검증한다. 최초 배포는 Flyway 19였고 모바일 배포에서 V20, 기능확장판 배포에서 V23까지 적용·검증했다. 최초 API 기동은 약 83초였다. 서비스 재배포 시 메모리 세션은 사라지므로 재로그인이 필요하다.

## 완료한 클라우드 검증과 다음 확인

- API 이미지 `9f580c4`, 웹 이미지 `a21ce3d` 빌드·배포 성공. 웹 빌드에서 `caddy validate` 실행도 성공했다. 두 커밋의 GitHub Actions가 success다. Northflank 자동 Git 빌드는 꺼 두었으므로 이후 코드 push만으로 운영 서버가 바뀌지 않는다. 테스트 후 서비스별 Build에서 검증할 커밋을 지정한다.
- HTTPS 홈 200, HTTP→HTTPS 전환, 익명 선수 조회 401, 외부 actuator 404, manifest·Service Worker 200을 확인했다.
- 기존 감독 계정 로그인 204, Secure·HttpOnly·SameSite=Lax 세션 쿠키, 활동 선수 39명·경기 2건·변경 이력 조회를 확인했다. CSRF 없는 빈 수정 요청은 403, 다른 팀 ID의 조회는 409로 차단됐다. 실제 경기·선수 수정이나 삭제는 시험하지 않았다.
- 브라우저에서 기존 계정 로그인·선수단·경기 목록·로그아웃을 확인했다. 폭 390px 설정에서 콘텐츠 폭 375px(스크롤바 제외)와 가로 넘침 없음, 모바일 경기 카드를 확인했다. 아이폰 Safari 실제 설치·standalone·카메라/파일 선택 및 다중 사용자 부하는 미확인이다.
- 현재 클라우드 DB의 복구 직후 화면 지표는 메모리 평균 약 244MB/최대 285MB, 저장 약 135MB/6GB였다. 장기 부하 검증 수치가 아니다.

**실제 입력은 공개 주소에서만 진행한다.** 로컬 Windows DB는 이전 시점의 원본으로 보존했으며 클라우드와 동기화되지 않는다. 로컬에서 실제 경기를 계속 입력하면 기록이 두 곳으로 갈라진다.

## 백업과 복구

공개 접속 상태를 빠르게 확인하려면 PowerShell 7에서 `./scripts/Check-Production.ps1`을 실행한다. HTTPS 홈·웹 readiness·익명 선수/경기 접근 차단·비공개 actuator·PWA 파일·홈에서 참조한 JS/CSS를 GET으로만 확인하고 `work/production-check-latest.json`에 시각·상태 코드·응답 시간을 기록한다. 비밀번호·쿠키·회원 자료는 사용하거나 저장하지 않는다. 실패한 검사가 있으면 종료 코드 1을 반환한다. 로그인 이후 업무 흐름·실제 DB 백업·모바일 실기기 검증을 대신하지 않는다.

이전 전 백업은 평문 SQL 파일을 만들지 않고 메모리에서 Windows DPAPI(CurrentUser)로 암호화했다. 비공개 CLI 터널과 인증서 검증 TLS로 새 MySQL에 복구했고, 모든 테이블의 행 수와 SHA-256 지문을 대조했다. 선수 40명(활동 39명), 경기 2건, 기존 ID·소속·계정 해시·코드 해시·Flyway 이력을 보존했다. 기존 팀 코드와 비밀번호를 재발급하지 않았다.

암호화 파일·매니페스트는 Git에서 제외한 `backups/northflank/20261014-initial/`에 보관하며, 작업 포인터는 `work/northflank-migration-latest.json`에 있다. DPAPI 파일은 현재 Windows 사용자에 연결되므로 PC 교체용 독립 백업으로 간주하면 안 된다. 로컬 Docker 복구 시험은 엔진 시작 오류로 중단됐고, 이후 실제 클라우드 복구·대조를 통과했다.

**자동 백업 일정은 아직 설정하지 않았다.** 시범 기록 입력을 확대하기 전에 Northflank 백업 저장의 무료 적용 조건을 확인하고, 매일 백업·짧은 보관 기간과 별도 복구 시험을 구성한다. 최신 수동 암호화 백업은 2026-10-15 기능확장판 배포 직전 상태이며 그 이후 변경은 포함하지 않는다. 무료 여부가 불명확한 백업 저장소나 유료 옵션은 만들지 않았다.

### 배포·인프라 개선 검토 (2026-10-15 제안)

현재는 한 팀의 시범 사용 단계다. Northflank는 공식 문서에서 Developer Sandbox를 취미·시험용으로 설명하고 운영 애플리케이션에는 사용하지 않도록 안내한다. 현재 배포를 장기 무료 운영 보장으로 해석하지 않는다. 정식 사용 확대 전에 유료 운영 구성 또는 직접 관리할 VM을 비교한다. [공식 Sandbox 안내](https://northflank.com/docs/v1/application/billing/pricing-on-northflank)

| 후보 | 지금 얻는 이점 | 전환 전 확인할 점 |
| --- | --- | --- |
| 현재 Northflank Sandbox 유지 | 이미 검증한 배포·관리형 DB·HTTPS로 한 팀 시범 사용 지속 | 무료 자원 제약, 운영용으로 권장되지 않는 플랜, 자동 백업 비용 미확정 |
| Northflank 유료 자원 | 기존 컨테이너·비공개 네트워크·DB 연결 구조를 유지하며 자원 조절 | 서비스 2개+DB+저장소+백업+전송을 합친 실제 견적, 한국 접속 지연, 리전별 제공 조건 |
| Oracle Always Free VM | 자원 확보와 호환 검증이 되면 현재 Docker 구성을 옮길 후보 | 도쿄 용량 부족, ARM64 실행, 직접 OS/DB 관리, 유휴 무료 VM 회수 가능성과 외부 백업 |
| AWS Lightsail 서울 VM | 한국에서 가까운 위치의 VM과 단순한 인스턴스 요금, 서버 운영 학습 | Linux/IPv4 2GB 월 US$12 또는 4GB US$24; 세금·스냅샷·전송 초과 등 별도. API+DB 동거는 실제 부하 시험 필요하며 서버 한 대 장애에 함께 영향 |

Northflank 유료 총액은 아직 견적하지 않았다. Oracle 무료 VM은 사용량·가용성 조건을 확인해야 하며 유휴 자원이 회수될 수 있다. Lightsail 가격은 서버 번들만의 공식 표시 금액으로, 전체 운영비나 무중단 보장을 뜻하지 않는다. [Northflank 요금](https://northflank.com/pricing), [Oracle 무료 자원 조건](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm), [Lightsail 요금](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-bundles.html), [Lightsail 리전](https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-regions-and-availability-zones-in-amazon-lightsail.html)

Cloudflare는 우선 보조 역할로 검토한다. Workers Static Assets의 정적 파일 요청·저장은 무료이며 프론트 호스팅 후보지만, 현재 Caddy의 같은 출처 `/api` 프록시와 비공개 API 연결을 별도로 설계해야 한다. 정적 화면만 옮겨도 미국의 API·DB까지 왕복하는 지연은 남는다. 현재 Spring Boot JAR를 정적 호스팅으로 그대로 이전하는 작업은 아니다. [Static Assets 요금·제한](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)

Cloudflare R2 Standard는 월 10GB-month 저장과 정해진 요청 수의 무료 구간이 있어 독립 암호화 백업 후보가 된다. 보관 수·압축 덤프 크기·요청·원본 호스팅의 외부 전송 비용을 합산해야 하고, 무료 한도 초과 시 자동으로 막히는 지출 상한으로 간주하면 안 된다. 비공개 버킷·최소 권한·PC 교체 후에도 복구할 수 있는 별도 키 보관이 전제다. 아직 버킷·결제 연결·백업 업로드는 하지 않았다. [R2 요금](https://developers.cloudflare.com/r2/pricing/)

우선 보강할 것은 다음 세 가지다.

1. **백업의 자동화와 복원**: 하루 1회·최근 7일 보관을 초기 제안으로 하고, 배포 직전과 중요한 경기 기록 완료 후에도 백업한다. 플랫폼 장애에 대비한 별도 제공자/매체의 암호화 사본을 마련하고 월 1회 가상·격리 DB에 복원한다. Northflank는 다운로드 가능한 native dump와 예약·보관 기간 기능을 제공하지만 이 계정의 무료 비용은 아직 확인하지 않았다. 목표 초안은 최대 하루의 데이터 손실 범위(RPO 24시간)와 2시간 내 복구(RTO 2시간)이며 실제 달성·보장 수치가 아니다. [Northflank 백업 기능](https://northflank.com/docs/v1/application/databases-and-persistence/backup-restore-and-import-data)
2. **재현 가능한 배포와 복구**: 기존 GitHub CI를 유지하고, 검증한 커밋/이미지 digest 지정 → 백업 확인 → API readiness → 호환되는 웹 배포 → 공개 점검을 수동 실행 가능한 릴리스 작업으로 묶는다. 동시 배포를 막고 이전 정상 이미지와 설정을 기록한다. 자동 DB 다운그레이드는 하지 않으며, 이전 앱과 함께 동작하는 확장형 마이그레이션을 우선한다. 무료 자원에서 무중단·블루그린 배포가 가능한지는 별도 확인한다.
3. **실사용 측정과 장애 발견**: 한국 휴대전화 네트워크의 목록/저장 응답 시간과 오류율, API CPU·메모리·DB 연결 대기, 자동 편성 소요 시간을 구분해 본다. 먼저 가상 DB에서 10명·30명 수준의 조회와 소수 운영진 저장을 시험한다. 상시 상태 확인은 PC가 꺼져도 실행되는 환경을 검토하고 사용자 자료·세션을 로그에 남기지 않는다. 밤사이 Codex 점검 예약은 임시 점검이며 상시 관제 구축 완료가 아니다.

현재 세션과 접속 제한 상태는 API 메모리에 있어 재배포 시 재로그인이 필요하다. 여러 인스턴스로 늘리기 전에 세션·접속 제한의 공유 방식을 결정해야 한다. 우선 한 인스턴스에서 가용 메모리·쿼리·연결 풀을 측정하고, 데이터에 근거해 자원을 조정한다. Oracle 이전은 별도 환경의 ARM 실행·DB 복원·권한 검증·한국 접속 비교와 되돌리기 계획을 통과한 뒤 결정한다. 이 검토에서 운영 자원·비용·실제 데이터는 변경하지 않았다.

복구가 필요하면 입력을 먼저 중단하고 현재 클라우드 DB도 백업한다. 빈 별도 대상에 복구해 행·권한·API를 비교한 뒤 연결을 전환한다. 현재 운영 DB에 예전 파일을 바로 덮어쓰지 않는다.

## 검증·실제 자료 이전 순서

2026-10-14 로컬 Docker에서 실제 회원 DB와 분리한 임시 MySQL과 가상 선수 13명으로 검사했다. API 0.2 CPU / 512MiB, MySQL 512MiB 제한에서 기동·로그인·팀 세션·선수 조회·자동 편성을 통과했다. 전체 초기 기동은 약 102초, 자동 편성은 약 6.3초였고 최적해를 반환했다. API 메모리는 마지막 측정에서 약 338MiB였다. MySQL은 약 505MiB로 제한에 가까워 실제 관리형 DB의 메모리와 동시 사용 상태를 추가 확인해야 한다.

엑셀 양식 다운로드와 빈 양식 업로드의 검증 오류(400)를 확인했다. 실제 데이터가 든 엑셀의 전체 등록 성공이나 동시 사용자 부하까지 검증한 결과는 아니다. 임시 컨테이너·네트워크는 제거했고 로컬 원본 DB는 변경하지 않았다. 새 `web-northflank` Docker 이미지 빌드도 통과했다. 이번 설정 작업에서 전체 Java·프론트·MySQL 통합 테스트를 다시 실행하지 않았으며 이전 실행 결과는 [검증 기록](verification.md)을 따른다.

검증한 API 메모리 설정은 다음과 같다. 실제 클라우드에서는 secure 쿠키를 사용한다.

```dotenv
JAVA_TOOL_OPTIONS="-Xmx224m -XX:+UseSerialGC -XX:ActiveProcessorCount=1 -XX:ReservedCodeCacheSize=48m -Xss512k"
SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE=3
SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE=1
SERVER_TOMCAT_THREADS_MAX=16
SERVER_TOMCAT_THREADS_MIN_SPARE=2
SESSION_COOKIE_SECURE=true
```

1. 별도 가상 DB로 무료 메모리·CPU 수준의 기동, 로그인·권한, 자동 편성, 엑셀 처리를 확인한다.
2. 실제 Northflank 환경에서 이미지 기동과 TLS DB 연결, 공개 HTTPS의 세션·CSRF·전달 헤더 처리를 확인한다. 한 API 인스턴스만 운영하며 재배포 후에는 재로그인이 필요하다.
3. 실제 로컬 DB를 비공개 백업하고 별도 복구 검증을 마친다. 회원 DB를 이미지나 Git에 넣지 않는다. 선수·경기·계정 ID, 팀 소속, Flyway 버전과 행 수를 보존한다.
4. 이관 시 입력을 잠시 중단하고 최종 백업을 대상 DB에 복구한다. 로컬 원본은 유지한다. 실제 기록 대조 후 아이폰 접속과 홈 화면 설치를 확인한다.
5. 백업 보관·복구 방법과 무료 자원 상태를 기록한 뒤 소수 팀원과 시범 사용한다. 카드 등록이나 DB 생성만으로 앱 배포 완료라고 보고하지 않는다.

## Oracle로 옮길 때

Oracle 확보 시 바로 접속 주소를 바꾸지 않는다. ARM64 이미지·OR-Tools 실행, MySQL 복구, 로그인·권한·엑셀·경기 기록을 먼저 대조한다. 전환 시 쓰기를 잠시 멈추고 최종 DB를 옮겨 두 서버에 기록이 갈라지지 않게 한다. 복구 가능한 기존 서비스를 유지한 채 HTTPS 접속과 실기기를 확인한다. 자세한 VM 구성은 [Oracle 배포 안내](oracle-cloudflare-deployment.md)를 따른다.

### 밤사이 백업 운영 검토 (2026-10-15, 설정 변경 없음)

- 00:38 배포 전 백업의 암호화 파일 존재와 매니페스트를 확인했다. 매니페스트에는 15개 테이블 격리 복원 성공, TLS 호스트 검증, 평문 SQL 파일 미생성이 기록돼 있다. 이번 점검에서 새 덤프·복원은 실행하지 않았으며 이후 운영 변경은 이 백업에 포함되지 않는다.
- Northflank의 예약 native dump는 다운로드가 가능하고 snapshot은 다운로드가 불가능하다. 외부 제공자에 복구 가능한 사본을 보관하려면 native dump가 필요하다. 복원·import는 기존 사용자 DB를 제거할 수 있으므로 운영 addon의 Restore를 시험용으로 누르지 않는다. [공식 백업·복원 동작](https://northflank.com/docs/v1/application/databases-and-persistence/backup-restore-and-import-data)
- Sandbox의 native 백업 저장·실행 비용은 실제 계정에서 확인하지 못했다. 무료 cron 2개가 제공된다는 사실만으로 백업 전체가 무료라고 판단하지 않는다. [무료 플랜 범위](https://northflank.com/docs/v1/application/billing/pricing-on-northflank)
- **비용 계산 예시(실측 아님)**: 100MB 암호화 압축본을 하루 1개/7일 보관하면 약 0.7GB 보관, 월 30회 반출은 약 3GB다. R2 Standard의 월 10GB-month·Class A 100만·Class B 1천만 무료 구간 안인지 계정 전체 사용량으로 판단한다. 원본 Northflank의 공개 egress 단가 $0.06/GB를 단순 적용하면 전송 약 $0.18/월이며 실제 무료 할당·실행비·세금은 별도 확인한다. [R2 요금](https://developers.cloudflare.com/r2/pricing/), [Northflank 요금](https://northflank.com/pricing)
- 현재 DPAPI 파일을 R2에 복사하는 것만으로 다른 PC에서의 복구가 해결되지는 않는다. 별도 키 보관과 독립 환경에서의 해독·복원 절차가 필요하다. 권장 초안은 native dump → 압축·암호화 → 별도 비공개 저장소 → 보관 기간 정리 → 복원 시험이다. 덤프 생성 성공, 원격 저장 성공, 최신 성공 시각, 복원 성공을 따로 확인한다.
- 계정별 백업 과금 조건 확인 → 가상 자료의 암호화·해독 및 격리 복원 → 사용자와 보관/키 관리 방식 확정 → 자동화 활성화 순서로 진행한다. 이번에는 일정·버킷·권한·토큰을 만들거나 실제 백업을 업로드하지 않았다. RPO 24시간/RTO 2시간은 여전히 미달성 목표 초안이다.


### 2026-10-17 22:50 KST 선수 입력 개선 배포
웹 db2391d·가이드1.5 운영 반영. API d8b2763·DB V30 유지. [기능·검증·배포 결과](bulk-input-mobile-2026-10-17.md). 수동 1행 시작·모바일 축소·가입일 달력·엑셀 행 추가 제거·선수 기록 기본10명·04 실제 출전자 표시. 로컬 프론트263개, 공개 HTTPS9개, JS/CSS/PDF 일치 확인. 실제 iPhone·운영 저장 시험은 미실행.


### 2026-10-17 23:06 KST 선수단 표 개선 배포
웹 bdb4f04·가이드1.6 운영 반영. API d8b2763·DB V30 유지. [기능·검증·배포 결과](compact-roster-table-2026-10-17.md). 표 최소 폭540px·모바일 행 약50px, 직책/생년/지망 열 통합, 수동 여러 명 입력 등번호·생년 선택 전용. 프론트263개·타입·빌드·320/390/1280px UI·PDF24쪽 확인. 공개 HTTPS9개·JS/CSS/PDF 일치 확인. 실제 iPhone·운영 저장·로컬 MySQL 시험은 미실행.


## 2026-10-19 경기 입력·작전판 개선

[변경·검증·배포 기록](match-entry-and-tap-swap-2026-10-19.md). 경기 작성 중 대회 등록, 외부 경기 전·후반 선택, 02 작전판 두 번 눌러 자리 교환을 구현했다. 프론트 264개·타입·빌드·가상 UI·가이드 PDF 24쪽 확인. 운영 반영 확인: 2026-10-19 09:26 KST, 웹 `46ab4ce`, Northflank `fuzzy-finger-6520`. 공개 HTTPS9개·JS/CSS/PDF일치. API d8b2763·DB V30 유지.


## 2026-10-19 경기 입력 통합 배포

2026-10-19 10:54 KST · 웹 `a229bbbb6ff99b5c9273f7fb00d7e8dfd0b00603` · Northflank `windy-sunlight-8772` 완료. [기능·검증·가이드 상세](unified-match-entry-2026-10-19.md). 270개 프론트 테스트·타입·빌드·GitHub CI, PDF24쪽·역할별 가이드, 공개HTTPS9개·JS/CSS/PDF4개 일치. API d8b2763·DB V30 유지. 실제 iPhone·운영 쓰기·로컬 MySQL 미실행.

## 2026-10-19 골별 기록·모바일 입력 배포

2026-10-19 17:51 KST · API·웹 `dd29444bf2cea3c4d46126cf4b95976722ec57ed`, DB V31, 가이드 1.9 운영 반영. [기능·검증 결과](goal-events-mobile-2026-10-19.md). GitHub CI 백엔드·MySQL 통합/프론트 통과, 암호화 백업 격리 복원, 기존 17개 업무 테이블 지문 보존, HTTPS 9개·운영진 읽기/권한·JS/CSS/PDF 바이트 일치를 확인했다. 실제 iPhone·운영 자료 쓰기 시험은 하지 않았다.

이번 설정에서는 `disabledCI=true`여도 수동 빌드가 성공하자 Northflank가 새 이미지를 자동 적용했다. 다음 릴리스에서 빌드와 배포를 분리하려면 `disabledCD`와 실제 서비스 동작을 먼저 점검해야 한다. V31 적용 후 새 골별 기록을 이전 API로 처리하면 연결 정보가 손실될 수 있으므로 API 단독 다운그레이드는 하지 않는다. 배포 직전 암호화 백업은 Git 제외 `backups/northflank/20261019-before-goal-events/`에 보관하고 별도 MySQL 복원·행 지문 확인을 마쳤다. 이 백업은 Windows DPAPI 사용자에 묶여 있어 독립 PC 복구 수단은 아직 아니다.
