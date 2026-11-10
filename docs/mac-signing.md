# Mac 앱 서명과 공증 (Developer ID)

GitHub Releases의 Mac 앱(Tauri DMG)은 `v*` 태그를 올리면 GitHub Actions(`.github/workflows/release.yml`)가 빌드합니다. 아래 비밀 값이 있으면 빌드할 때 Developer ID로 서명하고 Apple 공증을 받습니다. 공증된 앱은 "손상되었기 때문에 열 수 없습니다" 경고 없이 열립니다. 비밀 값이 없으면 예전처럼 서명 없이 빌드됩니다.

## 한 번만 하는 준비 (계정 소유자)

1. **Developer ID 인증서:** Xcode > 설정 > Accounts > Apple ID 선택 > Manage Certificates… > 왼쪽 아래 ＋ > Developer ID Application.
2. **앱 암호:** [account.apple.com](https://account.apple.com) > 로그인 및 보안 > 앱 암호 > ＋ (이름: `np3lab-notary`). 나온 암호를 복사해 둡니다.
3. **인증서 내보내기:** 키체인 접근 > 로그인 > 내 인증서 > "Developer ID Application: …"을 우클릭 > 내보내기 > `.p12`로 저장합니다(암호를 새로 정합니다). 예: 데스크탑의 `devid.p12`.
4. **GitHub 비밀 값:** 터미널에서 아래를 차례로 실행하고, 물으면 값을 붙여 넣습니다(화면에 보이지 않습니다).

```bash
base64 -i ~/Desktop/devid.p12 | gh secret set APPLE_CERTIFICATE --repo MJ-best/np3-lab
gh secret set APPLE_CERTIFICATE_PASSWORD --repo MJ-best/np3-lab
gh secret set APPLE_ID --repo MJ-best/np3-lab
gh secret set APPLE_PASSWORD --repo MJ-best/np3-lab
rm ~/Desktop/devid.p12
```

`APPLE_CERTIFICATE_PASSWORD`는 3에서 정한 암호, `APPLE_ID`는 Apple ID 이메일, `APPLE_PASSWORD`는 2의 앱 암호입니다. 팀 ID(`29MWCVNN48`)는 워크플로에 들어 있습니다.

## 확인

Actions > Multiplatform Release > Run workflow로 브랜치를 골라 돌리면 릴리스는 올리지 않고 빌드 결과만 남깁니다(태그로 실행될 때만 릴리스를 올립니다).

```bash
gh run download <실행 ID> --repo MJ-best/np3-lab -n artifacts-macos
hdiutil attach "NP3 Lab_0.7.0_aarch64.dmg"
spctl -a -vvv -t exec "/Volumes/NP3 Lab/NP3 Lab.app"   # source=Notarized Developer ID
xcrun stapler validate "/Volumes/NP3 Lab/NP3 Lab.app"
```
