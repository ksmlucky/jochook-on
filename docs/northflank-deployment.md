# Northflank 무료 시범 배포

2026-10-14 사용자 요청으로 Oracle 용량 대기와 별개로 Northflank Developer Sandbox 배포를 시작했다. 이 문서는 진행 중인 설정이며 회원용 공개 배포 완료를 의미하지 않는다. Oracle 6시간 정기 확인은 유지한다. Oracle 서버를 확보하면 성능·운영 부담과 DB 복구를 검증한 뒤 이전 여부를 결정한다.

## 실제 계정에서 확인한 상태

- 사용자가 가입과 0달러 카드 인증을 완료했다. 카드 원문은 프로젝트에 보관하지 않는다.
- 무료 계정에서 선택 가능한 리전은 US - Central과 Europe - West였다. 아시아 리전은 유료 전환이 필요하여 US - Central을 선택했다.
- `jochook-on-mysql`은 Free 표시로 생성됐고 Running 상태를 확인했다. MySQL 8.4.11, 0.2 vCPU / 512MB, NVMe 6GB, 인스턴스 1개, TLS 사용, Private networking only 구성이다. 실제 데이터는 아직 이전하지 않았다.
- GitHub 앱의 기존 전체 저장소 접근을 `ksmlucky/jochook-on` 한 개로 줄이고 Northflank 연결 목록에서 확인했다.
- API 생성 화면에서 무료 `nf-compute-20` (0.2 shared CPU / 512MB), 인스턴스 1개를 선택했다. API와 화면 서비스는 아직 생성 전이며 입력 중인 폼은 배포 완료가 아니다. 다른 계정이나 향후 무료 한도가 같다고 가정하지 않는다. 업그레이드·유료 자원은 선택하지 않는다.

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
| `JOCHOOK_ON_SITE_HOST` | 발급받은 웹 호스트명, 프로토콜·경로 제외 |
| `JOCHOOK_ON_API_UPSTREAM` | 실제 API 비공개 DNS 이름과 포트 |
| `JOCHOOK_ON_TRUSTED_PROXY_CIDRS` | 배포 환경에서 확인한 ingress 프록시 주소 범위만 지정 |

Caddy는 전달 헤더를 정규화하고, 신뢰한 프록시에서 온 IP 목록만 오른쪽부터 판별한다. 임의의 `0.0.0.0/0`이나 `::/0`을 신뢰하지 않는다. 실제 ingress 경로와 위조 헤더 처리 검증이 끝나기 전 회원용 공개를 완료로 표시하지 않는다. `/actuator*`는 외부에 전달하지 않고 API 응답은 `no-store`로 처리한다.

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
