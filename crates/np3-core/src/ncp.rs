use crate::np3::{ColorBlender, ColorGrading, ColorGradingValues, RecipeParams};
use crate::tone_curve::{CurvePoint, RAW_LENGTH, RAW_MAX};
use serde::{Deserialize, Serialize};

pub const NCP_SIZE: usize = 638;
const CURVE_AT: usize = 0x78;
const NEUTRAL: [u8; 4] = [0x03, 0xc2, 0x02, 0xff];
const MONO: [u8; 4] = [0x06, 0x4d, 0x00, 0xff];
const STEP: f32 = 100.0 / 3.0;
const HUE_STEP: i16 = 12;
const TONING_HUE: [u16; 10] = [0, 40, 215, 0, 60, 120, 170, 230, 260, 320];

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct NcpParams {
    pub mono: bool,
    /// 0..9
    pub sharpening: i16,
    /// -3..3; colour bases only.
    pub saturation: i16,
    /// -3..3; colour bases only.
    pub hue: i16,
    /// Monochrome filter: 0 off, 1 yellow, 2 orange, 3 red, 4 green.
    pub filter: i16,
    /// Monochrome toning: 0 black & white, 1 sepia, 2 cyanotype, 3 red … 9 red purple.
    pub toning: i16,
    /// 257 values, 0..32767.
    pub curve: Vec<u16>,
    pub points: Vec<CurvePoint>,
}

#[inline]
fn clamp_f64(v: f64, min: f64, max: f64) -> f64 {
    v.clamp(min, max)
}

fn smooth(a: f64, b: f64, x: f64) -> f64 {
    let t = clamp_f64((x - a) / (b - a), 0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

fn inv_smooth(v: f64) -> f64 {
    0.5 - (1.0 - 2.0 * clamp_f64(v, 0.0, 1.0)).asin().sin() / 3.0
}

fn tone_at(x: f64, p: &RecipeParams) -> f64 {
    let k = (p.contrast as f64) / 100.0;
    let c = if k >= 0.0 {
        x + (smooth(0.0, 1.0, x) - x) * k
    } else {
        x + (inv_smooth(x) - x) * -k * 0.85
    };
    let d = ((p.highlights as f64) / 100.0) * 0.24 * smooth(0.45, 1.0, c)
        + ((p.shadows as f64) / 100.0) * 0.2 * smooth(0.0, 0.1, c) * (1.0 - smooth(0.1, 0.55, c))
        + ((p.white_level as f64) / 100.0) * 0.14 * smooth(0.6, 1.0, c)
        + ((p.black_level as f64) / 100.0) * 0.1 * (1.0 - smooth(0.0, 0.35, c));
    clamp_f64(c + d, 0.0, 1.0)
}

fn curve_from(f: impl Fn(f64) -> f64) -> Vec<u16> {
    let mut out = Vec::with_capacity(RAW_LENGTH);
    for i in 0..RAW_LENGTH {
        let x = (i as f64) / 256.0;
        let y = clamp_f64(f(x), 0.0, 1.0);
        out.push((y * (RAW_MAX as f64)).round() as u16);
    }
    out
}

fn points_of(curve: &[u16]) -> Vec<CurvePoint> {
    let xs = [0u8, 32, 64, 96, 128, 160, 192, 224, 255];
    xs.iter()
        .map(|&x| {
            let idx = ((x as usize) * 256 + 127) / 255;
            let val = curve[idx.min(256)] as f64;
            let y = ((val / (RAW_MAX as f64)) * 255.0).round() as u8;
            CurvePoint { x, y }
        })
        .collect()
}

pub fn is_ncp(b: &[u8]) -> bool {
    b.len() >= NCP_SIZE
        && b[0] == 0x4e
        && b[1] == 0x43
        && b[2] == 0x50
        && b[3] == 0
        && &b[12..16] == b"0100"
}

pub fn parse_ncp(b: &[u8]) -> Option<NcpParams> {
    if !is_ncp(b) {
        return None;
    }
    let mono = b[0x24] == 0x06 && b[0x25] == 0x4d;

    let step = |v: u8, min: i16, max: i16| -> i16 {
        if v == 0xff || v == 0x01 {
            0
        } else {
            ((v as i16) - 0x80).clamp(min, max)
        }
    };

    let mut curve = Vec::with_capacity(RAW_LENGTH);
    for i in 0..RAW_LENGTH {
        let off = CURVE_AT + 2 * i;
        let val = u16::from_be_bytes([b[off], b[off + 1]]).min(RAW_MAX);
        curve.push(val);
    }

    if b[0x29] != 0x01 {
        let contrast = (step(b[0x29], -3, 3) as f32 * STEP) as i16;
        let brightness = step(b[0x2a], -1, 1) as f64;
        let dummy_p = RecipeParams {
            contrast,
            ..Default::default()
        };
        curve = curve_from(|x| {
            tone_at(x, &dummy_p) + brightness * 0.06 * (std::f64::consts::PI * x).sin()
        });
    }

    let mut points = Vec::new();
    let point_count = (b[0x40] as usize).min(20);
    for i in 0..point_count {
        points.push(CurvePoint {
            x: b[0x41 + 2 * i],
            y: b[0x42 + 2 * i],
        });
    }

    let final_points = if points.len() >= 2 {
        points
    } else {
        points_of(&curve)
    };

    Some(NcpParams {
        mono,
        sharpening: step(b[0x28], 0, 9),
        saturation: if mono { 0 } else { step(b[0x2b], -3, 3) },
        hue: if mono { 0 } else { step(b[0x2c], -3, 3) },
        filter: if mono { step(b[0x2d], 0, 4) } else { 0 },
        toning: if mono { step(b[0x2e], 0, 9) } else { 0 },
        curve,
        points: final_points,
    })
}

pub fn ncp_bytes(name: &str, p: &NcpParams) -> Vec<u8> {
    let mut b = vec![0u8; NCP_SIZE];
    b[0..16].copy_from_slice(&[
        0x4e, 0x43, 0x50, 0, 0, 0, 0, 1, 0, 0, 0, 0x24, b'0', b'1', b'0', b'0',
    ]);

    let clean_name: String = name
        .chars()
        .filter(|c| c.is_ascii_graphic() || *c == ' ')
        .take(19)
        .collect();
    let nb = clean_name.as_bytes();
    b[0x10..0x10 + nb.len()].copy_from_slice(nb);

    if p.mono {
        b[0x24..0x28].copy_from_slice(&MONO);
    } else {
        b[0x24..0x28].copy_from_slice(&NEUTRAL);
    }

    let s = |v: i16| -> u8 { (0x80 + v) as u8 };
    b[0x28] = s(p.sharpening);
    b[0x29] = 0x01;
    b[0x2a] = 0x01;
    b[0x2b] = if p.mono { 0xff } else { s(p.saturation) };
    b[0x2c] = if p.mono { 0xff } else { s(p.hue) };
    b[0x2d] = if p.mono { s(p.filter) } else { 0xff };
    b[0x2e] = if p.mono { s(p.toning) } else { 0xff };
    b[0x2f] = 0xff;

    b[0x30..0x40].copy_from_slice(&[
        0, 0, 0, 2, 0, 0, 0x02, 0x42, 0x49, 0x30, 0x00, 0xff, 0x00, 0xff, 0x01, 0x00,
    ]);

    let count = p.points.len().min(20);
    b[0x40] = count as u8;
    for i in 0..count {
        b[0x41 + 2 * i] = p.points[i].x;
        b[0x42 + 2 * i] = p.points[i].y;
    }

    for (i, &v) in p.curve.iter().enumerate().take(RAW_LENGTH) {
        let val = v.min(RAW_MAX);
        let off = CURVE_AT + 2 * i;
        b[off..off + 2].copy_from_slice(&val.to_be_bytes());
    }

    b
}

pub fn to_ncp(p: &RecipeParams) -> NcpParams {
    let mono = p.saturation <= -100;
    let curve = if let Some(ref tc) = p.tone_curve {
        if tc.raw.len() == RAW_LENGTH {
            tc.raw.clone()
        } else {
            curve_from(|x| tone_at(x, p))
        }
    } else {
        curve_from(|x| tone_at(x, p))
    };

    let blender = &p.color_blender;
    let all_bands = [
        blender.red,
        blender.orange,
        blender.yellow,
        blender.green,
        blender.cyan,
        blender.blue,
        blender.purple,
        blender.magenta,
    ];
    let mut total_chroma = 0.0f64;
    for b in all_bands {
        if let Some(v) = b {
            total_chroma += v.chroma as f64;
        }
    }
    let chroma = total_chroma / 8.0;

    let light = |val: Option<crate::np3::ColorBlenderValues>| -> f64 {
        val.map(|v| v.brightness as f64).unwrap_or(0.0)
    };
    let warm = (light(blender.red) + light(blender.orange) + light(blender.yellow)) / 3.0
        - (light(blender.blue) + light(blender.cyan)) / 2.0;

    let filter = if !mono {
        0
    } else if light(blender.green) - light(blender.red) > 25.0 {
        4
    } else if warm > 45.0 {
        3
    } else if warm > 25.0 {
        2
    } else if warm > 10.0 {
        1
    } else {
        0
    };

    let sat_step = ((((p.saturation as f64) + chroma * 0.85) / (STEP as f64)).round() as i16)
        .clamp(-3, 3);

    NcpParams {
        mono,
        sharpening: (p.sharpning.round() as i16).clamp(0, 9),
        saturation: if mono { 0 } else { sat_step },
        hue: 0,
        filter,
        toning: 0,
        points: points_of(&curve),
        curve,
    }
}

pub fn ncp_to_params(n: &NcpParams) -> RecipeParams {
    let mut blender = ColorBlender::default();
    if n.hue != 0 {
        let v = Some(crate::np3::ColorBlenderValues {
            hue: n.hue * HUE_STEP,
            chroma: 0,
            brightness: 0,
        });
        blender.red = v;
        blender.orange = v;
        blender.yellow = v;
        blender.green = v;
        blender.cyan = v;
        blender.blue = v;
        blender.purple = v;
        blender.magenta = v;
    }

    let tint = if n.mono && n.toning > 0 && (n.toning as usize) < TONING_HUE.len() {
        Some(ColorGradingValues {
            hue: TONING_HUE[n.toning as usize],
            chroma: 12,
            brightness: 0,
        })
    } else {
        None
    };

    let grading = if let Some(t) = tint {
        ColorGrading {
            blending: 50,
            balance: 0,
            shadows: Some(t),
            mid_tone: Some(t),
            highlights: Some(t),
        }
    } else {
        ColorGrading {
            blending: 50,
            balance: 0,
            shadows: None,
            mid_tone: None,
            highlights: None,
        }
    };

    let sat = if n.mono {
        -100
    } else {
        ((n.saturation as f32) * STEP).round() as i16
    };

    RecipeParams {
        sharpning: n.sharpening as f32,
        mid_range_sharpning: 1.0,
        clarity: 0.5,
        contrast: 0,
        highlights: 0,
        shadows: 0,
        white_level: 0,
        black_level: 0,
        saturation: sat,
        color_blender: blender,
        color_grading: grading,
        tone_curve: Some(crate::tone_curve::ToneCurve {
            raw: n.curve.clone(),
            points: n.points.clone(),
        }),
        comment: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::np3::{default_params, normalize_params};

    #[test]
    fn test_ncp_round_trip() {
        let linear: Vec<u16> = (0..257)
            .map(|i| ((i as f64 / 256.0) * (RAW_MAX as f64)).round() as u16)
            .collect();

        let color = NcpParams {
            mono: false,
            sharpening: 5,
            saturation: -1,
            hue: 1,
            filter: 0,
            toning: 0,
            curve: linear,
            points: vec![CurvePoint { x: 0, y: 12 }, CurvePoint { x: 255, y: 240 }],
        };

        let b = ncp_bytes("PORTRA LIKE", &color);
        assert_eq!(b.len(), 638);
        assert_eq!(&b[0..3], b"NCP");
        assert_eq!(&b[12..16], b"0100");
        assert_eq!(&b[16..27], b"PORTRA LIKE");

        let parsed = parse_ncp(&b).expect("Should parse NCP");
        assert_eq!(parsed, color);
    }

    #[test]
    fn test_monochrome_ncp() {
        let linear: Vec<u16> = (0..257)
            .map(|i| ((i as f64 / 256.0) * (RAW_MAX as f64)).round() as u16)
            .collect();

        let mono = NcpParams {
            mono: true,
            sharpening: 5,
            saturation: 0,
            hue: 0,
            filter: 1,
            toning: 0,
            curve: linear,
            points: vec![CurvePoint { x: 0, y: 12 }, CurvePoint { x: 255, y: 240 }],
        };

        let b = ncp_bytes("TMAX", &mono);
        assert_eq!(parse_ncp(&b).unwrap(), mono);
    }

    #[test]
    fn test_to_ncp_conversion() {
        let mut p = default_params();
        p.contrast = 40;
        p.highlights = -50;
        p.saturation = 40;
        let norm = normalize_params(p);
        let ncp = to_ncp(&norm);
        assert!(!ncp.mono);
        assert_eq!(ncp.saturation, 1);
    }
}
