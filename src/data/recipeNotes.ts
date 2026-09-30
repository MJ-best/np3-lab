/*
 * Curated notes for community recipes: full name, creator, release date, style
 * summary and recommended use. Nikon creator notes come from the Nikon Imaging
 * Cloud listing as collected in github.com/Timor88/NikonNP3; SerbanJPG notes
 * from serbanjpg.com. Keyed by source id + file name without extension.
 */

export interface RecipeNote {
  name: string;
  creator: string;
  released?: string;
  style: { ko: string; en: string };
  use?: { ko: string; en: string };
  /** Where the note comes from, shown for credit. */
  credit?: string;
}

const n = (
  name: string,
  creator: string,
  released: string | undefined,
  styleKo: string,
  styleEn: string,
  useKo?: string,
  useEn?: string,
): RecipeNote => ({
  name,
  creator,
  released,
  style: { ko: styleKo, en: styleEn },
  use: useKo ? { ko: useKo, en: useEn ?? useKo } : undefined,
});

/** shouryan01/Nikon-Recipes — "Nikon Creators" and "Color Grading" file stems. */
const NIKON: Record<string, RecipeNote> = {
  "MovieG&O_InstantF": n("Movie Green Orange", "Instant Film Studio", "2025-12-10", "영화 같은 그린/오렌지 대비", "Cinematic green/orange contrast", "단편 · 도시 스냅 · 커버", "Short films · city snaps · covers"),
  "24Look_24Frames": n("24Look", "24Frames", "2025-10-16", "24fps 영화 같은 느낌", "A 24fps movie look", "브이로그 · 단편 · 오프닝", "Vlogs · short films · openers"),
  "CINENigRed_Fuji": n("Cinematic Night-Red", "Kazu Fujisawa", "2025-09-25", "영화 같은 딥 레드", "Cinematic deep red", "인물 · 야경 · 단편", "Portraits · night scenes · short films"),
  "MV Green Orange_Woo": n("Movie Green Orange", "Noise Woo", "2025-02-19", "영화 같은 그린/오렌지 대비", "Cinematic green/orange contrast", "도시 스냅 · 단편", "City snaps · short films"),
  Negative_Cy_01a: n("Negative Film Cyan 01a", "Nikon", "2024-10-24", "시안 톤 네거티브 필름", "Cyan-toned negative film", "야경 · 실험 사진", "Night scenes · experimental"),
  ClrMode_TealOr_01b: n("Color Mode Teal & Orange 01b", "Nikon", "2024-10-24", "틸/오렌지 컬러 그레이딩", "Teal/orange color grading", "야경 · 스트리트", "Night scenes · street"),
  Golden_Grid_LKJ: n("Golden Grid", "Kyungjun Lee", "2026-02-25", "골드 톤 · 구조적인 톤", "Gold tones with a structured look", "건축 · 도시 · 기하학적 장면", "Architecture · city · geometry"),
  GoldenBrownSiinapse: n("Golden Brown", "Siinapse", "2025-12-10", "골든 브라운 · 빈티지", "Golden brown vintage", "인물 · 거리 · 추억", "Portraits · street · memories"),
  Catgrain_yw: n("Catgrain", "yomowasa", "2025-10-16", "미세한 그레인 · 부드러운 빈티지", "Fine grain, soft vintage", "반려동물 · 일상", "Pets · everyday"),
  CafeCat_yw: n("Café Cat", "yomowasa", "2025-10-16", "카페 같은 웜톤 · 생활감", "Warm café tones with a lived-in feel", "카페 · 실내 · 일상", "Cafés · indoors · everyday"),
  Yuragi_Hinami: n("Yuragi", "Kimura Hinami", "2025-10-16", "몽글몽글 부드러운 톤", "Soft and dreamy", "인물 · 보케 · 감성 사진", "Portraits · bokeh · mood"),
  VINTAGEFla_Fuji: n("Vintage Flash", "Kazu Fujisawa", "2025-09-25", "빈티지 플래시 필름", "Vintage flash film", "파티 · 야간 인물", "Parties · night portraits"),
  VINTAGEPort_Fuji: n("Vintage Portrait", "Kazu Fujisawa", "2025-09-25", "빈티지 홍콩풍 인물", "Vintage Hong Kong–style portraits", "인물 · 도시 · 스트리트", "Portraits · city · street"),
  FadedBlue_Hinami: n("Faded Blue Film", "Kimura Hinami", "2025-09-25", "페이드 블루 · 부드러운 안개", "Faded blue with a soft mist", "필름풍 인물 · 추억", "Film-style portraits · memories"),
  VitalityFilm_Pmango: n("Vitality Film", "Peng Mango", "2025-04-24", "선명하고 밝은 생동감", "Clear, bright and lively", "운동 · 야외 · 인물", "Sports · outdoors · portraits"),
  Filmic_Fabio: n("Filmic", "Fabio Oliveira", "2025-04-24", "균형 잡힌 클래식 필름", "Balanced classic film", "여행 · 일상 · 범용", "Travel · everyday · all-round"),
  Japanesque_Arashida: n("Japanesque Film", "Taishi Arashida", "2025-04-24", "차분하고 우아한 일본풍", "Calm, elegant Japanese mood", "건축 · 여행 · 문화", "Architecture · travel · culture"),
  VintageM_TSakai: n("Vintage Mellow", "Takahiro Sakai", "2024-10-24", "중성적이고 안정적인 빈티지", "Neutral, steady vintage", "인물 · 여행 · 범용", "Portraits · travel · all-round"),
  "Pale Tale_Yuri": n("Pale Tale", "Yuri", "2025-07-09", "페일 파스텔 · 이야기가 있는 톤", "Pale pastel storytelling", "일본풍 인물 · 일상", "Japanese-style portraits · everyday"),
  Heartwarming_YoheiS: n("Heartwarming", "Yohei Sawamura", "2025-04-24", "따뜻하고 부드러운 톤", "Warm and gentle", "가족 · 아이 · 반려동물", "Family · kids · pets"),
  MOSS_Nagisa: n("MOSS", "Nagisa Ichikawa", "2026-02-25", "모스 그린 · 낮은 채도", "Moss green, low saturation", "식물 · 비 오는 날 · 정물 · 풍경", "Plants · rainy days · still life · landscapes"),
  "Green Soul_Wong": n("Green Soul", "Wong", "2025-09-25", "맑고 편안한 그린", "Clear, calm greens", "숲 · 공원 · 야외", "Forests · parks · outdoors"),
  "Winter Hues_Eeva": n("Winter Hues", "Eeva Makinen", "2025-09-25", "담백한 겨울 쿨톤", "Clean wintry cool tones", "설경 · 겨울 인물", "Snowscapes · winter portraits"),
  AirGreen_Gunji: n("Air Green", "Takumi Gunji", "2025-02-19", "공기감 있는 깨끗한 그린", "Clean, airy greens", "인물 · 자연 · 야외", "Portraits · nature · outdoors"),
  QUIET_Nagisa: n("QUIET", "Nagisa Ichikawa", "2026-02-25", "절제된 저채도 · 고요함", "Restrained, low-saturation calm", "미니멀 인물 · 정물", "Minimal portraits · still life"),
  Vibrant_Lamoureux: n("Vibrant 2383", "Francois Lamoureux", "2025-09-25", "선명한 고채도 · 활력", "Vivid, high saturation, energetic", "행사 · 거리 · SNS", "Events · street · social media"),
  Summertime_Zerletti: n("Summertime", "Marcello Zerletti", "2025-09-25", "밝고 가벼운 여름", "Bright, light summer", "여행 · 바다 · 휴양", "Travel · beach · holidays"),
  Hidamari_Haruka: n("Hidamari Color", "Haruka Koharu", "2024-11-21", "햇살 같은 밝은 일본풍", "Sunny, bright Japanese style", "일상 인물 · 창가", "Everyday portraits · window light"),
  Bluegrain_jyota: n("Bluegrain", "jyota tomonori", "2026-02-25", "블루 톤 · 필름 그레인", "Blue tones with film grain", "거리 · 야경 · 감성 사진", "Street · night · mood"),
  PinkWater_HYEYA: n("Pink Watercolor", "HYEYA", "2026-02-25", "몽환적인 핑크 수채화", "Dreamy pink watercolor", "인물 · 봄 · 여름", "Portraits · spring · summer"),
  Cyanora_EyesOfBelga: n("Cyanora", "Eyes Of Belga", "2025-09-25", "몽환적인 시안/블루 쿨톤", "Dreamy cyan/blue cool tones", "야경 · SF 느낌 · 인물", "Night · sci-fi mood · portraits"),
  CRYSClear_Eisuke: n("Crystal Clear", "Eisuke Ishibashi", "2025-07-09", "맑고 투명한 밝은 톤", "Clear, bright and transparent", "풍경 · 정물 · 인물", "Landscapes · still life · portraits"),
};

const s = (styleKo: string, styleEn: string): Pick<RecipeNote, "style" | "creator"> => ({
  creator: "SerbanJPG",
  style: { ko: styleKo, en: styleEn },
});

/**
 * vanlong20it/recipe-note — SerbanJPG recipes. Set descriptions (LUX, Modern Chrome,
 * Kinochrome) are from serbanjpg.com; the rest describe the film stock the name refers to.
 */
const SERBAN: Record<string, Pick<RecipeNote, "style" | "creator">> = {
  "Kinochrome-S": s("시네마 + 80년대 아그파크롬 슬라이드에 대한 오마주", "An homage to cinema and 1980s Agfachrome slides"),
  "Agfacolor-S": s("아그파컬러 필름 느낌 (이름 기준)", "Agfacolor film look (from its name)"),
  "Fujicolor-S": s("후지컬러 필름 느낌 (이름 기준)", "Fujicolor film look (from its name)"),
  "Kodacolor-S": s("코닥컬러 필름 느낌 (이름 기준)", "Kodacolor film look (from its name)"),
  "PRO400H-Std": s("후지필름 PRO 400H 네거티브 필름 느낌 (이름 기준)", "Fujifilm PRO 400H negative film look (from its name)"),
  "PRO400H-Plus": s("후지필름 PRO 400H 느낌의 진한 버전 (이름 기준)", "A stronger take on Fujifilm PRO 400H (from its name)"),
  "Superia-Premium-400": s("후지필름 슈페리아 프리미엄 400 느낌 (이름 기준)", "Fujifilm Superia Premium 400 look (from its name)"),
  "Agfa-Optima-4": s("아그파 옵티마 네거티브 필름 느낌 (이름 기준)", "Agfa Optima negative film look (from its name)"),
  "Agfa-RSX-II-1": s("아그파 RSX II 슬라이드 필름 느낌 (이름 기준)", "Agfa RSX II slide film look (from its name)"),
  "Agfa-Ultra": s("아그파 울트라 필름 느낌 (이름 기준)", "Agfa Ultra film look (from its name)"),
  "Agfa-XPS-160-4": s("아그파 XPS 160 필름 느낌 (이름 기준)", "Agfa XPS 160 film look (from its name)"),
  "Agfachrome-Expired": s("유통기한 지난 아그파크롬 슬라이드 느낌 (이름 기준)", "Expired Agfachrome slide look (from its name)"),
  "Cinematic-Film-250D-1": s("250D 영화용 필름 느낌 (이름 기준)", "250D motion-picture film look (from its name)"),
  "Modern-Kodachrome": s("코다크롬을 현대적으로 해석 (이름 기준)", "A modern take on Kodachrome (from its name)"),
  "Modern-Chrome-Lo": s("깔끔하고 향수 어린 크롬 톤, 약한 버전", "Clean, nostalgic chrome palette, low variant"),
  "Modern-Chrome-Std": s("깔끔하고 향수 어린 크롬 톤, 기본 버전", "Clean, nostalgic chrome palette, standard variant"),
  "Modern-Chrome-Hi": s("깔끔하고 향수 어린 크롬 톤, 강한 버전", "Clean, nostalgic chrome palette, high variant"),
  "LUX-Chrome": s("라이카 룩에서 영감, 크롬", "Inspired by Leica Looks, chrome"),
  "LUX-Brass": s("라이카 룩에서 영감, 브라스", "Inspired by Leica Looks, brass"),
  "LUX-Eternal": s("라이카 룩에서 영감, 이터널", "Inspired by Leica Looks, eternal"),
  "LUX-B-W-HC": s("라이카 룩에서 영감, 고대비 흑백", "Inspired by Leica Looks, high-contrast black & white"),
};

export function noteFor(sourceId: string, stem: string): RecipeNote | undefined {
  if (sourceId === "shouryan01") {
    const note = NIKON[stem];
    return note && { ...note, credit: "Nikon Imaging Cloud (via Timor88/NikonNP3)" };
  }
  if (sourceId === "serbanjpg") {
    const entry = SERBAN[stem];
    const name = stem.replace(/--/g, " ").replace(/-/g, " ");
    return {
      name,
      creator: "SerbanJPG",
      style: entry?.style ?? { ko: "SerbanJPG 필름 에뮬레이션", en: "SerbanJPG film emulation" },
      use: { ko: "필름 느낌의 JPEG 촬영", en: "Film-style straight-out-of-camera JPEGs" },
      credit: "serbanjpg.com",
    };
  }
  return undefined;
}
