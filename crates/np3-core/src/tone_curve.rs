use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub const MAX_CURVE_POINTS: usize = 20;
pub const RAW_LENGTH: usize = 257;
pub const RAW_MAX: u16 = 32767;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct CurvePoint {
    pub x: u8,
    pub y: u8,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ToneCurve {
    pub raw: Vec<u16>,
    pub points: Vec<CurvePoint>,
}

pub const IDENTITY_POINTS: [CurvePoint; 2] = [
    CurvePoint { x: 0, y: 0 },
    CurvePoint { x: 255, y: 255 },
];

pub fn clean_points(points: &[CurvePoint]) -> Vec<CurvePoint> {
    let mut by_x = BTreeMap::new();
    for p in points {
        by_x.insert(p.x, p.y);
    }
    let sorted: Vec<CurvePoint> = by_x.into_iter().map(|(x, y)| CurvePoint { x, y }).collect();
    if sorted.is_empty() {
        return IDENTITY_POINTS.to_vec();
    }
    if sorted.len() == 1 {
        let y = sorted[0].y;
        return vec![CurvePoint { x: 0, y }, CurvePoint { x: 255, y }];
    }
    sorted.into_iter().take(MAX_CURVE_POINTS).collect()
}

/// Monotone cubic interpolation (Fritsch–Carlson).
pub fn make_interpolator(points: &[CurvePoint]) -> impl Fn(f64) -> f64 {
    let pts = clean_points(points);
    let n = pts.len();
    let xs: Vec<f64> = pts.iter().map(|p| p.x as f64).collect();
    let ys: Vec<f64> = pts.iter().map(|p| p.y as f64).collect();

    let mut d = Vec::with_capacity(n - 1);
    let mut m = vec![0.0f64; n];

    for i in 0..n - 1 {
        let dx = xs[i + 1] - xs[i];
        d.push(if dx == 0.0 { 0.0 } else { (ys[i + 1] - ys[i]) / dx });
    }

    if !d.is_empty() {
        m[0] = d[0];
        m[n - 1] = d[n - 2];
    }

    for i in 1..n - 1 {
        m[i] = if d[i - 1] * d[i] <= 0.0 {
            0.0
        } else {
            (d[i - 1] + d[i]) / 2.0
        };
    }

    for i in 0..n - 1 {
        if d[i] == 0.0 {
            m[i] = 0.0;
            m[i + 1] = 0.0;
            continue;
        }
        let a = m[i] / d[i];
        let b = m[i + 1] / d[i];
        let s = a * a + b * b;
        if s > 9.0 {
            let t = 3.0 / s.sqrt();
            m[i] = t * a * d[i];
            m[i + 1] = t * b * d[i];
        }
    }

    move |x: f64| -> f64 {
        if x <= xs[0] {
            return ys[0];
        }
        if x >= xs[n - 1] {
            return ys[n - 1];
        }

        let mut i = 0;
        while i < n - 2 && x > xs[i + 1] {
            i += 1;
        }

        let h = xs[i + 1] - xs[i];
        if h == 0.0 {
            return ys[i];
        }
        let t = (x - xs[i]) / h;
        let t2 = t * t;
        let t3 = t2 * t;

        (2.0 * t3 - 3.0 * t2 + 1.0) * ys[i]
            + (t3 - 2.0 * t2 + t) * h * m[i]
            + (-2.0 * t3 + 3.0 * t2) * ys[i + 1]
            + (t3 - t2) * h * m[i + 1]
    }
}

pub fn points_to_raw(points: &[CurvePoint]) -> Vec<u16> {
    let f = make_interpolator(points);
    let mut raw = Vec::with_capacity(RAW_LENGTH);
    for i in 0..RAW_LENGTH {
        let input_x = (i as f64 / 256.0) * 255.0;
        let y = f(input_x) / 255.0;
        let clamped = y.clamp(0.0, 1.0);
        let val = (clamped * (RAW_MAX as f64)).round() as u16;
        raw.push(val);
    }
    raw
}

pub fn tone_curve_from_points(points: &[CurvePoint]) -> ToneCurve {
    let clean = clean_points(points);
    ToneCurve {
        raw: points_to_raw(&clean),
        points: clean,
    }
}

pub fn is_identity_curve(curve: Option<&ToneCurve>) -> bool {
    let curve = match curve {
        Some(c) => c,
        None => return true,
    };
    if curve.raw.len() != RAW_LENGTH {
        return false;
    }
    curve.raw.iter().enumerate().all(|(i, &v)| {
        let expected = (i as f64 / 256.0) * (RAW_MAX as f64);
        ((v as f64) - expected).abs() < 64.0
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_identity_curve() {
        let raw = points_to_raw(&IDENTITY_POINTS);
        assert_eq!(raw.len(), 257);
        assert_eq!(raw[0], 0);
        assert_eq!(raw[256], 32767);
        let tc = tone_curve_from_points(&IDENTITY_POINTS);
        assert!(is_identity_curve(Some(&tc)));
    }

    #[test]
    fn test_monotone_presets() {
        let s_curve = [
            CurvePoint { x: 0, y: 0 },
            CurvePoint { x: 64, y: 50 },
            CurvePoint { x: 192, y: 208 },
            CurvePoint { x: 255, y: 255 },
        ];
        let raw = points_to_raw(&s_curve);
        for i in 1..raw.len() {
            assert!(raw[i] >= raw[i - 1]);
        }
    }

    #[test]
    fn test_control_points_pass_through() {
        let pts = [CurvePoint { x: 0, y: 30 }, CurvePoint { x: 255, y: 230 }];
        let raw = points_to_raw(&pts);
        assert_eq!(raw[0], ((30.0f64 / 255.0f64) * 32767.0f64).round() as u16);
        assert_eq!(raw[256], ((230.0f64 / 255.0f64) * 32767.0f64).round() as u16);
    }

    #[test]
    fn test_cleans_unsorted_and_duplicate() {
        let input = [
            CurvePoint { x: 10, y: 10 },
            CurvePoint { x: 10, y: 20 },
            CurvePoint { x: 255, y: 0 },
        ];
        let cleaned = clean_points(&input);
        assert_eq!(
            cleaned,
            vec![CurvePoint { x: 10, y: 20 }, CurvePoint { x: 255, y: 0 }]
        );
    }
}
