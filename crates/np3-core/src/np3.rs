use crate::ncp::{ncp_to_params, parse_ncp};
use crate::tone_curve::{CurvePoint, ToneCurve, RAW_LENGTH};
use serde::{Deserialize, Serialize};

pub const BASE_NP3: &[u8] = include_bytes!("../assets/base.bin");
pub const TONE_CURVE_EXTENSION: &[u8] = include_bytes!("../assets/curve_ext.bin");
pub const NP_NAME_MAX: usize = 19;
pub const COMMENT_MAX: usize = 256;

const TONE_CURVE_SENTINEL_OFFSETS: [usize; 5] = [272, 282, 292, 302, 312];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct ColorBlenderValues {
    pub hue: i16,
    pub chroma: i16,
    pub brightness: i16,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct ColorBlender {
    pub red: Option<ColorBlenderValues>,
    pub orange: Option<ColorBlenderValues>,
    pub yellow: Option<ColorBlenderValues>,
    pub green: Option<ColorBlenderValues>,
    pub cyan: Option<ColorBlenderValues>,
    pub blue: Option<ColorBlenderValues>,
    pub purple: Option<ColorBlenderValues>,
    pub magenta: Option<ColorBlenderValues>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct ColorGradingValues {
    pub hue: u16,
    pub chroma: i16,
    pub brightness: i16,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ColorGrading {
    pub highlights: Option<ColorGradingValues>,
    pub mid_tone: Option<ColorGradingValues>,
    pub shadows: Option<ColorGradingValues>,
    pub blending: i16,
    pub balance: i16,
}

impl Default for ColorGrading {
    fn default() -> Self {
        Self {
            highlights: None,
            mid_tone: None,
            shadows: None,
            blending: 50,
            balance: 0,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct RecipeParams {
    pub sharpning: f32,
    pub mid_range_sharpning: f32,
    pub clarity: f32,
    pub contrast: i16,
    pub highlights: i16,
    pub shadows: i16,
    pub white_level: i16,
    pub black_level: i16,
    pub saturation: i16,
    pub color_blender: ColorBlender,
    pub color_grading: ColorGrading,
    pub tone_curve: Option<ToneCurve>,
    pub comment: Option<String>,
}

impl Default for RecipeParams {
    fn default() -> Self {
        Self {
            sharpning: 2.0,
            mid_range_sharpning: 1.0,
            clarity: 0.5,
            contrast: 0,
            highlights: 0,
            shadows: 0,
            white_level: 0,
            black_level: 0,
            saturation: 0,
            color_blender: ColorBlender::default(),
            color_grading: ColorGrading {
                highlights: None,
                mid_tone: None,
                shadows: None,
                blending: 50,
                balance: 0,
            },
            tone_curve: None,
            comment: None,
        }
    }
}

pub fn default_params() -> RecipeParams {
    RecipeParams::default()
}

use unicode_normalization::UnicodeNormalization;

pub fn sanitize_np_name(input: &str) -> String {
    let mut out = String::new();
    let mut last_was_underscore = false;

    for ch in input.nfkd() {
        if ('\u{0300}'..='\u{036f}').contains(&ch) {
            continue;
        }
        if ch.is_ascii_alphanumeric() || ch == ' ' || ch == '-' {
            out.push(ch);
            last_was_underscore = false;
        } else {
            if !last_was_underscore {
                out.push('_');
                last_was_underscore = true;
            }
        }
    }

    let trimmed = out.trim_matches(|c: char| c == ' ' || c == '_');
    let truncated = if trimmed.len() > NP_NAME_MAX {
        &trimmed[..NP_NAME_MAX]
    } else {
        trimmed
    };
    let final_clean = truncated.trim_matches(|c: char| c == ' ' || c == '_');

    if final_clean.is_empty() {
        "RECIPE".to_string()
    } else {
        final_clean.to_string()
    }
}

pub fn is_valid_np_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= NP_NAME_MAX
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == ' ' || c == '_' || c == '-')
}

#[inline]
fn clamp_i16(v: i16, min: i16, max: i16) -> i16 {
    v.clamp(min, max)
}

#[inline]
fn snap_f32(v: f32, step: f32) -> f32 {
    (v / step).round() * step
}

pub fn normalize_params(mut p: RecipeParams) -> RecipeParams {
    p.sharpning = snap_f32(p.sharpning.clamp(-3.0, 9.0), 0.25);
    p.mid_range_sharpning = snap_f32(p.mid_range_sharpning.clamp(-5.0, 5.0), 0.25);
    p.clarity = snap_f32(p.clarity.clamp(-5.0, 5.0), 0.25);

    let norm_blender_val = |v: Option<ColorBlenderValues>| -> Option<ColorBlenderValues> {
        let v = v?;
        let h = clamp_i16(v.hue, -100, 100);
        let c = clamp_i16(v.chroma, -100, 100);
        let b = clamp_i16(v.brightness, -100, 100);
        if h == 0 && c == 0 && b == 0 {
            None
        } else {
            Some(ColorBlenderValues {
                hue: h,
                chroma: c,
                brightness: b,
            })
        }
    };

    p.color_blender.red = norm_blender_val(p.color_blender.red);
    p.color_blender.orange = norm_blender_val(p.color_blender.orange);
    p.color_blender.yellow = norm_blender_val(p.color_blender.yellow);
    p.color_blender.green = norm_blender_val(p.color_blender.green);
    p.color_blender.cyan = norm_blender_val(p.color_blender.cyan);
    p.color_blender.blue = norm_blender_val(p.color_blender.blue);
    p.color_blender.purple = norm_blender_val(p.color_blender.purple);
    p.color_blender.magenta = norm_blender_val(p.color_blender.magenta);

    p.color_grading.blending = clamp_i16(p.color_grading.blending, 0, 100);
    p.color_grading.balance = clamp_i16(p.color_grading.balance, -100, 100);

    let norm_grading_val = |v: Option<ColorGradingValues>| -> Option<ColorGradingValues> {
        let v = v?;
        let h = (v.hue % 360) as u16;
        let c = clamp_i16(v.chroma, -100, 100);
        let b = clamp_i16(v.brightness, -100, 100);
        if h == 0 && c == 0 && b == 0 {
            None
        } else {
            Some(ColorGradingValues {
                hue: h,
                chroma: c,
                brightness: b,
            })
        }
    };

    p.color_grading.highlights = norm_grading_val(p.color_grading.highlights);
    p.color_grading.mid_tone = norm_grading_val(p.color_grading.mid_tone);
    p.color_grading.shadows = norm_grading_val(p.color_grading.shadows);

    if let Some(ref mut tc) = p.tone_curve {
        if tc.raw.len() == RAW_LENGTH {
            for v in tc.raw.iter_mut() {
                *v = (*v).min(32767);
            }
            tc.points.truncate(20);
            p.contrast = 0;
            p.highlights = 0;
            p.shadows = 0;
            p.white_level = 0;
            p.black_level = 0;
        } else {
            p.tone_curve = None;
        }
    }

    if p.tone_curve.is_none() {
        p.contrast = clamp_i16(p.contrast, -100, 100);
        p.highlights = clamp_i16(p.highlights, -100, 100);
        p.shadows = clamp_i16(p.shadows, -100, 100);
        p.white_level = clamp_i16(p.white_level, -100, 100);
        p.black_level = clamp_i16(p.black_level, -100, 100);
    }

    p.saturation = clamp_i16(p.saturation, -100, 100);

    if let Some(ref c) = p.comment {
        let stripped: String = c.chars().filter(|&ch| ch != '\0').take(COMMENT_MAX).collect();
        p.comment = if stripped.is_empty() {
            None
        } else {
            Some(stripped)
        };
    }

    p
}

/// Serialize a Flexible Color Picture Control (.NP3) binary.
pub fn serialize_np3(name: &str, params: &RecipeParams) -> Vec<u8> {
    let p = normalize_params(params.clone());
    let mut out = BASE_NP3.to_vec();

    // 1. Write Name (offset 24..43, max 19 bytes)
    let clean_name = sanitize_np_name(name);
    let name_bytes = clean_name.as_bytes();
    for i in 0..19 {
        out[24 + i] = if i < name_bytes.len() {
            name_bytes[i]
        } else {
            0
        };
    }

    // 2. Write Scalars
    out[82] = (128.0 + p.sharpning.clamp(-3.0, 9.0) * 4.0).round() as u8;
    out[242] = (128.0 + p.mid_range_sharpning.clamp(-5.0, 5.0) * 4.0).round() as u8;
    out[92] = (128.0 + p.clarity.clamp(-5.0, 5.0) * 4.0).round() as u8;

    out[272] = (128 + clamp_i16(p.contrast, -100, 100)) as u8;
    out[282] = (128 + clamp_i16(p.highlights, -100, 100)) as u8;
    out[292] = (128 + clamp_i16(p.shadows, -100, 100)) as u8;
    out[302] = (128 + clamp_i16(p.white_level, -100, 100)) as u8;
    out[312] = (128 + clamp_i16(p.black_level, -100, 100)) as u8;
    out[322] = (128 + clamp_i16(p.saturation, -100, 100)) as u8;

    // 3. Write Color Blender
    let write_blender = |buf: &mut [u8], offset: usize, val: Option<ColorBlenderValues>| {
        let v = val.unwrap_or_default();
        buf[offset] = (128 + clamp_i16(v.hue, -100, 100)) as u8;
        buf[offset + 1] = (128 + clamp_i16(v.chroma, -100, 100)) as u8;
        buf[offset + 2] = (128 + clamp_i16(v.brightness, -100, 100)) as u8;
    };
    write_blender(&mut out, 332, p.color_blender.red);
    write_blender(&mut out, 335, p.color_blender.orange);
    write_blender(&mut out, 338, p.color_blender.yellow);
    write_blender(&mut out, 341, p.color_blender.green);
    write_blender(&mut out, 344, p.color_blender.cyan);
    write_blender(&mut out, 347, p.color_blender.blue);
    write_blender(&mut out, 350, p.color_blender.purple);
    write_blender(&mut out, 353, p.color_blender.magenta);

    // 4. Write Color Grading
    let write_grading = |buf: &mut [u8], offset: usize, val: Option<ColorGradingValues>| {
        let v = val.unwrap_or_default();
        let norm_hue = (v.hue % 360) as u16;
        buf[offset] = (128 + (norm_hue >> 8)) as u8;
        buf[offset + 1] = (norm_hue & 255) as u8;
        buf[offset + 2] = (128 + clamp_i16(v.chroma, -100, 100)) as u8;
        buf[offset + 3] = (128 + clamp_i16(v.brightness, -100, 100)) as u8;
    };
    write_grading(&mut out, 368, p.color_grading.highlights);
    write_grading(&mut out, 372, p.color_grading.mid_tone);
    write_grading(&mut out, 376, p.color_grading.shadows);

    out[384] = (128 + clamp_i16(p.color_grading.blending, -100, 100)) as u8;
    out[386] = (128 + clamp_i16(p.color_grading.balance, -100, 100)) as u8;

    // 5. Write Comment if present
    let has_curve = p.tone_curve.is_some();
    let next_chunk = if has_curve { 2u32 } else { 0u32 };

    if let Some(ref comment) = p.comment {
        if !comment.is_empty() {
            let encoded = comment.as_bytes();
            let mut payload_len = encoded.len() + 1;
            if payload_len % 2 != 0 {
                payload_len += 1;
            }
            let mut payload = vec![0u8; payload_len];
            payload[..encoded.len()].copy_from_slice(encoded);

            out[389] = 1;
            out[390] = 1;

            out.extend_from_slice(&(payload_len as u32).to_be_bytes());
            out.extend_from_slice(&payload);
            out.extend_from_slice(&next_chunk.to_be_bytes());
        }
    }

    // 6. Write Tone Curve if present
    if let Some(ref curve) = p.tone_curve {
        let tone_curve_start = out.len();
        out.extend_from_slice(TONE_CURVE_EXTENSION);

        // Apply Tone Curve Header flags
        for &offset in &TONE_CURVE_SENTINEL_OFFSETS {
            out[offset] = 1;
        }
        if p.comment.as_deref().unwrap_or("").is_empty() {
            out[391] = 2;
        }

        let offset_delta = tone_curve_start - BASE_NP3.len();

        // Write curve points
        let count = curve.points.len().min(20);
        out[404 + offset_delta] = count as u8;
        for i in 0..count {
            let pt = curve.points[i];
            let pt_off = 404 + offset_delta + 1 + i * 2;
            out[pt_off] = pt.x;
            out[pt_off + 1] = pt.y;
        }

        // Write 257 curve samples
        for i in 0..curve.raw.len().min(RAW_LENGTH) {
            let val = curve.raw[i].min(32767);
            let raw_off = 460 + offset_delta + i * 2;
            out[raw_off..raw_off + 2].copy_from_slice(&val.to_be_bytes());
        }
    }

    out
}

/// Parse a Flexible Color Picture Control (.NP3) binary.
pub fn deserialize_np3(buf: &[u8]) -> Option<(String, RecipeParams)> {
    if buf.len() < BASE_NP3.len() {
        return None;
    }
    if &buf[0..4] != b"NCP\0" {
        return None;
    }

    // Read Name
    let raw_name = String::from_utf8_lossy(&buf[24..43]);
    let name = raw_name.split('\0').next().unwrap_or("").trim().to_string();

    // Read Scalars
    let sharpning = ((buf[82] as f32) - 128.0) / 4.0;
    let mid_range_sharpning = ((buf[242] as f32) - 128.0) / 4.0;
    let clarity = ((buf[92] as f32) - 128.0) / 4.0;

    // Read Comment and Tone Curve Start
    let mut comment = None;
    let mut tone_curve_start = None;

    if buf[389] == 1 && buf[390] == 1 && buf.len() >= BASE_NP3.len() + 8 {
        let payload_len = u32::from_be_bytes([buf[392], buf[393], buf[394], buf[395]]) as usize;
        let payload_end = 396 + payload_len;
        if payload_end + 4 <= buf.len() {
            let comment_slice = &buf[396..payload_end];
            let end_idx = comment_slice.iter().position(|&b| b == 0).unwrap_or(comment_slice.len());
            let c_str = String::from_utf8_lossy(&comment_slice[..end_idx]).to_string();
            if !c_str.is_empty() {
                comment = Some(c_str);
            }
            let next_chunk = u32::from_be_bytes([buf[payload_end], buf[payload_end + 1], buf[payload_end + 2], buf[payload_end + 3]]);
            if next_chunk == 2 && buf.len() >= payload_end + 4 + TONE_CURVE_EXTENSION.len() {
                tone_curve_start = Some(payload_end + 4);
            }
        }
    } else if buf[391] == 2 && buf.len() >= BASE_NP3.len() + TONE_CURVE_EXTENSION.len() {
        tone_curve_start = Some(BASE_NP3.len());
    }

    let has_curve_flag = tone_curve_start.is_some();

    let contrast = if has_curve_flag {
        0
    } else {
        (buf[272] as i16) - 128
    };
    let highlights = if has_curve_flag {
        0
    } else {
        (buf[282] as i16) - 128
    };
    let shadows = if has_curve_flag {
        0
    } else {
        (buf[292] as i16) - 128
    };
    let white_level = if has_curve_flag {
        0
    } else {
        (buf[302] as i16) - 128
    };
    let black_level = if has_curve_flag {
        0
    } else {
        (buf[312] as i16) - 128
    };
    let saturation = (buf[322] as i16) - 128;

    // Read Color Blender
    let read_blender = |offset: usize| -> Option<ColorBlenderValues> {
        let h = (buf[offset] as i16) - 128;
        let c = (buf[offset + 1] as i16) - 128;
        let b = (buf[offset + 2] as i16) - 128;
        if h == 0 && c == 0 && b == 0 {
            None
        } else {
            Some(ColorBlenderValues {
                hue: h,
                chroma: c,
                brightness: b,
            })
        }
    };

    let color_blender = ColorBlender {
        red: read_blender(332),
        orange: read_blender(335),
        yellow: read_blender(338),
        green: read_blender(341),
        cyan: read_blender(344),
        blue: read_blender(347),
        purple: read_blender(350),
        magenta: read_blender(353),
    };

    // Read Color Grading
    let read_grading = |offset: usize| -> Option<ColorGradingValues> {
        let h = (((buf[offset] & 15) as u16) << 8) | (buf[offset + 1] as u16);
        let c = (buf[offset + 2] as i16) - 128;
        let b = (buf[offset + 3] as i16) - 128;
        if h == 0 && c == 0 && b == 0 {
            None
        } else {
            Some(ColorGradingValues {
                hue: h,
                chroma: c,
                brightness: b,
            })
        }
    };

    let color_grading = ColorGrading {
        highlights: read_grading(368),
        mid_tone: read_grading(372),
        shadows: read_grading(376),
        blending: (buf[384] as i16) - 128,
        balance: (buf[386] as i16) - 128,
    };

    let mut tone_curve = None;
    if let Some(start) = tone_curve_start {
        let offset_delta = start - BASE_NP3.len();
        let point_count = buf[404 + offset_delta] as usize;
        let mut points = Vec::with_capacity(point_count);
        for i in 0..point_count.min(20) {
            let pt_off = 404 + offset_delta + 1 + i * 2;
            points.push(CurvePoint {
                x: buf[pt_off],
                y: buf[pt_off + 1],
            });
        }

        let mut raw = Vec::with_capacity(RAW_LENGTH);
        for i in 0..RAW_LENGTH {
            let r_off = 460 + offset_delta + i * 2;
            if r_off + 2 <= buf.len() {
                let v = u16::from_be_bytes([buf[r_off], buf[r_off + 1]]);
                raw.push(v);
            }
        }
        if raw.len() == RAW_LENGTH {
            tone_curve = Some(ToneCurve { raw, points });
        }
    }

    let params = normalize_params(RecipeParams {
        sharpning,
        mid_range_sharpning,
        clarity,
        contrast,
        highlights,
        shadows,
        white_level,
        black_level,
        saturation,
        color_blender,
        color_grading,
        tone_curve,
        comment,
    });

    Some((name, params))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PcFormat {
    Flexible,
    Np3,
    Np2,
    Ncp,
}

pub fn pc_format(bytes: &[u8]) -> Option<PcFormat> {
    if bytes.len() < 16 || &bytes[0..4] != b"NCP\0" {
        return None;
    }
    let version = std::str::from_utf8(&bytes[12..16]).ok()?;
    if version == "0310" {
        Some(PcFormat::Flexible)
    } else if version.starts_with("01") {
        Some(PcFormat::Ncp)
    } else if version.starts_with("02") {
        Some(PcFormat::Np2)
    } else {
        Some(PcFormat::Np3)
    }
}

pub fn with_np_name(bytes: &[u8], name: &str) -> Vec<u8> {
    let clean = sanitize_np_name(name);
    let mut out = bytes.to_vec();
    let at = if out.len() >= 24 && out[18] == 0x02 && out[23] == 20 {
        24
    } else {
        16
    };
    if at + 20 <= out.len() {
        out[at..at + 20].fill(0);
        let b = clean.as_bytes();
        let copy_len = b.len().min(19);
        out[at..at + copy_len].copy_from_slice(&b[..copy_len]);
    }
    out
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedNp3 {
    pub np_name: String,
    pub params: Option<RecipeParams>,
    pub note: Option<String>,
}

pub fn parse_np3(bytes: &[u8]) -> Result<ParsedNp3, &'static str> {
    let format = pc_format(bytes).ok_or("not-np3")?;
    let at = if bytes.len() >= 24 && bytes[18] == 0x02 && bytes[23] == 20 {
        24
    } else {
        16
    };
    let end = (at + 19).min(bytes.len());
    let raw_name = String::from_utf8_lossy(&bytes[at..end]);
    let clean_name = raw_name
        .split('\0')
        .next()
        .unwrap_or("")
        .chars()
        .filter(|c| c.is_ascii_graphic() || *c == ' ')
        .collect::<String>()
        .trim()
        .to_string();
    let np_name = if clean_name.is_empty() {
        "IMPORTED".to_string()
    } else {
        clean_name
    };

    if format == PcFormat::Ncp {
        if let Some(ncp) = parse_ncp(bytes) {
            return Ok(ParsedNp3 {
                np_name,
                params: Some(normalize_params(ncp_to_params(&ncp))),
                note: None,
            });
        } else {
            return Ok(ParsedNp3 {
                np_name,
                params: None,
                note: Some("unsupported-version".to_string()),
            });
        }
    }

    if format != PcFormat::Flexible || bytes.len() < BASE_NP3.len() {
        return Ok(ParsedNp3 {
            np_name,
            params: None,
            note: Some("unsupported-version".to_string()),
        });
    }

    if let Some((_, params)) = deserialize_np3(bytes) {
        Ok(ParsedNp3 {
            np_name,
            params: Some(params),
            note: None,
        })
    } else {
        Ok(ParsedNp3 {
            np_name,
            params: None,
            note: Some("unsupported-version".to_string()),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tone_curve::tone_curve_from_points;

    #[test]
    fn test_np3_round_trip() {
        let sample = RecipeParams {
            sharpning: 1.5,
            mid_range_sharpning: -0.75,
            clarity: 1.25,
            contrast: -12,
            highlights: -30,
            shadows: 18,
            white_level: 5,
            black_level: 10,
            saturation: -8,
            color_blender: ColorBlender {
                red: Some(ColorBlenderValues {
                    hue: 6,
                    chroma: -10,
                    brightness: 3,
                }),
                blue: Some(ColorBlenderValues {
                    hue: -12,
                    chroma: 20,
                    brightness: -5,
                }),
                ..Default::default()
            },
            color_grading: ColorGrading {
                highlights: Some(ColorGradingValues {
                    hue: 45,
                    chroma: 12,
                    brightness: 0,
                }),
                shadows: Some(ColorGradingValues {
                    hue: 210,
                    chroma: 9,
                    brightness: -4,
                }),
                blending: 60,
                balance: -10,
                ..Default::default()
            },
            comment: Some("테스트 comment".to_string()),
            ..Default::default()
        };

        let bytes = serialize_np3("TEST_RECIPE", &sample);
        let parsed = parse_np3(&bytes).expect("Should parse");
        assert_eq!(parsed.np_name, "TEST_RECIPE");

        let p = parsed.params.unwrap();
        assert_eq!(p.sharpning, 1.5);
        assert_eq!(p.mid_range_sharpning, -0.75);
        assert_eq!(p.clarity, 1.25);
        assert_eq!(p.contrast, -12);
        assert_eq!(p.highlights, -30);
        assert_eq!(p.shadows, 18);
        assert_eq!(p.white_level, 5);
        assert_eq!(p.black_level, 10);
        assert_eq!(p.saturation, -8);
        assert_eq!(p.color_blender.red, sample.color_blender.red);
        assert_eq!(p.color_blender.blue, sample.color_blender.blue);
        assert_eq!(p.color_grading.highlights, sample.color_grading.highlights);
        assert_eq!(p.color_grading.shadows, sample.color_grading.shadows);
        assert_eq!(p.color_grading.blending, 60);
        assert_eq!(p.color_grading.balance, -10);
        assert_eq!(p.comment.as_deref(), Some("테스트 comment"));
    }

    #[test]
    fn test_np3_tone_curve_round_trip() {
        let mut sample = default_params();
        let pts = [
            CurvePoint { x: 0, y: 20 },
            CurvePoint { x: 128, y: 120 },
            CurvePoint { x: 255, y: 250 },
        ];
        sample.tone_curve = Some(tone_curve_from_points(&pts));
        sample.comment = Some("테스트 comment".to_string());

        let bytes = serialize_np3("CURVE", &sample);
        let parsed = parse_np3(&bytes).unwrap();
        assert_eq!(parsed.np_name, "CURVE");
        let p = parsed.params.unwrap();
        assert_eq!(p.contrast, 0); // zeroed when tone curve present
        let tc = p.tone_curve.unwrap();
        assert_eq!(tc.points, pts);
        assert_eq!(tc.raw.len(), 257);
        assert_eq!(p.comment.as_deref(), Some("테스트 comment"));
    }

    #[test]
    fn test_magic_and_version() {
        let bytes = serialize_np3("HDR", &default_params());
        assert_eq!(&bytes[0..3], b"NCP");
        assert_eq!(&bytes[12..16], b"0310");
    }

    #[test]
    fn test_with_np_name() {
        let orig = serialize_np3("OLD_NAME", &default_params());
        let renamed = with_np_name(&orig, "NEW_NAME");
        let parsed = parse_np3(&renamed).unwrap();
        assert_eq!(parsed.np_name, "NEW_NAME");
    }

    #[test]
    fn test_sanitize_name() {
        assert_eq!(sanitize_np_name("따뜻한 필름"), "RECIPE");
        assert_eq!(sanitize_np_name("Café Film/400!"), "Cafe Film_400");
    }
}
