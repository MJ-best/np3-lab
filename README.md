# NP3 Lab

**니콘 Z 플렉시블 컬러 레시피(.NP3)를 SD카드에서 바로 관리하는 Mac 앱**입니다. 카드를 꽂으면 앱이 저절로 열리고, 카드 속 레시피를 보여주고, 원하는 레시피를 한 번에 넣고 뺍니다.

> ⚠️ **비공식 서드파티 도구입니다.** Nikon Corporation과 관련이 없고 Nikon의 보증이나 후원을 받지 않았습니다. Nikon, Nikon Z, Zf, Z8, Z9, Picture Control은 Nikon Corporation의 상표입니다. 자세한 내용은 [NOTICE.md](NOTICE.md)를 보세요.

[English](#english) · [다운로드 (Releases)](https://github.com/MJ-best/np3-lab/releases) · [출처와 라이선스](NOTICE.md)

![카드를 꽂으면 카드 속 레시피가 보입니다](docs/screenshots/card.jpg)

---

## 왜 만들었나

- **9개 슬롯의 벽:** Nikon Imaging Cloud는 레시피를 9개까지만 카메라로 보낼 수 있습니다. 새 레시피를 쓰려면 커스텀 슬롯으로 복사하고, 클라우드를 비우고, 다시 고르고, 다시 동기화하는 과정을 반복해야 합니다.
- **클라우드를 못 쓰는 기종:** Z8·Z9는 펌웨어 업데이트로 플렉시블 컬러를 지원하지만 Imaging Cloud는 쓸 수 없습니다. 레시피를 넣는 방법은 메모리 카드뿐입니다.
- **폴더를 직접 만들어야 하는 번거로움:** 카드에 `NIKON/CUSTOMPC` 폴더를 만들고 파일을 복사하는 일을 매번 손으로 해야 했습니다.

NP3 Lab을 쓰면 이렇게 됩니다. **카드 꽂기 → 레시피 넣기 → 꺼내기 → 카메라에서 불러오기**

## 주요 기능

| | |
| --- | --- |
| **카드 자동 인식** | 카드를 꽂으면 메뉴 막대에서 기다리던 앱이 열리고 `NIKON/CUSTOMPC` 속 레시피를 미리보기와 함께 보여줍니다. 다른 브랜드 카드와 네트워크 드라이브는 무시합니다. |
| **넣기·빼기·이름 바꾸기** | **＋ 레시피 넣기**로 여러 개를 한 번에 넣습니다. 번호(`PICCON01.NP3`…)는 자동으로 매기고 겹치지 않게 합니다. 카메라에 보일 이름을 바꿀 수 있고, 빼기는 휴지통으로 옮겨서 **되돌리기**가 됩니다. |
| **나만의 필터 라이브러리** | 레시피마다 그 레시피로 찍은 내 사진을 모아 갤러리로 봅니다. 니콘 사진을 창에 끌어다 놓으면 사진 정보에 기록된 Picture Control 이름으로 레시피를 찾아 **자동으로 정리**합니다. 사진이 있는 레시피는 대표 사진으로 표시되고 **📷 내 사진** 필터로 모아 볼 수 있습니다. |
| **자동 백업** | 카드에서 처음 보는 레시피는 내 레시피에 자동으로 보관합니다. 카드를 포맷해도 레시피가 남습니다. |
| **커뮤니티 레시피 260여 개** | Nikon 크리에이터 · Nikon 컬러 그레이딩 · 독립 크리에이터 · SerbanJPG 필름 레시피를 원본 저장소에서 바로 받습니다. 업데이트할 때는 바뀐 파일만 받습니다. 레시피마다 크리에이터·원본 링크와 함께 **설명·컨셉·추천 장면**이 표시되고 검색됩니다. |
| **미리보기 비교** | 풍경·피부톤·야경·컬러 차트나 내 사진 위에서 원본/적용을 슬라이더로 비교합니다. 레시피 수치로 계산한 근사치입니다. |
| **플렉시블 에디터** | 샤프닝, 명료도, 톤, 채도, 컬러 블렌더 8색, 컬러 그레이딩 3구간, 톤 커브(최대 20점)를 조절해 나만의 `.NP3`를 만듭니다. |
| **NX Studio에서 바로 가져오기** | NX Studio 등에서 NP3를 파일로 내보내면 어느 폴더에 저장했든 Spotlight로 찾아냅니다. 앱을 앞으로 가져오면 "새 NP3 n개 발견 · 가져오기" 알림이 뜨고, 가져오기 메뉴의 **이 Mac에서 NP3 찾기**로 최신 파일부터 볼 수도 있습니다. |
| **전체 레시피 내보내기** | 레시피 탭 맨 아래 **전체 레시피 내보내기 (NP3)**로 모든 레시피를 고른 폴더에 `My Recipes/`, `Community/<모음>/` 구조로 저장합니다. 기존 파일은 덮어쓰지 않습니다. 같은 이름에 내용이 다르면 `이름_20261001.NP3`처럼 날짜를 붙여 저장하고, 내용이 같으면 건너뜁니다. |
| **Reddit·텍스트 가져오기** | 커뮤니티에 글로 공유된 수치를 붙여넣으면 레시피 여러 개를 자동으로 나눠 가져옵니다(한국어·영어). |
| **기종별 불러오기 안내** | 카드를 뽑으면 Zf·Z6III·Z5II·Z50II·ZR·Z8·Z9별 메뉴 경로와 필요한 펌웨어를 보여줍니다. |

| 레시피 갤러리 | 원본/적용 비교 | 기종별 안내 |
| --- | --- | --- |
| ![](docs/screenshots/gallery.jpg) | ![](docs/screenshots/detail.jpg) | ![](docs/screenshots/guide.jpg) |

## 설치 (Mac)

1. [Releases](https://github.com/MJ-best/np3-lab/releases)에서 `NP3-Lab-x.y.z-arm64.dmg`를 받아 엽니다. Apple Silicon Mac, macOS 12 이상이 필요합니다.
2. **NP3 Lab**을 **응용 프로그램** 폴더로 끌어다 놓습니다.
3. 개인 프로젝트라 Apple 서명·공증을 받지 않았습니다. 처음 열 때 경고가 나오면 앱을 **우클릭 → 열기**를 누르거나, **시스템 설정 → 개인정보 보호 및 보안 → 그래도 열기**를 누르세요.
   - "손상되었기 때문에 열 수 없습니다"라고 나오면 터미널에서 아래 명령을 한 번 실행하세요.

```bash
xattr -cr "/Applications/NP3 Lab.app"
```

## 사용법

1. 앱을 열고 **레시피** 탭에서 **커뮤니티 레시피 받기**를 누릅니다. 처음 한 번만 하면 됩니다.
2. 카메라의 SD카드를 Mac에 꽂습니다. 앱이 열리고 카드 속 레시피가 나옵니다.
3. **＋ 레시피 넣기**로 원하는 레시피를 고르면 바로 카드에 저장됩니다.
4. **⏏ 꺼내기**를 누른 뒤 카드를 카메라에 넣고, 카메라에서 C-1~C-9 슬롯에 불러옵니다.
   - **Zf:** MENU → 사진 촬영 메뉴 → Picture Control 관리 → 저장/편집
   - **Z6III · Z5II · Z50II · ZR · Z8 · Z9:** MENU → 사진 촬영 메뉴 → Picture Control 관리 → 로드/저장 → 카메라에 복사
   - Zf는 FW 2.00 이상, Z8은 FW 3.00 이상, Z9는 FW 5.30 이상이 필요합니다. 다른 Z 기종은 플렉시블 컬러를 지원하지 않습니다.

- 창을 닫아도 앱은 **메뉴 막대**에서 카드를 기다리고, 로그인할 때 자동으로 실행됩니다. 이 동작은 **⚙︎ 설정**에서 끌 수 있습니다.
- 카메라 안의 슬롯은 여전히 C-1~C-9 9개입니다. 대신 카드에는 최대 99개를 넣어 두고 현장에서 언제든 바꿔 넣을 수 있습니다.

## 저작권과 레시피 출처

- 커뮤니티 레시피의 출처는 [shouryan01/Nikon-Recipes](https://github.com/shouryan01/Nikon-Recipes)와 [SerbanJPG](https://serbanjpg.com)([vanlong20it/recipe-note](https://github.com/vanlong20it/recipe-note) 경유)이고, 레시피 설명은 [Timor88/NikonNP3](https://github.com/Timor88/NikonNP3)를 참고했습니다. 자세한 내용은 [NOTICE.md](NOTICE.md)를 보세요. 레시피의 저작권은 **Nikon과 각 크리에이터**에게 있습니다.
- 원본 저장소에는 라이선스가 없어서, NP3 Lab은 레시피 파일을 **이 저장소와 배포 파일에 넣지 않습니다.** 사용자가 앱에서 버튼을 누르면 원본 저장소에서 직접 받아 자신의 컴퓨터에만 저장합니다.
- 받은 레시피는 개인 용도로 쓰고, 공유할 때는 크리에이터를 밝혀 주세요.
- 크리에이터나 저장소 관리자께서 제외를 원하시면 [이슈](https://github.com/MJ-best/np3-lab/issues)를 남겨 주세요.

## 알아둘 점

- **미리보기는 근사치입니다.** 니콘의 실제 처리 엔진이 아니라 레시피 수치로 계산한 결과입니다.
- **실기 검증:** Nikon Zf(펌웨어 3.01)에서 이 앱으로 카드에 넣은 NP3를 사진 촬영 메뉴 › Picture Control 관리 › 저장/편집으로 등록할 수 있음을 확인했습니다. Zf로 찍은 JPEG를 끌어다 놓으면 사진 정보(EXIF)로 촬영에 쓴 레시피를 찾아 정리하는 기능도 실제 파일로 확인했습니다. 다른 기종에서 확인하셨다면 이슈로 알려 주세요.
- NP3 쓰기는 커뮤니티가 역공학한 라이브러리를 사용합니다. 직접 만든 레시피는 중요한 촬영 전에 카메라에서 먼저 확인하세요. 카드에서 읽거나 커뮤니티에서 받은 파일은 원본 바이트 그대로 씁니다.
- NP3 형식상 톤 커브를 쓰면 콘트라스트·하이라이트·섀도·화이트/블랙 레벨은 저장되지 않습니다.

## 브라우저판

설치 없이 [Releases](https://github.com/MJ-best/np3-lab/releases)의 `NP3-Lab.html`을 Chrome이나 Edge로 열어도 대부분의 기능을 쓸 수 있습니다. Windows에서도 됩니다. 카드 자동 인식은 안 되고, 레시피를 담아 **SD카드에 바로 저장**(폴더 선택)하거나 **ZIP**으로 받습니다.

## 개발

Node.js 22 이상이 필요합니다.

```bash
npm install
```

```bash
npm run app:dev    # Mac 앱 개발 모드 (화면 수정이 바로 반영)
```

```bash
npm test           # 단위 테스트
```

```bash
npm run dist:mac   # release/에 설치용 DMG 생성
```

```bash
npm run build      # dist/NP3-Lab.html 브라우저판
```

- 직접 만든 레시피를 기본으로 넣으려면 `recipes/`에 JSON이나 `.NP3`를 두세요. 형식은 [recipes/README.md](recipes/README.md)를 보세요.
- 미리보기 사진을 바꾸려면 `samples/`에 사진을 넣으세요. [samples/README.md](samples/README.md)를 보세요.
- 구조: `electron/`(카드 감지·파일 작업·메뉴 막대), `src/cards.ts`(카드 동기화·자동 백업), `src/community.ts`(커뮤니티 레시피 받기·증분 업데이트), `src/data/recipeNotes.ts`(레시피 설명), `src/look.ts`(수치로 컨셉 분석), `src/np3/`(NP3 모델·톤 커브·텍스트 파서), `src/render/`(WebGL2 미리보기), `src/ui/`(화면).
- 버그 제보와 PR 환영합니다. Windows 지원(꺼내기, 안내 문구)은 도움이 필요한 부분입니다.

## 라이선스

코드는 [MIT](LICENSE)입니다. 사용한 오픈소스와 참고 자료, 상표 고지는 [NOTICE.md](NOTICE.md)에 정리했습니다.

---

## English

**NP3 Lab** is an unofficial Mac app for Nikon Z **Flexible Color Picture Controls (.NP3)**. It is not affiliated with Nikon Corporation.

- **Insert the SD card and it opens by itself.** You see the recipes in `NIKON/CUSTOMPC` with previews. You can add recipes (numbered `PICCON01.NP3`… automatically), rename them (the name shown on the camera), remove them to the Trash with Undo, and eject. The app waits in the menu bar and starts at login.
- **Automatic backup:** recipes found on a card are saved to My recipes.
- **Your own filter library:** keep the photos you shot with each recipe as its gallery. Drop Nikon JPEGs on the window and they're filed under the recipe named in their EXIF automatically.
- **260+ community recipes:** Nikon creators, Nikon color grading presets, independent creators and [SerbanJPG](https://serbanjpg.com) film recipes, downloaded in the app from [shouryan01/Nikon-Recipes](https://github.com/shouryan01/Nikon-Recipes) and [vanlong20it/recipe-note](https://github.com/vanlong20it/recipe-note). Updates only fetch changed files. Each recipe shows its creator, a link to the original file, and a searchable description, concept and recommended use (notes based on [Timor88/NikonNP3](https://github.com/Timor88/NikonNP3)).
- **Straight from NX Studio:** export a Picture Control to an NP3 file anywhere and NP3 Lab finds it with Spotlight. Bring the app forward to get a "new NP3 found · Import" prompt, or use Import → Find NP3 files on this Mac (newest first).
- **Export all recipes** as NP3 files into a folder (`My Recipes/`, `Community/<collection>/`). Existing files are never overwritten: a different file with the same name gets the date appended (`Name_20261001.NP3`), and unchanged recipes are skipped.
- **Editor, before/after preview, Reddit/text import, per-model camera instructions** (Zf, Z6III, Z5II, Z50II, ZR, Z8, Z9).

**Recipes and copyright.** The community recipes belong to Nikon and their creators, and the source repositories have no license. NP3 Lab does **not** include or redistribute any recipe files. Users download them from the original repository to their own computer. If you are a creator and prefer to be excluded, please [open an issue](https://github.com/MJ-best/np3-lab/issues).

**Install:** download the DMG from [Releases](https://github.com/MJ-best/np3-lab/releases) and drag the app to Applications. It's unsigned, so right-click → Open the first time, or run `xattr -cr "/Applications/NP3 Lab.app"`.

**Loading on the camera:**
- **Zf:** MENU → Photo shooting menu → Manage Picture Control → Save/edit
- **Z6III, Z5II, Z50II, ZR, Z8, Z9:** MENU → Photo shooting menu → Manage Picture Control → Load/save → Copy to camera

**Tested on hardware:** on a Nikon Zf (firmware 3.01), NP3 files put on the card by this app register via Save/edit, and Zf JPEGs dropped on the window are filed under the recipe in their EXIF. If you've tried another model, please let us know in an issue.

Code is [MIT](LICENSE). See [NOTICE.md](NOTICE.md) for third-party licenses, references and trademarks.
