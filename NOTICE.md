# Notices, sources and credits / 고지·출처·감사

## 이 저장소의 라이선스 / License of this repository

NP3 Lab의 소스 코드와 문서는 [MIT License](LICENSE)로 공개합니다. 레시피 파일(.NP3)은 이 저장소와 배포 파일(DMG·HTML)에 **들어 있지 않습니다**.

The source code and documentation of NP3 Lab are released under the [MIT License](LICENSE). No recipe (.NP3) files are included in this repository or in the released DMG/HTML.

## 상표 / Trademarks

Nikon, Nikon Z, Zf, Z8, Z9, Picture Control, NX Studio, Nikon Imaging Cloud 등은 Nikon Corporation의 상표 또는 등록상표입니다. NP3 Lab은 **비공식 서드파티 도구**로, Nikon Corporation과 관련이 없으며 Nikon의 보증이나 후원을 받지 않았습니다. 제품명은 호환 기종을 설명하기 위해서만 사용합니다.

Nikon, Nikon Z, Zf, Z8, Z9, Picture Control, NX Studio and Nikon Imaging Cloud are trademarks or registered trademarks of Nikon Corporation. NP3 Lab is an **unofficial third-party tool**; it is not affiliated with, endorsed by or sponsored by Nikon Corporation. Product names are used only to describe compatibility.

## 커뮤니티 레시피 / Community recipes

- 출처 / Sources:
  - **[shouryan01/Nikon-Recipes](https://github.com/shouryan01/Nikon-Recipes)**: Nikon 크리에이터 · Nikon 컬러 그레이딩 · NikonPC · 독립 크리에이터 레시피. Nikon creators, Nikon color grading, NikonPC and independent creators.
  - **[SerbanJPG](https://serbanjpg.com)** 필름 레시피. [vanlong20it/recipe-note](https://github.com/vanlong20it/recipe-note)의 `assets/presets/serbanjpg`에서 받습니다. SerbanJPG film recipes, downloaded from `assets/presets/serbanjpg` in vanlong20it/recipe-note. SerbanJPG가 무료로 공개한 레시피이며 저작권은 SerbanJPG에게 있습니다. Published free by SerbanJPG, who owns them.
  - 레시피 설명(이름·크리에이터·공개일·스타일·추천 장면) / Recipe notes (name, creator, release date, style, recommended use): Nikon Imaging Cloud 목록을 정리한 [Timor88/NikonNP3](https://github.com/Timor88/NikonNP3)를 참고해 짧게 요약했습니다. SerbanJPG 세트 설명은 serbanjpg.com을 참고했고, 그 밖의 SerbanJPG 설명은 이름이 가리키는 필름을 적은 것입니다. Summarised from Timor88/NikonNP3's list of Nikon Imaging Cloud recipes; SerbanJPG set descriptions follow serbanjpg.com, and the others describe the film stock in the name.
  - 설명이 없는 레시피의 "컨셉"은 앱이 레시피 수치로 자동 분석한 것입니다. The "concept" of recipes without notes is analysed by the app from the recipe values.
  - 레시피를 모아 공개해 주신 분들께 감사드립니다. Thanks to everyone who collected and published these recipes.
- 이 저장소들에는 라이선스가 없고, 레시피의 저작권은 **Nikon과 각 크리에이터**에게 있습니다. 예를 들어 Nikon Creators·Color Grading 폴더는 Nikon Imaging Cloud의 공식 레시피이고, Mark G Adams 레시피에는 "All recipes copyright Mark G Adams"라는 안내가 있습니다.
  The source repositories have no license. The recipes belong to **Nikon and their creators**: the Nikon Creators and Color Grading folders are official Nikon Imaging Cloud recipes, and the Mark G Adams recipes state "All recipes copyright Mark G Adams".
- 그래서 NP3 Lab은 레시피를 **재배포하지 않습니다.** 사용자가 앱에서 **커뮤니티 레시피 받기**를 누르면 원본 저장소(GitHub, 또는 그 미러인 jsDelivr)에서 직접 받아 사용자의 컴퓨터에만 저장합니다. 앱은 각 레시피의 크리에이터와 원본 파일 링크를 함께 표시합니다.
  NP3 Lab therefore does **not redistribute** them. When a user clicks **Get community recipes**, the app downloads them from the original GitHub repositories (or their jsDelivr mirror) to that user's computer only, and shows each recipe's creator and a link to the original file.
- 크리에이터나 저장소 관리자가 앱에서 받지 않기를 원하시면 이슈를 남겨 주세요. 바로 반영하겠습니다. If a creator or the maintainer prefers the app not to download their work, please open an issue and it will be removed promptly.

## 참고한 자료 / References

- [ssssota/nikon-flexible-color-picture-control](https://github.com/ssssota/nikon-flexible-color-picture-control) (MIT): NP3 파일 읽기/쓰기 라이브러리. Library used to read and write NP3 files.
- [Nikon 온라인 매뉴얼 / Nikon online manuals](https://onlinemanual.nikonimglib.com/): 기종별 Picture Control 메뉴 경로와 메모리 카드 폴더 구조(`NIKON/CUSTOMPC`). Menu paths and the memory-card folder layout.
- [NX Studio 도움말 / NX Studio help](https://nikonimglib.com/nxstdo/onlinehelp/en/copy_custom_picture_controls_50.html): 카드당 NP3 99개(01–99) 규칙. The 99-files-per-card (01–99) rule.

## 사용한 오픈소스 / Third-party software

| Package | License | Used for |
| --- | --- | --- |
| [nikon-flexible-color-picture-control](https://github.com/ssssota/nikon-flexible-color-picture-control) | MIT | NP3 read/write |
| [Preact](https://github.com/preactjs/preact), [@preact/signals](https://github.com/preactjs/signals) | MIT | UI |
| [JSZip](https://github.com/Stuk/jszip) | MIT or GPL-3.0-or-later (MIT chosen) | ZIP export |
| [Electron](https://github.com/electron/electron) | MIT (bundles Chromium; see `LICENSES.chromium.html` inside the app) | Mac app |
| [Vite](https://github.com/vitejs/vite), [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile), [@preact/preset-vite](https://github.com/preactjs/preset-vite) | MIT | Build |
| [electron-builder](https://github.com/electron-userland/electron-builder) | MIT | Packaging |
| [Vitest](https://github.com/vitest-dev/vitest) | MIT | Tests |
| [TypeScript](https://github.com/microsoft/TypeScript) | Apache-2.0 | Type checking |

미리보기 장면(풍경·피부톤·야경·컬러 차트)과 앱 아이콘은 이 프로젝트에서 코드로 직접 그린 것입니다. The preview scenes and the app icon are drawn procedurally by this project.
