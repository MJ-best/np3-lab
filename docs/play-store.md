# Google Play 스토어 제출 정보

Google Play Console에 그대로 붙여 넣는 값입니다. 앱 이름은 30자, 간단한 설명은 80자, 자세한 설명은 4,000자까지 쓸 수 있습니다.

## 공통

| 항목 | 값 |
|---|---|
| 패키지 이름 (`applicationId`) | `io.github.mj_best.np3lab` |
| 기본 언어 | 한국어 (`ko-KR`) |
| 앱 또는 게임 | 앱 |
| 유료 또는 무료 | 무료 |
| 카테고리 | 사진 (Photography) |
| 이메일 주소 | GitHub 프로필 또는 지원용 이메일 |
| 웹사이트 | https://np3-lab.web.app/ |
| 개인정보처리방침 URL | https://np3-lab.web.app/privacy.html |
| 앱 아이콘 | `build/icon.png` (512×512 PNG로 리사이즈 또는 원본 사용) |

## 앱 콘텐츠 (정책 및 선언)

Google Play Console 좌측 메뉴 **정책 및 프로그램 > 앱 콘텐츠**에서 아래 항목들을 순서대로 제출합니다:

1. **개인정보처리방침**: `https://np3-lab.web.app/privacy.html`
2. **광고**: "아니요, 앱에 광고가 포함되어 있지 않습니다."
3. **앱 액세스 권한**: "모든 기능이 특별한 액세스 권한 없이 이용 가능합니다." (로그인 불필요)
4. **콘텐츠 등급 (IARC 설문지)**:
   - 카테고리: 유틸리티, 생산성, 통신 또는 기타
   - 폭력성, 성적 콘텐츠, 욕설, 마약, 사용자 상호작용/공유 기능 등 **모든 질문에 "아니요"** 선택 → **전체이용가 (3+ / Everyone)**
5. **타겟층 및 콘텐츠**:
   - 타겟 연령층: **만 18세 이상** (또는 만 13~15세, 16~17세, 18세 이상 체크 — 어린이 타겟 앱이 아님을 명시하여 가족 정책 심사 제외)
6. **데이터 보안 (Data Safety)**:
   - "앱에서 필수 사용자 데이터 유형을 수집하거나 공유하나요?" → **아니요**
   - 계정·분석·광고 SDK가 없으며 모든 작업은 기기 내에서 수행됩니다.
7. **정부 앱 / 금융 기능 / 건강 앱**: 모두 **"아니요"** 선택

---

## 한국어 (`ko-KR`)

- **앱 이름** (30자 이내): `NP3 Lab`
- **간단한 설명** (80자 이내):
  ```
  니콘 Z 카메라의 Flexible Color 픽처 컨트롤 레시피(.NP3)를 모으고 편집해 SD 카드에 바로 넣으세요.
  ```
- **자세한 설명** (4,000자 이내):
  ```
  NP3 Lab은 니콘 Z 카메라의 픽처 컨트롤 레시피(.NP3)를 모으고 편집해 SD 카드에 넣는 앱입니다.

  • 레시피 둘러보기: 커뮤니티 레시피를 설명·컨셉과 함께 보고, 실제 사진에 적용한 모습으로 미리 봅니다.
  • 편집 (Rust WASM 가속): 톤 커브, 색상, 채도, 선명도 등 Flexible Color 값을 바꾸면 초고속 Rust 코어를 통해 미리보기가 즉시 바뀝니다.
  • 내 사진으로 확인: 사진(RAW NEF 포함)을 추가하면 촬영할 때 쓴 레시피별로 자동 정리됩니다.
  • SD 카드 직접 연결: USB-C 카드 리더기를 꽂고 카드 폴더를 한 번 고르면, 카메라가 읽는 위치(NIKON/CUSTOMPC)에 레시피를 바로 저장합니다.
  • NX Studio에서 만든 NP3 파일도 가져올 수 있습니다.
  • 계정·광고·추적이 없고, 오프라인에서 동작합니다.

  호환 기종:
  Zf, Z6III, Z5II, Z50II, ZR, Z8, Z9에서 Flexible Color(.NP3)를 바로 쓸 수 있습니다. Z5, Z6II, Z7II, Z fc 등 이전 기종에는 기본 픽처 컨트롤(.NCP)로 자동 변환해 넣을 수 있습니다.

  NP3 Lab은 Nikon과 관계없는 독립 오픈소스 앱입니다. Nikon, Picture Control, NX Studio는 Nikon Corporation의 상표입니다.
  ```

---

## English (`en-US`)

- **App name**: `NP3 Lab`
- **Short description** (80 chars max):
  ```
  Pick, tweak and copy Flexible Color recipes (.NP3) for Nikon Z to your SD card.
  ```
- **Full description**:
  ```
  NP3 Lab collects and edits Picture Control recipes (.NP3) for Nikon Z cameras and puts them straight on your SD card.

  • Browse recipes: community recipes with notes on their look, previewed on real photos.
  • Edit (Rust WASM accelerated): change the tone curve, colour, saturation, clarity and the rest of Flexible Color and watch the preview update instantaneously.
  • Try them on your photos: add photos (RAW NEF too) and they're sorted by the recipe they were shot with.
  • SD card support: plug in a USB-C SD card reader, pick the card folder once, and recipes are saved directly where the camera looks for them (NIKON/CUSTOMPC).
  • Import NP3 files made in NX Studio.
  • No account, no ads, no tracking. Works offline.

  Compatibility:
  Works with the Zf, Z6III, Z5II, Z50II, ZR, Z8 and Z9. For older bodies such as the Z5, Z6II, Z7II and Z fc, recipes are converted to original Picture Controls (.NCP).

  NP3 Lab is an independent app, not affiliated with Nikon. Nikon, Picture Control and NX Studio are trademarks of Nikon Corporation.
  ```

---

## 日本語 (`ja-JP`)

- **アプリ名**: `NP3 Lab`
- **簡単な説明** (80文字以内):
  ```
  ニコンZカメラのフレキシブルカラーのレシピ(.NP3)を選んで、調整して、そのままSDカードへ。
  ```
- **詳しい説明**:
  ```
  NP3 Labは、ニコンZカメラのピクチャーコントロール(.NP3)を集めて編集し、SDカードに入れるアプリです。

  • レシピを探す: コミュニティのレシピを、解説と実際の写真でのプレビュー付きで確認できます。
  • 編集 (Rust WASM高速処理): トーンカーブ、色相、彩度、明瞭度などフレキシブルカラーの値を変えると、プレビューがすぐに変わります。
  • 自分の写真で確認: 写真(RAW NEFも可)を追加すると、撮影に使ったレシピごとに自動で整理されます。
  • SDカード: カードリーダーを接続してフォルダーを一度選ぶと、カメラが読み込む場所(NIKON/CUSTOMPC)にレシピを保存します。
  • NX Studioで作ったNP3ファイルも読み込めます。
  • アカウント、広告、トラッキングはありません。オフラインで動作します。

  Zf、Z6III、Z5II、Z50II、ZR、Z8、Z9で使えます。Z5、Z6II、Z7II、Z fcなど以前の機種には、オリジナルのピクチャーコントロール(.NCP)に変換して入れます。

  NP3 Labはニコンとは関係のない独立したアプリです。Nikon、ピクチャーコントロール、NX Studioは株式会社ニコンの商標です。
  ```

---

## 빌드 및 업로드 순서

### 1. 업로드 서명 키(Keystore) 준비 (최초 1회)
`android/app/build.gradle`은 `~/.np3lab/keystore.properties` 파일을 자동으로 읽어 릴리즈 서명을 수행합니다.

아직 키가 없다면 터미널에서 아래 명령어로 생성합니다:
```bash
mkdir -p ~/.np3lab
keytool -genkeypair -v \
  -keystore ~/.np3lab/upload-key.jks \
  -alias np3lab \
  -keyalg RSA -keysize 2048 -validity 10000
```

그리고 `~/.np3lab/keystore.properties` 파일을 작성합니다:
```properties
storeFile=/Users/본인계정명/.np3lab/upload-key.jks
storePassword=설정한비밀번호
keyAlias=np3lab
keyPassword=설정한비밀번호
```
*(주의: 이 키 파일과 비밀번호는 향후 업데이트 시 계속 필요하므로 안전하게 백업해 두세요.)*

### 2. Google Play 업로드용 AAB 빌드
프로젝트 루트에서 아래 한 줄을 실행하면 버전(`0.7.0`, `versionCode 700`)에 맞춰 웹 빌드, Capacitor 동기화, 서명된 `.aab` 번들 생성이 완료됩니다:
```bash
npm run aab:release
```
- **생성된 파일 경로**: `android/app/build/outputs/bundle/release/app-release.aab`
- *(직접 설치용 APK가 필요할 때는 `npm run apk:release`를 실행하세요 → `android/app/build/outputs/apk/release/app-release.apk`)*

### 3. Google Play Console에 업로드
1. [Google Play Console](https://play.google.com/console/) > **NP3 Lab** 선택
2. **테스트 및 출시 > 프로덕션** (또는 비공개 테스트) > **새 버전 만들기**
3. **App Bundle** 영역에 `android/app/build/outputs/bundle/release/app-release.aab` 파일을 드래그하여 업로드
4. 출시 노트에 버전 변경사항 입력 후 **다음 > 출시 시작** 클릭
