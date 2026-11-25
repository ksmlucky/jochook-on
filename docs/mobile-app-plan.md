# 조축ON PWA 유지와 모바일 앱 준비

기준일: 2026-10-14. **사용자는 PWA를 유지하면서 Capacitor 8 앱 프로젝트 준비를 시작하고 비용은 나중에 결정하기로 승인했다.** Windows에서 소스 구조와 연결 준비 화면부터 만든다. PWA 구현과 로컬 검증은 완료했지만 공개 HTTPS, 실제 휴대전화 설치, 네이티브 빌드·서명·테스터 배포는 아직 완료하지 않았다. 웹을 반드시 스토어 앱으로 전환할 필요는 없으며 두 사용 경로를 함께 유지한다.

## 1. 이번 범위

PWA는 현재 React / TypeScript / Vite 웹앱의 설치 정보·안내와 기존 기능을 유지한다. 회원 조회·운영진 입력의 기능·권한·화면 흐름을 그대로 사용한다. 추가 승인된 네이티브 앱 준비는 아래 5절 범위로 진행하며 앱 전체 UI 개편이나 모바일 조회 전용 앱으로 바꾸는 작업은 포함하지 않는다.

설치한 아이콘의 이름은 **조축ON**이며 서비스 로고와 같은 아이콘을 사용한다. 색·형태는 [최신 디자인 명세](design-refresh.md)에 맞춰 통일한다. 지원하는 기기에서는 브라우저 주소창이 없는 별도 창으로 실행한다. 선수·경기 조회와 저장은 기존 서버를 이용하므로 **인터넷 연결이 필요하다.** PWA는 서버와 DB를 휴대전화에 설치하는 방식이 아니다.

공개 서버는 2026-10-14 [Northflank 무료 시범 배포](northflank-deployment.md)로 마련했다. 조축ON (`****`)에서 PWA 실기기 설치를 확인한다. [Oracle Cloud·Cloudflare](oracle-cloudflare-deployment.md)는 용량 확보 후 이전 후보로 유지한다. 도메인 구매와 스토어 등록비 결제는 하지 않았다.

## 2. 요구사항과 인수 기준

| ID | 요구사항 | 완료 기준 |
| --- | --- | --- |
| PWA-R01 | 앱 설치 정보 | manifest에 조축ON 이름·아이콘·시작 주소와 `display: standalone`을 지정한다. 기본 아이콘과 홈 화면 아이콘이 올바른 크기·경로로 제공된다. |
| PWA-R02 | 설치 안내 카드 | 브라우저가 설치 프롬프트를 제공하면 설치 버튼을 노출한다. 제공하지 않으면 해당 기기의 수동 설치 방법을 안내한다. 안내가 기존 접속·입력을 막지 않는다. |
| PWA-R03 | 설치 상태 반영 | standalone 실행에서는 설치 안내를 숨긴다. 설치 취소나 미지원 환경을 설치 성공으로 표시하지 않는다. |
| PWA-R04 | 제한된 오프라인 안내 | Service Worker는 개인정보가 없는 오프라인 안내 HTML 한 페이지만 캐시한다. 회원 자료·인증·API 응답·앱 화면 및 JS/CSS를 오프라인용으로 캐시하지 않는다. |
| PWA-R05 | 초안과 업데이트 | 업데이트 감지를 이유로 작성 중인 화면을 강제로 새로고침하지 않는다. 자동 저장·오프라인 저장·나중에 자동 전송 기능은 추가하지 않는다. |
| PWA-R06 | 기존 동작과 권한 유지 | 팀 코드·개인 운영진 로그인·팀 전환·조회·수정은 기존 서버 검증을 따른다. 세션 만료와 통신 실패를 저장 성공처럼 표시하지 않는다. |
| PWA-R07 | 공개 서버와 실기기 확인 | HTTPS 주소에서 아이폰·Android 홈 화면 설치, 아이콘 실행·재접속·로그아웃을 실제 기기로 확인한다. PC 로컬 확인과 실기기 설치 완료를 구분한다. |

캐시 제한은 이번 Service Worker의 Cache Storage 정책이다. 일반 브라우저 캐시까지 전부 없다는 뜻은 아니며, 인증·개인 데이터의 HTTP 캐시 정책은 기존 서버 기준을 유지한다. 이미 열린 화면의 내용은 기기 메모리에 남을 수 있지만 오프라인 조회 기능으로 보장하지 않는다.

## 3. 간단 스토리보드

```text
PWA-S01 기존 웹 화면 + 설치 안내 카드
  조축ON을 홈 화면에서 바로 열어 보세요.
  ├ 설치 프롬프트 지원 → [설치] → 브라우저 설치 확인
  ├ 아이폰 → Safari 공유 > 홈 화면에 추가 > 추가
  └ Android → Chrome 메뉴 > 앱 설치 또는 홈 화면에 추가

PWA-S02 홈 화면 아이콘 실행
  조축ON 아이콘 → 기존 접속/조회 화면
  설치 안내 숨김 / 기존 회원·운영진 권한 유지

PWA-S03 인터넷 연결 없이 새 화면 열기
  인터넷 연결이 필요해요.
  연결을 확인한 뒤 다시 열어 주세요. [다시 시도]
```

| 화면 | 상태와 동작 | 연결 요건 |
| --- | --- | --- |
| PWA-S01 | 설치 버튼은 실제 설치 프롬프트가 준비된 경우에만 활성화한다. 설치 취소 시 기존 웹을 계속 사용할 수 있다. | PWA-R01~03 |
| PWA-S01 수동 안내 | 아이폰 Safari의 공유 메뉴에서 홈 화면에 추가한다. ‘웹 앱으로 열기’ 옵션이 표시되면 켠다. Android Chrome은 메뉴의 앱 설치/홈 화면에 추가를 안내하며 OS·브라우저별 문구 차이를 허용한다. | PWA-R02 |
| PWA-S02 | 설치 아이콘으로 열면 안내를 숨긴다. 브라우저와 설치 앱 간 세션 공유를 가정하지 않고, 필요한 경우 기존 방식으로 다시 접속한다. | PWA-R03, PWA-R06~07 |
| PWA-S03 | 온라인 방문으로 Service Worker와 안내 캐시가 준비된 후 네트워크 탐색이 실패하면 안내한다. 첫 방문부터 오프라인이면 안내 제공을 보장할 수 없다. API 실패는 기존 화면의 오류 처리로 남긴다. | PWA-R04~05 |

설치 경로는 [MDN의 PWA 설치 안내](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)와 [Apple의 웹사이트를 앱으로 열기 안내](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/27/ios/27)를 2026-10-14에 확인했다. 브라우저 설치 버튼 지원 여부와 수동 메뉴는 다르며 아이폰에서 웹 페이지의 설치 버튼으로 Safari의 설치 화면을 강제로 띄우지 않는다.

## 4. 진행 순서와 검증 상태

| 단계 | 확인할 내용 | 현재 상태 |
| --- | --- | --- |
| 1. 설치 준비 구현 | manifest·아이콘·안내 카드·standalone 감지·오프라인 안내 | 구현 완료. 실제 설치 확인 창과 standalone 실행은 미검증 |
| 2. 로컬 검증 | 빌드, 정적 파일 제공, 설치 방법 펼치기, Service Worker 캐시와 오프라인 복구 | 아래 로컬 검증 완료. 설치 상태별 실제 기기 동작은 후속 확인 |
| 3. 공개 서버 배포 | Northflank 무료 API·웹·DB, 기본 HTTPS 주소와 기존 API 연결 | 배포·자료 이전·로그인 검증 완료, 실기기 확인 다음 |
| 4. 실기기 확인 | 아이폰 Safari·Android Chrome 설치, 아이콘/독립 창, 로그인·코드·세션 만료, 온라인/오프라인 전환 | 공개 주소 마련 후 진행 |
| 5. 팀원 사용 | 설치 방법 전달, 실제 경기 조회·입력 피드백 수집 | 실기기 확인 후 진행 |

로컬 검증 결과:

- `pnpm build`: TypeScript와 Vite 빌드 성공. `pnpm --filter @jochook-on/web test`: 29개 통과(기존 19개 + Service Worker 정책 10개).
- 실제 `5173` 서버에서 manifest MIME, PNG 192/512 크기와 `/sw.js`·오프라인 안내·Apple 아이콘의 HTTP 200 응답을 확인했다.
- 실제 브라우저에서 worker 활성화와 `/sw.js` 제어를 확인했다. Cache Storage의 `jochook-on-offline-v1`에는 `/offline.html` 한 항목만 있었다.
- 프론트 서버를 잠시 종료해 실제 네트워크 요청을 실패시킨 뒤 오프라인 안내가 표시되는 것을 확인했다. 서버 복구 후 ‘연결 확인 후 다시 접속’으로 원래 팀 코드 화면에 복귀했고 로컬 서버는 정상 복구했다.
- 설치 방법 펼치기와 390px 화면의 가로 넘침 없음을 확인했다. [모바일 화면 캡처](../outputs/jochook-on-pwa-mobile.png)

브라우저의 실제 설치 프롬프트·standalone 실행, iOS/Android 실기기 설치, 공개 HTTPS에서는 아직 확인하지 않았다. 이번 변경에서 전체 기능 재검증이나 백엔드/MySQL 테스트를 다시 실행하지 않았으며 백엔드 변경도 없다. 상세 기록은 [검증 기록](verification.md)을 따른다.

설치 가능한 PWA는 HTTPS 또는 로컬 개발용 localhost/loopback 주소에서 제공해야 한다. PC의 `127.0.0.1`은 아이폰에서 이 PC에 연결하는 주소가 아니므로 로컬 PC 검증만으로 아이폰 접속·설치가 끝난 것으로 기록하지 않는다. [MDN 설치 조건](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable#https_localhost_or_loopback_are_required)

## 5. 추가 승인 — 앱 준비 시작, 비용은 이후 결정

이번에는 Capacitor 8 기반 Android/iOS 프로젝트의 뼈대와 **연결 준비 화면**을 만든다. 실제 회원 API 연결, 운영 데이터 탑재, 계정 등록·결제·서명·스토어 업로드·테스터 초대는 하지 않는다. 준비 화면은 회원용 앱이 이미 연결되거나 배포됐다고 표시하지 않는다.

```text
앱 실행 → 조축ON 연결 준비 화면
          서버 연결 전임을 안내 / 실제 회원 데이터 없음
추후 HTTPS 서버 준비 → 인증·API 호환성 검증 → 실기기 검증 → 베타 배포
```

| 단계 | 완료 기준 | 현재 상태 |
| --- | --- | --- |
| 앱 구조 준비 | Capacitor 8 설정·플랫폼 프로젝트·연결 준비 화면 생성, 기존 웹/PWA 유지 | Capacitor 8.5.3 Android/iOS 생성·동기화·자산 검사 완료. 실제 앱 컴파일은 미실행 |
| 서버 연결 검증 | 공개 HTTPS에서 세션·쿠키·CORS·CSRF·팀 코드/비밀번호·초대 링크·파일 처리를 검증 | 미착수. OAuth/JWT 전면 변경은 결정하지 않음 |
| 실제 설치와 베타 | 플랫폼 빌드·서명·기기 확인 후 아래 테스트 경로로 배포 | 계정·비용·환경 결정 후 진행 |

Windows에서 준비를 시작하되 iOS 빌드에는 macOS와 Xcode가 필요하다. Mac 또는 macOS 빌드 서비스의 이용 방식·비용은 나중에 정한다. 프로젝트 파일 생성만으로 APK/IPA 생성이나 아이폰 설치 성공을 뜻하지 않는다. [Capacitor 환경 설정](https://capacitorjs.com/docs/getting-started/environment-setup)

## 6. ‘테스터 100명’과 배포 조건

2026-10-14 공식 안내 확인 기준이다. 초대 인원 수가 같더라도 Android와 iOS의 내부 테스트 대상은 다르다.

| 경로 | 대상과 조건 | 조축ON에서의 의미 |
| --- | --- | --- |
| Google Play 내부 테스트 | 앱당 최대 100명. 비공개 테스트 트랙과 별개다. | 팀원 소수에게 Android 베타를 배포할 후보. [Play 테스트 안내](https://support.google.com/googleplay/android-developer/answer/9845334) |
| TestFlight 내부 테스트 | 최대 100명의 앱 접근 권한이 있는 App Store Connect 개발팀 사용자 | 일반 축구 회원을 단순 테스터로 넣는 기본 경로가 아니다. [Apple TestFlight](https://developer.apple.com/testflight/) |
| TestFlight 외부 테스트 | 외부 테스터 최대 10,000명, 첫 빌드 심사 필요 | 일반 팀원은 외부 초대로 검토한다. 빌드는 최대 90일 테스트할 수 있어 새 빌드 운영이 필요하다. [TestFlight 개요](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/) |

앱 배포 비용은 Google Play 개발자 등록 일회 US$25, Apple Developer Program 연 US$99이며 실제 결제 시 지역·통화 조건을 확인한다. 지금은 계정 가입·결제를 진행하지 않는다. 서버·도메인·Mac 또는 빌드 서비스 비용은 별도다. [Google 등록 안내](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en), [Apple 등록 안내](https://developer.apple.com/programs/enroll/)

베타 배포와 공개 스토어 출시는 별개다. Google의 신규 개인 계정 공개 출시 조건도 내부 테스트 인원과 혼동하지 않는다. 출시를 추진하면 개인정보 처리방침·지원·계정 삭제·심사용 가상 팀과 당시 테스트·심사 조건을 별도로 준비한다. 단순 웹 재포장만으로 Apple 승인이 보장되지 않는다. [Google 신규 개인 계정 테스트 요건](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en), [Apple 최소 기능 지침](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality)

TestFlight는 공개 출시 없이 이메일 초대가 가능하지만 개발자 계정과 App Store Connect의 앱 등록·빌드 업로드는 필요하다. Google Play는 테스터를 등록한 뒤 참여 링크를 별도로 전달하는 흐름이며 이메일 자동 발송을 가정하지 않는다. 실제 초대는 대상과 발송 지시를 받은 후 진행한다. 앱 프로젝트 구조·명령과 현재 한계는 [네이티브 준비 안내](../frontend/NATIVE.md)에 기록했다.
