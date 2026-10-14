# 이 PC에서 실행하기

설정일: 2026-10-13. 제품명 변경: 2026-10-14. 제품은 **조축ON**이며 실제 프로젝트 경로는 `%USERPROFILE%\Documents\ChatGPT\HANA FC Transfermarkt`를 유지합니다.

## 화면 보기

브라우저에서 <http://127.0.0.1:5173>에 접속합니다. 실제 Spring Boot API와 MySQL 8.4에 연결된 로그인 화면입니다. 로그인하면 기존 DB에 저장한 선수와 경기 기록을 조회합니다. 새 개발 환경의 빈 DB에는 예시 선수를 자동으로 넣지 않습니다.

## 최초 관리자 로그인

이 PC에는 최초 관리자 계정을 준비했습니다. 프로젝트의 `.local/admin-bootstrap.json`을 열어 `username`, `password` 값으로 로그인합니다. 아이디는 `admin`이며 비밀번호는 무작위로 생성했습니다. 파일은 Git에서 제외돼 있습니다.

새 개발 환경에서는 `scripts/Initialize-Admin.ps1`을 최초 1회 실행한 뒤 API를 시작합니다. API는 계정 테이블이 비어 있을 때만 계정을 생성하므로, 재시작하거나 JSON 파일을 바꿔도 기존 비밀번호를 변경하지 않습니다. 비밀번호 변경·복구 기능은 후속 작업입니다. 초기 파일은 로컬 로그인 정보이며, DB의 `accounts.password_hash`에는 BCrypt 해시만 저장합니다.

## IntelliJ SQL 자동완성

이 PC의 IntelliJ IDEA 2023.3 설정에 `HANA SQL` 그룹의 `sf` Live Template을 추가했습니다. IntelliJ를 다시 연 뒤 SQL 콘솔 또는 SQL 파일에서 `sf`를 입력하고 Tab을 누르면 `SELECT * FROM …;`이 펼쳐집니다. 커서는 테이블 이름 입력 위치에 놓입니다.

설정 위치는 `Ctrl+Alt+S → Editor → Live Templates → HANA SQL → sf`입니다. 적용 범위는 SQL Query, 확장 키는 Tab입니다. 설정 파일은 `%APPDATA%\JetBrains\IntelliJIdea2023.3\templates\HANA_SQL.xml`이며, IDE 재시작과 실제 키 입력 확인은 사용자가 진행합니다.

프로젝트 폴더에서 다음 파일을 더블클릭할 수 있습니다.

| 파일 | 동작 |
| --- | --- |
| `Start-JochookON.cmd` | 로컬 MySQL → API → 이미 빌드한 화면을 실행하고 브라우저를 연다. |
| `Stop-JochookON.cmd` | 이 프로젝트가 실행한 화면·API를 종료하고 해당 데이터 경로의 MySQL을 정상 종료한다. DB 파일은 유지한다. |
| `Dev-JochookON.cmd` | 설치된 Java·Node.js·npm·pnpm·Git·MySQL 경로가 설정된 PowerShell을 연다. |
| `Install-Docker.cmd` | 다운로드한 공식 Docker 설치기를 연다. 설치 완료는 사용자가 확인해야 한다. |
| `Prepare-WSL.cmd` | 우클릭 → 관리자 권한으로 실행. Docker에 필요한 WSL을 설치한다. 자동 재부팅은 하지 않는다. |

브라우저를 닫아도 서버는 실행됩니다. 컴퓨터를 재부팅하면 `Start-JochookON.cmd`를 다시 실행합니다. 로그인 시 자동 시작이나 Windows 서비스로 등록하지 않았습니다. 모든 서비스는 이 PC의 127.0.0.1에서만 접속합니다.

## 설치 위치와 상태

모든 개발 도구는 사용자별 프로그램 경로인 `%LOCALAPPDATA%\Programs`에 준비했습니다.

| 도구 | 하위 경로 | 상태 |
| --- | --- | --- |
| Temurin JDK 21.0.12.1 | `Eclipse Adoptium\jdk-21.0.12.1+1` | 공식 압축 배포본, Java 실행 확인 |
| Node.js 24.21.0 / npm 11.19.0 | `nodejs\node-v24.21.0-win-x64` | 공식 압축 배포본, 실행 확인 |
| pnpm 11.25.0 | `pnpm` | npm 공식 레지스트리에서 설치, 실행 확인 |
| Git 2.56.0.windows.2 | `Git` | 공식 MinGit 배포본, CLI 실행 확인. Git Bash/GUI는 포함하지 않는다. |
| MySQL 8.4.11 | `MySQL\mysql-8.4.11-winx64` | 공식 압축 배포본, 실제 DB·API 연결 확인 |
| Docker Desktop 4.95.0 | `DockerDesktop` | 클라이언트·Linux 엔진 29.8.2 응답, MySQL Testcontainers 테스트 5개 통과 |

원본 설치 파일은 `HanaDevTools\Installers`에 있습니다. VS Code와 IntelliJ는 기존 설치를 사용합니다. Spring Boot, React, TypeScript, JPA 등은 프로젝트 의존성이므로 별도 전역 설치가 필요 없습니다. Gradle은 프로젝트 Wrapper로 실행합니다.

설치 당시 사용자 레지스트리 변경이 거부되어 전역 `PATH`와 `JAVA_HOME`은 등록하지 못했습니다. `Dev-JochookON.cmd`와 프로젝트 실행 스크립트가 자신의 프로세스에만 경로를 설정하므로 즉시 사용할 수 있습니다. CMD 실행기는 해당 PowerShell 프로세스에서만 `RemoteSigned`를 사용하며 Windows 전체 실행 정책은 변경하지 않습니다.

## 코드를 수정하며 개발하기

`Start-JochookON.cmd`는 마지막으로 빌드한 화면과 JAR를 보여 줍니다. 소스 변경이 자동 반영되지는 않습니다.

1. `Stop-JochookON.cmd`로 미리보기 서버를 종료합니다.
2. `Dev-JochookON.cmd`를 열어 `.\scripts\Start-MySQL.ps1`을 실행합니다.
3. 같은 터미널에서 `.\scripts\Start-Backend.ps1`을 실행합니다.
4. 두 번째 `Dev-JochookON.cmd`를 열어 `pnpm dev`를 실행합니다.

빌드 결과를 갱신하려면 개발 서버를 종료한 다음 `.\scripts\Start-Backend.ps1 -Task bootJar`와 `pnpm build`를 실행합니다. 이후 `Start-JochookON.cmd`를 사용합니다.

Codex의 제한된 실행 환경에서는 Vite의 Windows 드라이브 확인 명령에 `spawn EPERM`이 발생할 수 있습니다. 로그인 화면 작업에서는 사용자 승인 후 동일한 정식 `pnpm build`를 제한 밖에서 실행해 성공했습니다. 현재 화면은 그 빌드 파일을 사용합니다.

## DB 데이터와 Docker 전환

현재는 WSL/Docker 준비 전에도 사용할 수 있도록 Windows용 MySQL을 실행합니다. Docker의 MySQL과 같은 8.4 계열이며 기존 API와 Flyway SQL을 그대로 사용합니다.

- DB 데이터: 프로젝트의 `.local/mysql-data`.
- 실행 로그: 프로젝트의 `.local/*.log`.
- 접속 정보: 프로젝트의 `.env`.
- `.local`과 `.env`는 Git에 포함하지 않습니다. **`.local/mysql-data`는 임시 파일이 아니라 실제 DB 데이터이므로 지우지 않습니다.**
- 로컬 MySQL과 Docker MySQL은 모두 3307을 사용하므로 동시에 실행하지 않습니다.
- Docker 볼륨은 별도의 DB입니다. Docker로 전환하기 전에 로컬 DB를 백업하고, 입력한 데이터가 있다면 내보내기·가져오기 작업을 해야 합니다.
- 제품명이 조축ON으로 바뀌어도 기존 `hana_fc` DB·사용자·볼륨과 `HanaDevTools` 설치 경로, IntelliJ의 `HANA SQL` 설정은 호환성을 위해 유지합니다. 이름 변경을 이유로 `.env`나 데이터 디렉터리를 초기화하지 않습니다.

## Docker 사용하기

2026-10-13 확인: WSL 3.0.3.0, 기본 WSL 버전 2, HypervisorPresent=True. Docker Desktop을 실행한 뒤 `docker version`의 Client와 Server 응답을 확인했습니다. 현재 추가 설치나 재부팅은 필요하지 않습니다. 별도 Ubuntu 배포판도 필요하지 않습니다.

1. Windows 시작 메뉴에서 **Docker Desktop**을 실행하고 엔진이 시작될 때까지 기다립니다. 이미 실행 중이면 그대로 사용합니다.
2. 프로젝트의 **Dev-JochookON.cmd**를 열고 `docker version`을 실행합니다. Client뿐 아니라 Server 정보도 나오면 준비 완료입니다. 이 터미널에는 Docker 경로도 추가했습니다.
3. `./scripts/Start-Backend.ps1 -Task integrationTest`를 실행합니다. 일회용 MySQL 컨테이너가 생성·정리되며 실제 `hana_fc` DB와 분리됩니다. 이번 실행에서 5개 테스트가 통과했습니다.

Codex 샌드박스에서는 named pipe 접근이 거부될 수 있어 승인된 제한 밖 실행으로 확인했습니다. 이는 WSL 재설치가 필요한 상태와 구분합니다. 일반 사용자 터미널에서 먼저 확인하세요.

현재 앱은 Windows MySQL 3307을 사용합니다. `docker compose up`은 동일한 3307 포트를 사용하고 데이터도 별도 볼륨이므로 바로 실행하지 않습니다. 개발 DB까지 Docker로 전환하려면 위 백업·이전 절차를 별도로 수행합니다. 현재 Docker는 통합 테스트에 사용할 수 있습니다.

Docker Desktop의 Containers 목록이 비어 있고 **Resource Saver mode**가 보이는 것은 실행 중인 컨테이너가 없어 대기하는 상태입니다. 컨테이너가 필요하면 자동으로 해제되므로 별도 버튼을 누를 필요가 없습니다. WSL의 **시작** 안내 창은 닫아도 됩니다. 통합 테스트를 실행할 때는 Docker Desktop을 실행해 두세요. 참고: [Docker Resource Saver](https://docs.docker.com/desktop/use-desktop/resource-saver/).

공식 WSL 안내: [Docker Desktop WSL 2 backend](https://docs.docker.com/desktop/features/wsl/).

공식 문서: [Docker Windows 설치](https://docs.docker.com/desktop/setup/install/windows-install/), [Microsoft WSL 설치](https://learn.microsoft.com/en-us/windows/wsl/install), [WSL 명령 옵션](https://learn.microsoft.com/en-us/windows/wsl/basic-commands), [MySQL Windows 설치](https://dev.mysql.com/doc/refman/8.4/en/windows-install-archive.html).
