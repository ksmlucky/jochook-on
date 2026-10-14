# 조축ON 네이티브 앱 준비

현재 단계는 **Capacitor 8.5.3 프로젝트 생성과 로컬 준비 화면 복사**입니다. 실제 선수단·경기·팀 접속 기능은 기존 웹/PWA에서 사용합니다. Android/iOS 앱의 API 연결, 기기 실행, APK/IPA 생성, 서명, 스토어 등록은 아직 완료되지 않았습니다.

## 구조와 이유

- `capacitor.config.json`: 앱 표시명 `조축ON`, 개발용 ID `com.jochookon.app`. 이 ID는 소유 도메인·스토어 등록 계획과 함께 배포 전에 확정해야 합니다.
- `native-preview/`: 로그인 입력이나 API 호출이 없는 독립 준비 화면입니다. `native:prepare`가 `native-preview/dist`에 화면과 기존 제품 로고를 복사합니다. 웹의 `dist`와 분리되어 있습니다.
- `android/`: Android 프로젝트. 현재 런처 아이콘과 스플래시는 Capacitor가 생성한 기본 자산입니다. 조축ON 네이티브 아이콘·스플래시로 교체하고 기기에서 검증해야 합니다.
- `ios/`: iOS Xcode 프로젝트. Swift Package Manager를 사용합니다. 앱 아이콘·스플래시는 생성 기본값이며 실제 빌드 전에 교체해야 합니다.

기존 웹은 같은 출처의 `/api`와 세션 쿠키·CSRF를 사용합니다. 이 웹 파일을 앱에 그대로 복사해도 앱 내부 출처가 달라 API와 로그인은 연결되지 않습니다. 따라서 네이티브 준비 화면만 복사하며 원격 서버 주소, HTTP 허용, 범용 CORS 허용, 비밀번호 저장을 추가하지 않습니다. PWA 서비스 워커도 앱 준비 화면에는 포함하지 않습니다.

## Windows에서 프로젝트 확인

프로젝트 루트 PowerShell에서:

```powershell
. ./scripts/Use-DevTools.ps1
pnpm --filter @jochook-on/web native:sync:android
pnpm --filter @jochook-on/web native:copy:ios
pnpm --filter @jochook-on/web native:check
```

Android `sync`는 파일·네이티브 의존성 구성을 갱신합니다. Android SDK를 컴파일하거나 설치하지 않습니다. iOS `copy`는 준비 화면과 설정만 복사하며 Xcode 빌드를 검증하지 않습니다. 두 플랫폼 폴더는 이미 생성되어 있으므로 `native:add:android`·`native:add:ios`를 다시 실행할 필요가 없습니다. 생성 템플릿의 단순 덧셈 테스트와 다른 앱 ID를 기대하는 예제 테스트는 제외했습니다.

이번 Windows 환경에서도 `pnpm --filter @jochook-on/web native:sync:ios`의 파일 복사·SPM 구성 생성까지 확인했습니다. 실제 Swift 의존성 해결·컴파일·실행은 macOS/Xcode 환경에서 별도로 검증해야 합니다. `native:check`는 복사된 자산·설정만 검사합니다. 실제 단말 실행이나 스토어 심사 성공을 의미하지 않습니다.

2026-10-14 실행 결과: Android/iOS `add`, Android/iOS `sync`, iOS `copy`, `native:check` 통과. Android SDK 빌드, Xcode 빌드, 에뮬레이터·실기기 실행, 네이티브 로그인은 실행하지 않았습니다.

## 다음 연결 단계

1. 공개 HTTPS 서버와 네이티브 인증·세션·CSRF 방식을 설계하고 팀별 접근 권한을 검증합니다.
2. 웹 UI의 네이티브 진입점을 연결하고 초대 링크, 파일 업로드·다운로드, 안전 영역과 뒤로가기를 검증합니다.
3. Android SDK 및 macOS/Xcode 환경에서 실제 앱을 빌드하고 기기로 확인합니다.
4. 앱 ID, 아이콘·스플래시, 개인정보 안내와 스토어 요구사항을 확정합니다. 개발자 계정 비용·결제·출시는 별도 결정합니다.

## 공식 기준

- [Capacitor 8 설치](https://capacitorjs.com/docs/getting-started)
- [환경 요구사항](https://capacitorjs.com/docs/getting-started/environment-setup): Node 22 이상, Android Studio 2025.2.1 이상, iOS 빌드는 macOS와 Xcode 26 이상 필요
- [Capacitor 설정](https://capacitorjs.com/docs/config)

Android Studio/Xcode 설치, 유료 계정 신청, 서명키 생성 및 외부 업로드는 이 준비 작업에 포함하지 않습니다.
