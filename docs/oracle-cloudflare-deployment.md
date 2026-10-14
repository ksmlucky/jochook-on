# Oracle VM + Cloudflare Tunnel 배포

이 문서는 조축ON의 **배포 준비 구성**이다. Oracle 자원 생성, 실제 도메인 연결, 터널 연결 및 회원 공개가 완료됐다는 뜻은 아니다. 계정 가입·본인/결제수단 인증은 사용자가 직접 진행한다. 아래 명령은 새 Linux 서버용이며 현재 Windows 개발 서버와 실제 DB를 바꾸는 명령이 아니다.

2026-10-14 22시 진행 상태: 사용자 로그인 후 Oracle 콘솔에서 **Free Tier 계정과 도쿄 홈 리전**을 확인했다. 승인받은 A1 2 OCPU / 6GB / 50GB 서버 생성과, CPU를 1 OCPU로 줄인 한 차례 재시도가 모두 **`Out of capacity ... VM.Standard.A1.Flex ... AD-1`**으로 실패했다. 화면에서 선택 가능한 AD는 AD-1 하나였고 fault domain은 자동 선택이었다. 실패 후 해당 root compartment의 인스턴스·VCN·부트 볼륨 목록이 비어 있음을 확인했다. 실제 서버·공인 IP·Cloudflare 터널·회원 DB 이전은 완료하지 않았다. 현재 다음 작업과 담당은 [로드맵 맨 위](roadmap.md#지금-할-일--여기부터-보기-2026-10-14)를 따른다.

다음 시도 전 기존 자원 유무를 다시 확인한다. 전용 SSH 키는 로컬 `.local/oracle/jochook-on-prod`와 `.pub`에 준비했고 Git/Docker 컨텍스트에서 제외한다. 개인키 원문은 문서·채팅에 기록하지 않는다. 생성 화면의 저장소 예상 비용은 월 US$2.93으로 표시됐지만, 홈 리전의 부트·블록 저장소 합계 200GB 무료 조건과 생성 전 빈 저장소 목록을 별도로 확인했다. 예상 비용 표시는 실제 무료 적용 여부의 증명이 아니므로 생성에 성공하면 자원의 Always Free 적용도 다시 확인한다. 유료 계정 전환·도메인 구매는 수행하지 않았다.

**리전 변경 제약:** 홈 리전은 계정 생성 뒤 변경할 수 없고, Always Free Compute는 홈 리전에만 만들 수 있다. 다른 리전 구독은 홈 리전 변경과 다르며 무료 A1 용량을 옮기는 방법이 아니다. 현재 용량 부족은 Oracle 자원 가용성 문제이므로 PC 재부팅·Docker 재설치로 해결되지 않는다. 무료 조건을 유지할 때의 다음 단계는 나중에 도쿄 생성을 재시도하는 것이다. [리전 공식 안내](https://docs.oracle.com/en-us/iaas/Content/Identity/regions/managingregions.htm), [무료 용량 부족 공식 FAQ](https://www.oracle.com/cloud/free/faq/).

**정기 확인 등록:** 사용자 요청으로 이 대화에 6시간마다 Oracle 무료 서버를 확인하는 예약을 등록했다. 로컬 예약이므로 PC와 Codex 앱이 켜져 있어야 한다. 먼저 기존 인스턴스·생성 요청을 확인하고, 필요한 경우 승인된 무료 구성의 생성 요청을 한 번만 시도한다. 실행 시점에 로그인이나 추가 승인이 필요하면 사용자에게 알린다. 용량 부족이 그대로면 반복 알림하지 않으며, 서버 확보·의미 있는 변화·새로운 실패·사용자 조치가 필요할 때 알린다. 확보 후에는 중복 생성을 중단한다. 예약 등록은 실제 용량 확보나 무인 생성 성공을 보장하지 않는다. [Codex 예약 실행 안내](https://learn.chatgpt.com/docs/automations?surface=app).

사용자가 다른 리전으로 진행해도 된다고 요청하여 실제 Region Management도 확인했다. 도쿄만 `Subscribed / Home Region`이고 추가 리전은 계정의 최대 리전 수 제한 경고가 표시됐다. 무료 조건을 유지하는 다른 리전으로의 전환은 불가능하여 변경하지 않았다. 유료 전환이나 다른 사업자의 유료 서버는 별도 비용 결정이 필요하다.

## Oracle 대기 중 무료 대안 (2026-10-14 검토)

현재 Java 21 / Spring Boot / React / MySQL 구성과 자동 편성의 OR-Tools, 엑셀 처리의 Apache POI를 기준으로 비교했다. 이후 사용자가 Northflank를 선택했고 2026-10-14 API·웹·무료 DB·실제 자료 이전·HTTPS 로그인 검증을 완료했다. [현재 서비스와 운영 안내](northflank-deployment.md)를 따른다. Oracle 이전은 별도 검증 후 결정하며 아래 표는 선택 당시 후보 비교다.

| 후보 | 확인한 무료 조건 | 조축ON에 적용할 때 |
| --- | --- | --- |
| Northflank Sandbox — 우선 시험 후보 | 서비스 2개·DB 1개·작업 2개, 유휴 시 자동 수면 없음 | React/Caddy + Java API + MySQL을 한 곳에서 구성할 수 있다. 무료 CPU·메모리·디스크의 실제 할당은 계정 콘솔에서 확인해야 한다. |
| Render + Aiven MySQL — 차선 후보 | Render 무료 웹 서비스는 15분 미사용 시 수면, 재기동 약 1분. Aiven 무료 MySQL은 1 CPU·RAM 1GB·디스크 1GB | 화면과 API를 같은 주소로 묶는 배포 설정과 외부 MySQL TLS 연결이 필요하다. Render의 작은 메모리에서 자동 편성·엑셀 처리를 검증해야 한다. |
| Google Cloud Run + Aiven MySQL | Cloud Run 요청 기반 요금은 매월 요청 200만 건 및 CPU·메모리 무료 사용량 제공 | 사용량·전송량 등 한도 초과 시 비용이 발생할 수 있어 비용 0원이 우선인 현재에는 후순위다. 재기동·확장에 따른 로그인 세션 처리도 점검해야 한다. |

근거: [Northflank Sandbox](https://northflank.com/pricing), [MySQL 지원 버전](https://northflank.com/docs/v1/application/databases-and-persistence/deploy-databases-on-northflank/deploy-mysql-on-northflank), [Render 무료 제한](https://render.com/docs/free), [Aiven MySQL 무료 구성](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier), [Cloud Run 요금](https://cloud.google.com/run/pricing).

Northflank도 공식적으로 무료 구성을 취미·시험용으로 안내하고 실제 운영 환경에는 권장하지 않는다. 따라서 초기 시험 후보로 추천하며 장기 운영 안정성이나 현재 앱의 메모리 적합성을 확정한 것이 아니다. 무료 계정에서 실제 자원·스토리지·예상 비용을 확인한 뒤 가상 데이터로 기동, 로그인, 자동 편성, 엑셀 업로드와 DB 백업·복구를 검증한다. 적합할 때 실제 자료 이전과 소수 팀원 시범 사용으로 넘어간다. [무료 용도 안내](https://northflank.com/docs/v1/application/billing/pricing-on-northflank).

Northflank에서는 제공되는 `code.run` HTTPS 주소로 먼저 접속할 수 있으므로 도메인 구매 없이 휴대전화 시험이 가능하다. 화면과 `/api`를 같은 주소로 제공하는 현재 구성을 유지한다. Cloudflare 계정은 이후 도메인 연결 등에 활용할 수 있다. 아래 Oracle VM·Tunnel 절차는 Oracle을 선택할 때 적용하며, 다른 사업자 배포에 그대로 적용하지 않는다.

## 구성과 비용 확인

```text
아이폰/PC ─ HTTPS ─ Cloudflare 도메인
                     │ 기존 outbound Tunnel 연결
              cloudflared → web:80 (Caddy)
                              ├─ React
                              └─ /api/* → api:8080 → mysql:3306
```

화면과 API를 같은 HTTPS 주소로 제공한다. VM에서 80/443/8080/3306을 외부에 열지 않고, cloudflared가 바깥으로 연결한다. 웹의 외부 HTTPS는 Cloudflare가 처리하고 Docker 내부 web:80은 평문 HTTP다. 세션 쿠키는 Secure를 강제한다. 팀 코드 및 운영진 로그인 등 앱의 접근 권한은 그대로 적용한다.

2026-10-14 공식 안내 기준 추천 시작 사양은 **VM.Standard.A1.Flex, 2 OCPU / RAM 6GB / 부트 볼륨 50GB, Always Free eligible Ubuntu ARM64**다. A1 무료 총량은 월 1,500 OCPU시간·9,000 GB시간(2 OCPU·12GB 상당), 부트+블록 저장소 합계 200GB, outbound 전송 월 10TB다. 다른 VM·볼륨 사용량까지 합산한다. 홈 리전에서 해당 자원을 확보해야 하며 용량 부족과 유휴 VM 회수 가능성이 있다. 생성 직전에 계정 콘솔의 무료 대상 표시·예상 비용을 확인한다. [Oracle Always Free 공식 조건](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).

Cloudflare 계정과 Cloudflare DNS에서 관리하는 도메인이 필요하다. 도메인 구매·갱신 비용은 서버 무료 범위와 별도이며 구매 전에 금액을 확인한다. Cloudflare의 선택 플랜·추가 기능도 실제 콘솔에서 무료 여부를 확인한다. 도메인 없는 임시 Quick Tunnel로 실제 회원 DB를 공개하지 않는다. [Tunnel 시작 안내](https://developers.cloudflare.com/tunnel/get-started/).

API/MySQL은 각각 2GB, web/cloudflared는 각각 256MB 상한을 둔다. 남은 메모리는 OS·Docker용이다. 이는 시작값이며 대량 엑셀·자동 편성 부하를 확인한 뒤 조정한다. A1은 ARM이므로 아래 배포 인수에서 **ARM64 이미지 실행과 OR-Tools 자동 편성**까지 확인해야 한다. AMD64 PC 검증만으로 ARM 실행 성공을 판단하지 않는다.

## 1. 서버와 네트워크 준비

1. 사용자가 Oracle/Cloudflare 계정을 생성한다. Oracle 홈 리전과 Always Free 자원 가용성을 확인하고 위 사양 VM을 만든다. Ubuntu ARM64 이미지를 사용하며 ARM64용 Docker Engine 및 Compose 플러그인을 공식 설치 절차로 설치한다. Compose는 `!reset`을 지원하는 최신 안정 버전(최소 2.24.4)을 사용한다. [Ubuntu Docker 설치](https://docs.docker.com/engine/install/ubuntu/).
2. SSH 22는 운영자 IP로 제한하거나 OCI Bastion 등 별도 관리 경로를 쓴다. 인터넷에서 들어오는 앱 포트는 열지 않는다. VM이 외부로 나갈 경로(공용 서브넷의 인터넷 게이트웨이 등)는 필요하다. 유료 NAT/LB를 무심코 추가하지 않는다.
3. cloudflared의 **outbound TCP/UDP 7844**, DNS, 이미지·패키지 다운로드용 HTTPS를 허용한다. OCI 보안 목록/NSG와 OS 방화벽을 함께 확인한다. [Cloudflare 방화벽 조건](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/tunnel-with-firewall/).
4. 저장소를 clone한다. 비공개 저장소에는 사용자 본인의 접근 수단을 쓰고 SSH 키·Git 토큰을 프로젝트 파일에 저장하지 않는다. 이후 명령은 프로젝트 루트에서 실행한다.

## 2. 환경 파일과 볼륨

```bash
umask 077
cp .env.oracle.example .env.oracle
chmod 600 .env.oracle
mkdir -p .local backups
chmod 700 .local backups
# 안전한 편집기로 .env.oracle의 도메인과 서로 다른 비밀번호를 입력한다.
# 비밀번호 생성 예: openssl rand -hex 24
```

도메인은 `app.example.com`처럼 프로토콜·경로 없는 실제 호스트명으로 지정한다. `.env.oracle`은 Git 제외 파일이다. 비밀번호·토큰 원문을 채팅·명령 인수·공개 로그에 붙이지 않는다.

`.env.oracle.example`의 `jochook-on-oracle_*` 볼륨은 **새 서버의 빈 DB용**이다. 기존 Docker 서버에 적용한다면 현재 실제 볼륨 이름을 먼저 대조하고 그 이름을 유지한다. `compose.cloudflare.yaml`은 베이스의 볼륨 정의를 바꾸지 않는다. 프로젝트 이름만 바꿔도 베이스의 명시적 볼륨 이름은 자동 변경되지 않는다. 운영 DB를 지우는 `down --volumes`는 사용하지 않는다.

최초 빈 DB는 초기 관리자와 HANA FC 팀을 만든다. 기존 자료를 이전할 때는 별도 암호화 백업 → 격리 복구 검증 → 대상 DB 복구 → 앱 기동 → 행 수·ID·팀 소속 대조 순서를 따른다. 초기 관리자 환경변수는 기존 계정의 비밀번호를 재설정하지 않는다. `JOCHOOK_ON_SERVICE_ADMIN_USERNAME`에는 복구한 실제 활성 계정 ID를 정확히 넣는다. 구체적인 데이터 이전과 백업은 [기존 배포 안내](deployment.md)를 따른다.

## 3. Cloudflare의 정식 터널 준비

1. 소유한 도메인을 Cloudflare에 등록하고 DNS 활성화를 확인한다. 도메인의 HTTPS 인증서 활성화와 **Always Use HTTPS**를 설정한다.
2. Cloudflare 관리 화면에서 remotely-managed Cloudflare Tunnel을 만든다. 연결 프로그램은 cloudflared를 선택한다. 이 저장소는 공식 이미지 **`cloudflare/cloudflared:2026.10.0`**으로 고정한다. 버전은 [공식 릴리스](https://github.com/cloudflare/cloudflared/releases/tag/2026.10.0) 기준이며 `latest` 자동 갱신을 사용하지 않는다.
3. 해당 터널의 published application route에 `.env.oracle`과 동일한 호스트명을 지정하고 서비스 종류 **HTTP**, 주소 **`web:80`**으로 설정한다. 직접 VM IP를 가리키는 A/AAAA 레코드와 혼용하지 않는다. API와 화면을 별도 호스트로 나누지 않는다.
4. 터널 토큰만 `.local/cloudflared-token` 파일에 저장한다. 설치 명령 전체를 저장하지 않는다. 안전한 편집기로 넣고 다음 권한을 적용한다.

```bash
sudo chown 65532:65532 .local/cloudflared-token
sudo chmod 400 .local/cloudflared-token
```

토큰은 Docker Compose secret으로 read-only 마운트된다. 환경변수나 컨테이너 명령 인수에는 원문을 넣지 않는다. 파일 소유권은 cloudflared 실행 UID 65532에 맞춘다. 일반 Compose의 파일 secret은 호스트 파일 권한을 따르므로 `uid/mode` 선언만 믿지 않고 실제 파일 권한을 적용한다. 공식 `--token-file`/`TUNNEL_TOKEN_FILE`은 2025.4.0 이상에서 지원한다. [실행 옵션](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/run-parameters/).

Cloudflare Cache Rule을 만들고 `(http.host eq "실제호스트") and (http.request.uri.path eq "/api" or starts_with(http.request.uri.path, "/api/"))`에 **Bypass cache**를 적용한다. 이를 뒤에서 덮어쓰는 Cache Everything 규칙을 두지 않는다. Caddy도 API에 `Cache-Control: no-store`를 설정한다. 회원별 데이터와 인증 응답이 다른 사람에게 캐시로 전달되지 않아야 한다. [Cache Rule 공식 설정](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/).

## 4. 먼저 터널 없이 앱 준비

아래 `dc`는 두 Compose 파일을 항상 함께 쓰는 현재 셸용 함수다. 실제 환경 파일을 출력하지 않도록 `config --quiet`를 사용한다.

```bash
dc() { docker compose --env-file .env.oracle -f compose.production.yaml -f compose.cloudflare.yaml "$@"; }
dc config --quiet
dc --profile tunnel config --quiet
# 빌드 메모리 피크를 줄이기 위해 두 target을 순서대로 빌드한다.
dc build api
dc build web
dc pull mysql
dc --profile tunnel pull cloudflared
dc up -d --wait mysql api web
dc ps
dc exec -T web caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
dc exec -T api curl --fail --silent http://127.0.0.1:8080/actuator/health
```

`cloudflared`는 `tunnel` 프로필에 있어 이 단계에서는 연결하지 않는다. web의 healthcheck는 컨테이너 loopback에서만 통과한다. 외부 `/actuator*`, `/health`, `/internal-health*`는 404이며 API도 직접 노출하지 않는다. 운영 자료를 이전한다면 공개 전에 앞 절의 복구·대조를 마친다.

## 5. 연결과 인수 확인

도메인·무료 자원·데이터 복구·권한·캐시 규칙 확인을 마친 다음 실행한다.

```bash
dc --profile tunnel up -d cloudflared
dc --profile tunnel ps
dc --profile tunnel logs --tail=50 cloudflared
```

로그와 Cloudflare 화면에서 연결 상태를 확인하고 아이폰 Safari에서 `https://실제호스트`로 접속한다. 연결 실패 시 토큰 원문을 로그나 채팅에 출력하지 않는다.

- 운영진 로그인 → 소속 팀 선택 → 선수/경기 조회·저장 → 엑셀 → 자동 편성을 확인한다. 초기 점검 데이터는 별도 가상 팀에서 만든다.
- 별도 브라우저의 팀 코드 조회가 읽기 전용인지, 코드 재발급 후 기존 조회 세션이 거부되는지 확인한다.
- API 응답은 `Cache-Control: no-store`, Cloudflare 캐시는 HIT가 아닌지 확인한다. 세션 쿠키는 Secure/HttpOnly이고 HTTP 접속은 HTTPS로 이동해야 한다.
- 회원 요청의 실제 IP가 API로 전달되어 서로 다른 회원이 같은 프록시 주소로 실패 제한을 공유하지 않는지 확인한다. 프록시는 cloudflared의 전용 IP만 신뢰하고 위조 `Forwarded`/`X-Forwarded-*`를 정제한다.
- 외부 health 경로 404와 VM 앱 포트 비공개 상태를 확인한다. ARM VM에서 자동 편성의 native OR-Tools 실행을 반드시 확인한다.
- 실제 자료를 이전했다면 백업 복구 결과와 기존 선수·경기의 건수/ID/관계를 다시 대조한다. 서버 재시작 후 DB가 유지되는지 확인한다.

전용 Docker 서브넷은 `172.30.72.0/28`, cloudflared는 `.2`, web은 `.3`이다. 호스트 네트워크와 충돌하면 `.env.oracle`의 세 값을 함께 변경한다. Caddy는 `private_ranges` 전체 대신 정확한 connector IP만 신뢰한다. API는 `SERVER_FORWARD_HEADERS_STRATEGY=framework`를 유지하므로 Caddy 외의 경로로 공개하지 않는다. [Caddy 신뢰 프록시](https://caddyserver.com/docs/caddyfile/options#trusted-proxies).

## 운영

업데이트 전 비공개 DB 백업과 복구 확인 후 코드를 갱신하고 위 순서대로 이미지를 빌드·기동한다. 백업 명령에도 `dc` 함수를 사용하여 Oracle 대상만 지정한다. 저장 위치는 `backups/` 등 Git 제외 영역이며 서버 외부에도 암호화해 보관한다. 로그인 세션은 API 메모리에 있으므로 재시작 후 다시 로그인해야 한다.

터널만 임시 차단할 때는 `dc --profile tunnel stop cloudflared`를 사용한다. 토큰 유출 시 Cloudflare에서 토큰을 교체하고 파일을 갱신한 뒤 cloudflared를 재생성한다. 앱의 회원 조회 코드는 이 인프라 토큰과 별개다.

## 2026-10-14 로컬 검증 결과

- 합성 환경변수로 두 Compose 파일을 병합했다. 네 서비스의 host port가 모두 없고, Secure 쿠키 강제·토큰 파일 전달·Oracle 전용 볼륨 3개를 확인했다. Oracle 볼륨 변수를 빼면 기존 운영 볼륨 이름 3개를 그대로 유지하는 것도 확인했다. 기본 프로필에서는 cloudflared가 시작 대상에 포함되지 않는다.
- 공식 `cloudflare/cloudflared:2026.10.0`을 내려받아 네트워크 없는 컨테이너의 `--help`로 `--token-file`/`TUNNEL_TOKEN_FILE`을 확인했다. 이미지 manifest에 `linux/amd64`, `linux/arm64`가 있음을 확인했다. 실제 터널은 연결하지 않았다.
- Caddy 설정 검증을 통과했다. 외부 통신·호스트 공개 포트가 없는 일회용 내부 Docker 네트워크에서 가상 API로 **13개 프록시 검사**를 통과했다. 정적 화면/API 전달, 실제 IPv4/IPv6 보존, 위조 전달 헤더 정제, 신뢰하지 않은 connector와 잘못된 호스트 차단, API 캐시 금지, 외부 health 404와 내부 health를 확인했다. 해당 QA 컨테이너 2개와 네트워크는 정리했다.
- 앱 코드를 바꾸지 않았으므로 Java/프론트 단위 테스트와 MySQL 통합 테스트는 이번 배포 설정 작업에서 재실행하지 않았다. Oracle VM 생성, ARM64 앱/OR-Tools 실행, 실제 DNS/TLS/터널 연결, 실제 DB 이전과 아이폰 실접속은 아직 수행하지 않았다.

통합 상태는 [검증 기록](verification.md)에 따로 남긴다. 위의 로컬 설정 검증을 실제 클라우드 배포 성공으로 간주하지 않는다.
