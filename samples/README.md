# 미리보기 샘플 사진 / Preview sample photos

이 폴더에 사진을 넣고 `npm run build`를 하면 갤러리와 에디터의 **미리보기 장면**이 됩니다. 사진은 빌드된 `NP3-Lab.html` 안에 포함됩니다.

## 파일 이름 규칙

`번호-장면[-설명].jpg`처럼 짓습니다. 번호 순서대로 표시되고, 장면 이름은 아래 표에 있으면 자동으로 번역됩니다.

| 파일 이름 예시 | 표시 (KO / EN) |
| --- | --- |
| `01-portrait.jpg` | 인물 / Portrait |
| `02-outdoor.jpg` | 야외 / Outdoor |
| `03-indoor-cafe.jpg` | 실내 cafe / Indoor cafe |
| `04-night.jpg` | 야경 / Night |
| `05-food.jpg` | 음식 / Food |

그 밖에 인식하는 단어: `landscape`, `nature`, `street`, `product`, `sunset`, `snow`, `studio`, `people`, `cafe`.

## 권장 규격

- sRGB JPEG, 긴 변 2000px 이하, 1장당 1MB 이하. 파일이 크면 HTML도 그만큼 커집니다.
- 가능하면 카메라에서 **Neutral 또는 Flat** Picture Control로 촬영한 JPEG를 쓰세요. 앱은 이 사진을 "원본"으로 보고 레시피를 그 위에 근사 적용합니다.
- 공개 저장소에 올릴 때는 직접 찍었거나 재배포 권한이 있는 사진만 넣으세요. 인물 사진은 초상권 동의가 필요합니다.

사진이 하나도 없으면 앱이 직접 그린 테스트 장면(풍경·피부톤·야경·컬러 차트)을 대신 씁니다.
