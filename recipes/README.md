# 내장 레시피 / Built-in recipes

이 폴더에 넣은 파일은 빌드할 때 앱에 포함되어 갤러리에 **기본** 레시피로 표시됩니다. 직접 만든 레시피나 배포 권한이 있는 레시피만 넣으세요.

## 커뮤니티 레시피

커뮤니티 레시피는 이 폴더에 넣지 않습니다. 사용자가 앱에서 **커뮤니티 레시피 받기**를 누르면 원본 저장소([shouryan01/Nikon-Recipes](https://github.com/shouryan01/Nikon-Recipes))에서 직접 받습니다. 레시피의 저작권이 Nikon과 각 크리에이터에게 있기 때문입니다. 자세한 내용은 [NOTICE.md](../NOTICE.md)를 보세요.

## 직접 추가하기

### NP3 파일

NX Studio 등에서 내보낸 `.NP3` 파일을 이 폴더(하위 폴더 포함)에 넣으면 됩니다. 제목은 파일 이름에서 가져오고, 파일은 원본 바이트 그대로 카드에 쓰입니다.

### JSON 파일

```json
{
  "id": "my-warm-film",
  "npName": "MY_WARM_FILM",
  "title": { "ko": "나의 웜 필름", "en": "My Warm Film" },
  "tags": ["portrait", "film"],
  "params": {
    "contrast": -15,
    "highlights": -25,
    "shadows": 15,
    "saturation": -8,
    "colorBlender": { "orange": { "hue": 4, "chroma": -6, "brightness": 6 } },
    "colorGrading": { "highlights": { "hue": 40, "chroma": 14, "brightness": 0 }, "blending": 60, "balance": 5 },
    "curvePoints": [{ "x": 0, "y": 20 }, { "x": 128, "y": 128 }, { "x": 255, "y": 245 }]
  }
}
```

| 필드 | 범위 |
| --- | --- |
| `npName` | 카메라에 표시되는 이름. 영문·숫자·공백·`_`·`-`, 1~19자 |
| `sharpning` | -3 ~ 9 (0.25 단위) |
| `midRangeSharpning`, `clarity` | -5 ~ 5 (0.25 단위) |
| `contrast`, `highlights`, `shadows`, `whiteLevel`, `blackLevel`, `saturation` | -100 ~ 100 |
| `colorBlender.<색>` | `red` `orange` `yellow` `green` `cyan` `blue` `purple` `magenta`, 각각 `hue`/`chroma`/`brightness` -100 ~ 100 |
| `colorGrading.<구간>` | `highlights` `midTone` `shadows`, `hue` 0 ~ 360, `chroma`/`brightness` -100 ~ 100 |
| `colorGrading.blending` / `balance` | 0 ~ 100 / -100 ~ 100 |
| `curvePoints` | 선택. 톤 커브 점(0~255, 최대 20개). 커브가 있으면 NP3 형식상 콘트라스트~블랙 레벨 값은 무시됩니다. |
