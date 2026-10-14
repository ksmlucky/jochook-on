# GitHub와 회원용 배포

소스 저장소와 회원이 접속할 서비스는 별개다. GitHub에는 코드와 설정 예시만 올린다. 실제 회원 명단, 경기 기록, 계정, DB 백업, 비밀번호는 GitHub에 올리지 않는다. 서버를 만들면 별도의 MySQL에 데이터를 이전해야 한다.

## 현재 상태와 순서

- 서비스명은 **조축ON**이며 현재 소속 팀은 **HANA FC**다. 현재는 한 팀용으로 운영진·회원의 계정 로그인과 조회/수정 권한을 구분한다. 브랜드 변경만으로 팀 생성·공유 코드·팀별 데이터 분리가 추가되지는 않는다.
- 저장소 표준 주소는 [ksmlucky/jochook-on](https://github.com/ksmlucky/jochook-on)이다. 원격 이름 변경의 확인 결과는 [검증 기록](verification.md)을 따른다.
- 배포 이미지는 `Dockerfile`, 서버 실행 구성은 `compose.production.yaml`, HTTPS 입구는 `deploy/Caddyfile`에 있다.
- GitHub Actions는 테스트와 빌드만 한다. 서버 자동 배포는 연결하지 않았다.
- 회원 공개 전 **공유 코드 발급·재발급·접속** 기능을 추가한다. 이 문서의 계획만으로 해당 기능이 구현된 것은 아니다.
- 사용자는 다음 배포 작업에서 AWS 연동과 실제 서버를 준비한 뒤 아이폰으로 접속하기로 했다. AWS 계정의 무료 적용 범위·실제 자원·예상 비용을 확인한 후 서버를 만든다. 아래의 이전 호스팅 후보 검토는 참고 자료이며 서버가 배포됐다는 뜻은 아니다.

## 결정한 접속 방식

운영진은 개인 관리자 계정으로 로그인하여 기록을 수정한다. 운영진만 회원용 공유 코드를 발급·재발급·폐기할 수 있게 한다. 회원은 코드를 입력하면 선수단과 경기 기록을 조회하며, 기록 수정과 코드 관리는 할 수 없다.

구현 시에는 충분히 긴 무작위 코드, 코드 해시 저장, 실패 횟수 제한, 세션 만료를 적용한다. 코드를 재발급하거나 폐기하면 이전 코드와 해당 코드로 만든 기존 세션도 사용할 수 없도록 한다. 코드를 아는 사람이 조회할 수 있는 방식이므로 개인별 접근 이력·탈퇴 처리가 필요해지면 초대 코드와 개인 계정 방식으로 확장한다.

다른 팀 지원은 후속 단계다. 팀을 식별하는 코드만 추가해서는 데이터가 분리되지 않는다. `teams`와 팀 소속 운영진을 도입하고 선수·경기·계정의 조회 및 변경에서 팀 범위를 검사해야 한다. 지금 DB는 여러 팀을 안전하게 함께 운영하는 구조가 아니다.

## 배포 구조

```text
회원 브라우저 ─ HTTPS ─ Caddy
                        ├─ 빌드한 React 정적 파일
                        └─ /api/* → Spring Boot → MySQL
```

화면과 API를 같은 주소에서 제공해 세션 쿠키와 CSRF 검사를 그대로 사용한다. 외부에 여는 포트는 80/443뿐이며 MySQL 3306과 API 8080은 Compose 내부에서만 접근한다. Caddy는 공개 도메인의 인증서 발급·갱신을 처리한다. DB와 인증서는 Docker 볼륨으로 유지한다. 소스와 DB 파일을 이미지에 함께 넣지 않는다.

## Linux 서버에서 실행하는 절차

다음은 **Docker Engine과 Compose가 설치된 서버**용이다. 현재 PC의 Windows MySQL이나 개발용 `compose.yaml`을 바꾸는 명령이 아니다.

1. 저장소를 clone하고 프로젝트 루트로 이동한다.
2. `.env.production.example`을 `.env.production`으로 복사한다. DB 사용자·root·초기 관리자 비밀번호는 서로 다르게 생성한다. 예: `openssl rand -hex 24`. 파일 접근 권한은 `chmod 600 .env.production`으로 제한한다.
3. `JOCHOOK_ON_SITE_ADDRESS`의 예시 `jochook-on.example.com`을 소유한 도메인으로 바꾸고 DNS A/AAAA를 서버로 연결한다. 외부에서 80/443 접근이 가능해야 HTTPS 인증서를 발급할 수 있다. SSH 접근은 운영자 주소로 제한한다.
4. 아래 명령으로 구성 검증·이미지 빌드·실행을 한다. 최초 빌드는 JDK와 Node 의존성 다운로드 때문에 시간이 걸린다.

```bash
docker compose --env-file .env.production -f compose.production.yaml config --quiet
docker compose --env-file .env.production -f compose.production.yaml up --build -d --wait
docker compose --env-file .env.production -f compose.production.yaml ps
```

`https://설정한-도메인`에 접속해 초기 관리자 계정으로 로그인한다. 초기 관리자는 `accounts`가 비어 있을 때 한 번만 생성한다. 환경변수의 비밀번호를 바꿔도 기존 계정 비밀번호가 바뀌지는 않는다. 이미 계정이 있으면 초기 관리자 환경변수 두 개는 비워 둘 수 있다. 회원용 코드 기능이 준비되기 전에는 운영진 계정을 회원에게 공유하지 않는다.

새 환경변수는 `JOCHOOK_ON_*` 접두어를 사용하며 최초 관리자 설정은 `JOCHOOK_ON_BOOTSTRAP_USERNAME`·`JOCHOOK_ON_BOOTSTRAP_PASSWORD`다. Spring 속성은 `jochookon.bootstrap.admin.*`이며 기존 `HANA_*`·`hana.*` 설정도 호환 입력으로 유지한다. 기존 `.env`를 리브랜딩 때문에 초기화하거나 비밀번호를 재생성하지 않는다.

Compose 프로젝트 이름은 개발 `jochook-on`, 운영 `jochook-on-production`이다. 데이터 연결을 유지하기 위해 실제 Docker 볼륨 이름은 기존 개발 `hana-fc_mysql-data`, 운영 `hana-fc-production_mysql-data`·`hana-fc-production_caddy-data`·`hana-fc-production_caddy-config`를 명시적으로 사용한다. 기존 DB·사용자 이름도 유지한다. 다른 Compose 프로젝트 이름으로 운영하던 환경은 실제 볼륨 이름을 먼저 대조해야 하며, 새 볼륨에 연결된 빈 DB를 기존 데이터 삭제로 오인하지 않는다.

최초 배포 DB는 비어 있다. 실제 데이터를 옮길 때는 로컬 DB의 비공개 백업을 먼저 만들고, 서버 DB와 스키마 버전을 확인한 뒤 이전한다. 백업은 Git 외부에서 암호화해 보관한다. 기존 회원 정보가 들어 있는 SQL을 seed나 Flyway 마이그레이션으로 만들지 않는다.

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
