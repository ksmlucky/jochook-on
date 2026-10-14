# Northflank 무료 시범 배포

2026-10-14 Northflank Developer Sandbox에서 API·웹·MySQL 실행, 실제 DB 이전, 공개 HTTPS 로그인·조회 검증을 완료했다. **[조축ON 접속](https://http--jochook-on-web--wmjz5mzg84j4.code.run/)**. 아이폰 실기기 설치와 팀원 시범 사용은 다음 확인 단계다. Oracle 6시간 정기 확인은 유지하며, 서버 확보 후 성능·운영 부담과 DB 복구를 검증한 뒤 이전 여부를 결정한다.

## 실제 계정에서 확인한 상태

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

실제 JDBC 연결은 `sslMode=VERIFY_IDENTITY`로 인증서와 호스트명을 검증한다. Flyway는 19개 마이그레이션 검증 후 현재 버전 19를 확인했다. 최초 API 기동은 약 83초였다. 서비스 재배포 시 메모리 세션은 사라지므로 재로그인이 필요하다.

## 완료한 클라우드 검증과 다음 확인

- API 이미지 `9f580c4`, 웹 이미지 `a21ce3d` 빌드·배포 성공. 웹 빌드에서 `caddy validate` 실행도 성공했다. 두 커밋의 GitHub Actions가 success다. Northflank 자동 Git 빌드는 꺼 두었으므로 이후 코드 push만으로 운영 서버가 바뀌지 않는다. 테스트 후 서비스별 Build에서 검증할 커밋을 지정한다.
- HTTPS 홈 200, HTTP→HTTPS 전환, 익명 선수 조회 401, 외부 actuator 404, manifest·Service Worker 200을 확인했다.
- 기존 감독 계정 로그인 204, Secure·HttpOnly·SameSite=Lax 세션 쿠키, 활동 선수 39명·경기 2건·변경 이력 조회를 확인했다. CSRF 없는 빈 수정 요청은 403, 다른 팀 ID의 조회는 409로 차단됐다. 실제 경기·선수 수정이나 삭제는 시험하지 않았다.
- 브라우저에서 기존 계정 로그인·선수단·경기 목록·로그아웃을 확인했다. 폭 390px 설정에서 콘텐츠 폭 375px(스크롤바 제외)와 가로 넘침 없음, 모바일 경기 카드를 확인했다. 아이폰 Safari 실제 설치·standalone·카메라/파일 선택 및 다중 사용자 부하는 미확인이다.
- 현재 클라우드 DB의 복구 직후 화면 지표는 메모리 평균 약 244MB/최대 285MB, 저장 약 135MB/6GB였다. 장기 부하 검증 수치가 아니다.

**실제 입력은 공개 주소에서만 진행한다.** 로컬 Windows DB는 이전 시점의 원본으로 보존했으며 클라우드와 동기화되지 않는다. 로컬에서 실제 경기를 계속 입력하면 기록이 두 곳으로 갈라진다.

## 백업과 복구

이전 전 백업은 평문 SQL 파일을 만들지 않고 메모리에서 Windows DPAPI(CurrentUser)로 암호화했다. 비공개 CLI 터널과 인증서 검증 TLS로 새 MySQL에 복구했고, 모든 테이블의 행 수와 SHA-256 지문을 대조했다. 선수 40명(활동 39명), 경기 2건, 기존 ID·소속·계정 해시·코드 해시·Flyway 이력을 보존했다. 기존 팀 코드와 비밀번호를 재발급하지 않았다.

암호화 파일·매니페스트는 Git에서 제외한 `backups/northflank/20261014-initial/`에 보관하며, 작업 포인터는 `work/northflank-migration-latest.json`에 있다. DPAPI 파일은 현재 Windows 사용자에 연결되므로 PC 교체용 독립 백업으로 간주하면 안 된다. 로컬 Docker 복구 시험은 엔진 시작 오류로 중단됐고, 이후 실제 클라우드 복구·대조를 통과했다.

**자동 백업 일정은 아직 설정하지 않았다.** 시범 기록 입력을 확대하기 전에 Northflank 백업 저장의 무료 적용 조건을 확인하고, 매일 백업·짧은 보관 기간과 별도 복구 시험을 구성한다. 현재 암호화 백업은 최초 이전 시점만 보호하며 이후 클라우드 변경은 포함하지 않는다. 무료 여부가 불명확한 백업 저장소나 유료 옵션은 만들지 않았다.

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
