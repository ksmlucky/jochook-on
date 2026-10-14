# GitHub와 회원용 배포

소스 저장소와 회원이 접속할 서비스는 별개다. GitHub에는 코드와 설정 예시만 올린다. 실제 회원 명단, 경기 기록, 계정, DB 백업, 비밀번호는 GitHub에 올리지 않는다. 서버를 만들면 별도의 MySQL에 데이터를 이전해야 한다.

## 현재 상태와 순서

- 서비스명은 **조축ON**이며 기존 팀은 **HANA FC**다. 팀 생성·운영진 지정·초대·코드와 비밀번호 접속·팀별 데이터 분리·감독/코치 권한·경기 변경 이력을 구현했다. 현재 로컬 적용 상태와 검증은 [검증 기록](verification.md)을 따른다.
- 저장소 표준 주소는 [ksmlucky/jochook-on](https://github.com/ksmlucky/jochook-on)이다. 원격 이름 변경의 확인 결과는 [검증 기록](verification.md)을 따른다.
- 배포 이미지는 `Dockerfile`, 서버 실행 구성은 `compose.production.yaml`, HTTPS 입구는 `deploy/Caddyfile`에 있다.
- GitHub Actions는 테스트와 빌드만 한다. 서버 자동 배포는 연결하지 않았다.
- 최신 기능은 2026-10-14 Java 단위/API 207개·MySQL 통합 89개·프론트 41개 재검증과 GitHub 업로드·CI 확인을 마쳤다. 이후 Northflank 설정 검증은 전체 기능 재검증과 구분해 [전용 안내](northflank-deployment.md)에 기록한다.
- **[Northflank 시범 서비스](https://http--jochook-on-web--wmjz5mzg84j4.code.run/)**에 API·웹·MySQL 배포와 실제 자료 이전·공개 HTTPS 로그인·조회 검증을 완료했다. 기존 계정·코드 해시를 보존했으며 실제 입력은 공개 주소에서 진행한다. 로컬 DB와 동기화되지 않는다. 다음은 아이폰 실기기 설치와 무료 조건을 확인한 자동 백업 구성이다. 상세 결과는 [Northflank 안내](northflank-deployment.md)를 따른다. 유료 도메인은 구매하지 않았다.
- Oracle와 Cloudflare 가입도 완료했다. Oracle 도쿄 무료 VM은 용량 부족으로 생성되지 않아 6시간 정기 확인을 유지한다. Oracle 사용 시에는 [전용 안내](oracle-cloudflare-deployment.md)를 따른다. 아래 직접 HTTPS Compose 절차는 해당 서버 구성용 참고이며 Northflank에는 [Northflank 배포 안내](northflank-deployment.md)를 적용한다.
- 운영 확장은 **HANA FC 실사용 → 복수 포메이션 지원 → 다른 팀 시범 도입** 순서다. 팀 기능 구현 완료를 공개 팀 모집 시작으로 간주하지 않는다.

## 결정한 접속 방식

서비스 관리자가 팀을 만들고 최초 운영진을 지정한다. 기존 계정은 로그인 ID로 직접 지정하고 새 운영진은 개인 전달한 일회용 초대를 24시간 안에 수락한다. 운영진은 개인 계정으로 본인 팀 기록을 수정하며 해당 팀의 회원 조회 코드를 발급·재발급·폐기한다. 회원은 코드로 선수단·경기 기록만 조회한다. 서비스 관리 권한만으로 다른 팀 기록·코드에 접근하지 않는다.

조회 코드는 무작위 영문·숫자 12자(4자씩 구분 표시)이며 발급 후 90일 동안 유효하다. 초대 토큰은 43자이며 계정 활성화용으로만 사용한다. 둘 다 DB에는 해시만 저장하고 원문은 발급 성공 응답에서 한 번 표시한다. 재발급·폐기 후 기존 코드로 만든 조회 세션은 다음 API 요청부터 거부하고 개인 운영진 로그인은 유지한다. 조회 세션은 유휴 24시간·최대 7일, 계정은 유휴 30분이다. 로그인·코드·초대 입력의 IP/브라우저별 실패 10회(10분 내)는 10분 대기를 요구한다.

`teams`와 `team_memberships`, 선수·경기의 `team_id`로 클럽을 분리한다. 서버는 현재 세션·활성 소속과 `X-Team-Id`를 대조하고 조회·수정·엑셀·자동 편성에서 해당 팀만 사용한다. 코드를 아는 사람이 조회하는 방식이므로 개인별 회원 탈퇴·접근 이력이 필요해지면 회원 계정 방식으로 확장한다. 공개 팀 가입·직접 팀 생성, 비밀번호 복구와 팀 삭제는 이번 범위에 없다.

## 배포 구조

```text
회원 브라우저 ─ HTTPS ─ Caddy
                        ├─ 빌드한 React 정적 파일
                        └─ /api/* → Spring Boot → MySQL
```

화면과 API를 같은 주소에서 제공해 세션 쿠키와 CSRF 검사를 그대로 사용한다. 외부에 여는 포트는 80/443뿐이며 MySQL 3306과 API 8080은 Compose 내부에서만 접근한다. Caddy는 공개 도메인의 인증서 발급·갱신을 처리한다. DB와 인증서는 Docker 볼륨으로 유지한다. 소스와 DB 파일을 이미지에 함께 넣지 않는다.

운영 Compose의 `SERVER_FORWARD_HEADERS_STRATEGY=framework`는 Caddy가 전달한 실제 접속 주소를 사용하여 모든 회원이 프록시 IP 하나로 실패 제한에 걸리는 것을 막는다. API를 외부 포트로 직접 공개하지 않고 신뢰한 프록시만 앞에 둔다. 임의의 전달 헤더를 직접 신뢰하는 공개 API 구성으로 바꾸지 않는다. 현재 세션과 실패 횟수는 단일 API 인스턴스 메모리에 있으므로 서버 재시작 시 초기화되며 다중 인스턴스 운영은 별도 설계가 필요하다.

## Linux 서버에서 실행하는 절차

다음은 **Docker Engine과 Compose가 설치된 서버에서 Caddy가 직접 HTTPS를 처리하는 기존 구성**용이다. 현재 선택한 Cloudflare Tunnel 배포에서는 [전용 안내](oracle-cloudflare-deployment.md)의 포트·TLS·Compose 설정을 사용한다. 현재 PC의 Windows MySQL이나 개발용 `compose.yaml`을 바꾸는 명령이 아니다.

1. 저장소를 clone하고 프로젝트 루트로 이동한다.
2. `.env.production.example`을 `.env.production`으로 복사한다. DB 사용자·root·초기 관리자 비밀번호는 서로 다르게 생성한다. 예: `openssl rand -hex 24`. 파일 접근 권한은 `chmod 600 .env.production`으로 제한한다.
3. `JOCHOOK_ON_SITE_ADDRESS`의 예시 `jochook-on.example.com`을 소유한 도메인으로 바꾸고 DNS A/AAAA를 서버로 연결한다. 외부에서 80/443 접근이 가능해야 HTTPS 인증서를 발급할 수 있다. SSH 접근은 운영자 주소로 제한한다.
4. 아래 명령으로 구성 검증·이미지 빌드·실행을 한다. 최초 빌드는 JDK와 Node 의존성 다운로드 때문에 시간이 걸린다.

```bash
docker compose --env-file .env.production -f compose.production.yaml config --quiet
docker compose --env-file .env.production -f compose.production.yaml up --build -d --wait
docker compose --env-file .env.production -f compose.production.yaml ps
```

`https://설정한-도메인`에 접속해 지정한 관리자 계정으로 로그인한다. 초기 계정은 `accounts`가 비어 있을 때 한 번만 생성하며 환경변수의 비밀번호를 바꿔도 기존 비밀번호는 바뀌지 않는다. 이미 계정이 있으면 초기 계정 생성 변수 두 개는 비워 둘 수 있지만, 서비스 관리자 최초 지정에는 아래 별도 변수가 필요하다. 회원에게는 조회 코드만 전달하고 운영진 계정을 공유하지 않는다.

새 환경변수는 `JOCHOOK_ON_*` 접두어를 사용하며 최초 관리자 설정은 `JOCHOOK_ON_BOOTSTRAP_USERNAME`·`JOCHOOK_ON_BOOTSTRAP_PASSWORD`다. Spring 속성은 `jochookon.bootstrap.admin.*`이며 기존 `HANA_*`·`hana.*` 설정도 호환 입력으로 유지한다. 기존 `.env`를 리브랜딩 때문에 초기화하거나 비밀번호를 재생성하지 않는다.

서비스 관리자 지정은 `JOCHOOK_ON_SERVICE_ADMIN_USERNAME`(Spring: `jochookon.bootstrap.service-admin-username`)에 정확한 활성 계정 ID를 넣는다. 새 DB에서는 초기 계정 ID와 같게 지정할 수 있고 기존 DB에서는 보존된 본인 계정 ID를 사용한다. 없는 계정이나 비활성 계정을 지정하면 기동을 중단하며 전역 ADMIN 모두를 승격하지 않는다. 지정 후 권한은 DB에 남으므로 환경변수를 비우는 것은 권한 해제가 아니다. 로컬 `Start-Local.ps1`/`Start-Backend.ps1`은 `Use-DevTools.ps1`을 통해 Git 제외 관리자 설정의 ID를 기본 지정한다.

Compose 프로젝트 이름은 개발 `jochook-on`, 운영 `jochook-on-production`이다. 데이터 연결을 유지하기 위해 실제 Docker 볼륨 이름은 기존 개발 `hana-fc_mysql-data`, 운영 `hana-fc-production_mysql-data`·`hana-fc-production_caddy-data`·`hana-fc-production_caddy-config`를 명시적으로 사용한다. 기존 DB·사용자 이름도 유지한다. 다른 Compose 프로젝트 이름으로 운영하던 환경은 실제 볼륨 이름을 먼저 대조해야 하며, 새 볼륨에 연결된 빈 DB를 기존 데이터 삭제로 오인하지 않는다.

같은 Docker 호스트에서 별도 QA 환경을 만들 때는 `-p`만 바꾸지 말고 `JOCHOOK_ON_MYSQL_VOLUME`, `JOCHOOK_ON_CADDY_DATA_VOLUME`, `JOCHOOK_ON_CADDY_CONFIG_VOLUME`도 각각 QA 전용 고유 이름으로 지정한다. 볼륨 이름이 명시되어 있으므로 `-p`만 바꾸면 같은 저장소를 공유한다. 테스트 종료 시에는 실제로 연결된 볼륨 이름을 확인한 뒤 그 QA 자원만 정리한다.

최초 배포 DB는 비어 있다. 실제 데이터를 옮길 때는 로컬 DB의 비공개 백업을 먼저 만들고, 서버 DB와 스키마 버전을 확인한 뒤 이전한다. 백업은 Git 외부에서 암호화해 보관한다. 기존 회원 정보가 들어 있는 SQL을 seed나 Flyway 마이그레이션으로 만들지 않는다.

V14/V15는 기존 HANA FC를 팀 1로 연결하고 계정·선수·경기 PK와 하위 기록을 유지한다. 기존 DB는 백업 → 격리된 임시 DB에서 V13→V15 검증 → 운영 반영 → 건수·ID·관계·핵심 값 대조 순서로 이전한다. 이미 V15인 백업은 같은 버전으로 복구하고 V14/V15를 수동 재실행하지 않는다. 새 팀을 만들어 기존 기록을 복사하거나 기존 마이그레이션을 수정하는 방식으로 이전하지 않는다.

V16은 코드 변경 이력 테이블을 추가한다. 기존 코드의 현재 상태를 유지하고 적용 이후 발급·재발급·폐기부터 정확한 담당자·시각을 기록하며 과거 이력을 만들지 않는다. 복구 후 최신 앱을 시작하면 Flyway가 아직 적용하지 않은 후속 버전만 실행한다. 실제 로컬 V16 적용과 최종 검증을 완료했으며 클라우드 DB 이전은 별도 작업이다.

접속 확인은 서비스 관리자 로그인 → 기존 HANA FC 소속 확인 → 가상 팀에서 운영진 초대/지정 → 해당 운영진 코드 발급 → 별도 브라우저의 조회 전용 접속 → 코드 재발급 후 기존 조회 세션 차단 순서로 진행한다. 소속 없는 서비스 관리 계정이 다른 팀 기록에 접근할 수 없는지도 확인한다. 실제 초대·코드·계정 원문은 검증 문서나 공개 로그에 남기지 않는다.

Linux 서버의 백업 예시는 다음과 같다. 프로젝트 루트에서 실행하고, 생성한 파일은 서버 외부의 접근 제한된 저장소에도 보관한다. 실제 운영 전에 별도 DB에 복구가 되는지 확인한다.

```bash
mkdir -p backups
chmod 700 backups
set -o pipefail
umask 077
docker compose --env-file .env.production -f compose.production.yaml exec -T mysql \
  sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --no-tablespaces --set-gtid-purged=OFF "$MYSQL_DATABASE"' \
  | gzip > "backups/jochook-on-$(date +%Y%m%d-%H%M%S).sql.gz"
```

업데이트 전 DB를 백업하고 `git pull --ff-only` 후 위 `up --build` 명령을 사용한다. Flyway가 새 마이그레이션만 적용한다. 볼륨 삭제 옵션인 `down --volumes`는 운영 DB를 지우므로 운영 환경에서 사용하지 않는다. 서버 재시작 시 컨테이너는 `unless-stopped` 정책으로 다시 실행되며 세션은 메모리에 있어 재로그인이 필요하다.

## 무료 호스팅 검토 — 2026-10-14

- **Northflank Sandbox:** 공식 요금표에 무료 서비스 2개와 DB 1개가 있다. MySQL 8.4를 지원하므로 화면·API·DB 조합의 후보이다. 계정에서 실제 선택 가능한 무료 메모리·스토리지와 Java/자동 편성의 사용량을 확인해야 한다. 관리형 플랫폼에서는 위 Compose를 그대로 실행하는 대신 이미지의 `web`/`api` target을 서비스로 나누고 플랫폼의 내부 주소·HTTPS에 맞춰 설정한다. [요금표](https://northflank.com/pricing), [MySQL 안내](https://northflank.com/docs/v1/application/databases-and-persistence/deploy-databases-on-northflank/deploy-mysql-on-northflank).
- **Oracle Cloud Always Free:** 무료 VM 안에서 이 Compose를 실행할 수 있는 후보이다. 무료 자원 확보와 계정 생성이 필요하며 가용 용량 부족 또는 유휴 자원 회수 가능성이 있다. ARM 서버를 선택한다면 OR-Tools를 포함한 ARM 이미지 검증을 별도로 한다. [Always Free 안내](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).
- **Render 무료 서비스:** 유휴 시 절전, 무료 영구 디스크 부재 때문에 현재 MySQL까지 한곳에서 계속 보관하기에는 맞지 않는다. [무료 서비스 제한](https://render.com/docs/free).

무료 제공 조건은 바뀔 수 있으므로 실제 생성 직전 화면의 플랜과 월 예상 비용을 확인한다. GitHub 업로드 완료를 서비스 배포 완료로 표시하지 않는다.

구성 근거: [Docker Compose 운영 배포](https://docs.docker.com/compose/how-tos/production/), [Caddy 자동 HTTPS](https://caddyserver.com/docs/automatic-https).
