use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhotoExif {
    pub make: Option<String>,
    pub model: Option<String>,
    pub lens: Option<String>,
    /// mm
    pub focal: Option<f64>,
    pub f_number: Option<f64>,
    /// seconds
    pub exposure: Option<f64>,
    pub iso: Option<u32>,
    /// "YYYY:MM:DD HH:MM:SS" as the camera wrote it.
    pub date: Option<String>,
}

const MAX_ENTRIES: usize = 1000;

#[derive(Debug, Clone, Copy)]
struct Entry {
    entry_type: u16,
    count: u32,
    at: usize,
}

/// Where the TIFF structure starts: 0 for a NEF, inside APP1 for a JPEG; None if there is none.
fn tiff_start(b: &[u8]) -> Option<usize> {
    if b.is_empty() {
        return None;
    }
    if b[0] == 0x49 || b[0] == 0x4d {
        return Some(0);
    }
    if b.len() < 4 || b[0] != 0xff || b[1] != 0xd8 {
        return None;
    }
    let mut o = 2;
    while o + 4 <= b.len() && b[o] == 0xff {
        let marker = b[o + 1];
        let len = ((b[o + 2] as usize) << 8) | (b[o + 3] as usize);
        // APP1 "Exif\0\0"
        if marker == 0xe1
            && o + 8 <= b.len()
            && b[o + 4] == 0x45
            && b[o + 5] == 0x78
            && b[o + 6] == 0x69
            && b[o + 7] == 0x66
            && o + 10 <= b.len()
        {
            return Some(o + 10);
        }
        if marker == 0xda || len < 2 {
            return None;
        }
        o += 2 + len;
    }
    None
}

#[inline]
fn read_u16(bytes: &[u8], offset: usize, le: bool) -> Option<u16> {
    if offset + 2 > bytes.len() {
        return None;
    }
    let b = [bytes[offset], bytes[offset + 1]];
    Some(if le {
        u16::from_le_bytes(b)
    } else {
        u16::from_be_bytes(b)
    })
}

#[inline]
fn read_u32(bytes: &[u8], offset: usize, le: bool) -> Option<u32> {
    if offset + 4 > bytes.len() {
        return None;
    }
    let b = [
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
    ];
    Some(if le {
        u32::from_le_bytes(b)
    } else {
        u32::from_be_bytes(b)
    })
}

pub fn read_exif(bytes: &[u8]) -> Option<PhotoExif> {
    let base = tiff_start(bytes)?;
    if base + 8 > bytes.len() {
        return None;
    }

    let le = bytes[base] == 0x49;
    if read_u16(bytes, base + 2, le)? != 42 {
        return None;
    }

    let ifd = |offset: usize| -> HashMap<u16, Entry> {
        let mut out = HashMap::new();
        let start = base + offset;
        let n = match read_u16(bytes, start, le) {
            Some(v) => (v as usize).min(MAX_ENTRIES),
            None => return out,
        };

        for i in 0..n {
            let e = start + 2 + i * 12;
            if e + 12 > bytes.len() {
                break;
            }
            let tag = match read_u16(bytes, e, le) {
                Some(t) => t,
                None => break,
            };
            let entry_type = match read_u16(bytes, e + 2, le) {
                Some(t) => t,
                None => break,
            };
            let count = match read_u32(bytes, e + 4, le) {
                Some(c) => c,
                None => break,
            };

            let type_size = match entry_type {
                1 | 2 | 6 | 7 => 1,
                3 | 8 => 2,
                4 | 9 | 11 => 4,
                5 | 10 | 12 => 8,
                _ => 1,
            };
            let size = (type_size as usize) * (count as usize);
            let at = if size <= 4 {
                e + 8
            } else {
                let off = read_u32(bytes, e + 8, le).unwrap_or(0) as usize;
                base + off
            };

            out.insert(tag, Entry { entry_type, count, at });
        }
        out
    };

    let get_text = |e: Option<&Entry>| -> Option<String> {
        let e = e?;
        if e.entry_type != 2 || e.at + (e.count as usize) > bytes.len() {
            return None;
        }
        let slice = &bytes[e.at..e.at + (e.count as usize)];
        let s = String::from_utf8_lossy(slice);
        let trimmed = s.trim_matches(|c: char| c.is_whitespace() || c == '\0').to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    };

    let get_num = |e: Option<&Entry>| -> Option<f64> {
        let e = e?;
        match e.entry_type {
            3 => read_u16(bytes, e.at, le).map(|v| v as f64),
            4 => read_u32(bytes, e.at, le).map(|v| v as f64),
            5 | 10 => {
                if e.at + 8 <= bytes.len() {
                    let num = read_u32(bytes, e.at, le)? as f64;
                    let den = read_u32(bytes, e.at + 4, le)? as f64;
                    if den != 0.0 {
                        Some(num / den)
                    } else {
                        None
                    }
                } else {
                    None
                }
            }
            _ => None,
        }
    };

    let ifd0_offset = read_u32(bytes, base + 4, le)? as usize;
    let ifd0 = ifd(ifd0_offset);

    let exif_ptr = get_num(ifd0.get(&0x8769)).map(|v| v as usize);
    let sub = match exif_ptr {
        Some(ptr) => ifd(ptr),
        None => HashMap::new(),
    };

    let exif = PhotoExif {
        make: get_text(ifd0.get(&0x010f)),
        model: get_text(ifd0.get(&0x0110)),
        lens: get_text(sub.get(&0xa434)),
        focal: get_num(sub.get(&0x920a)),
        f_number: get_num(sub.get(&0x829d)),
        exposure: get_num(sub.get(&0x829a)),
        iso: get_num(sub.get(&0x8827)).map(|v| v as u32),
        date: get_text(sub.get(&0x9003)),
    };

    let has_any = exif.make.is_some()
        || exif.model.is_some()
        || exif.lens.is_some()
        || exif.focal.is_some()
        || exif.f_number.is_some()
        || exif.exposure.is_some()
        || exif.iso.is_some()
        || exif.date.is_some();

    if has_any {
        Some(exif)
    } else {
        None
    }
}

pub fn brand_name(e: &PhotoExif) -> Option<String> {
    let make = e.make.as_ref()?;
    let first = make.split_whitespace().next()?;
    Some(first.to_uppercase())
}

pub fn model_name(e: &PhotoExif) -> Option<String> {
    let model = e.model.as_ref()?;
    let brand = brand_name(e).unwrap_or_default();
    let re_prefix = format!("{brand} ");
    let stripped = if model.to_uppercase().starts_with(&re_prefix) {
        &model[re_prefix.len()..]
    } else {
        model.as_str()
    };
    Some(stripped.trim().to_string())
}

pub fn camera_name(e: &PhotoExif) -> Option<String> {
    let model = e.model.as_ref()?;
    let brand = brand_name(e).unwrap_or_default();
    if model.to_uppercase().starts_with(&brand) {
        let title_brand = if brand == "NIKON" {
            "Nikon"
        } else if brand == "CANON" {
            "Canon"
        } else if brand == "SONY" {
            "Sony"
        } else if brand == "FUJIFILM" {
            "Fujifilm"
        } else {
            &brand
        };
        Some(format!("{}{}", title_brand, &model[brand.len()..]))
    } else {
        Some(model.clone())
    }
}

pub fn settings_parts(e: &PhotoExif) -> Vec<String> {
    let mut parts = Vec::new();
    if let Some(focal) = e.focal {
        parts.push(format!("{}mm", focal.round() as i64));
    }
    if let Some(f) = e.f_number {
        let rounded = (f * 10.0).round() / 10.0;
        let s = if rounded.fract() == 0.0 {
            format!("f/{}", rounded as i64)
        } else {
            format!("f/{:.1}", rounded)
        };
        parts.push(s);
    }
    if let Some(exp) = e.exposure {
        if exp >= 1.0 {
            let rounded = (exp * 10.0).round() / 10.0;
            if rounded.fract() == 0.0 {
                parts.push(format!("{}s", rounded as i64));
            } else {
                parts.push(format!("{:.1}s", rounded));
            }
        } else if exp > 0.0 {
            let denom = (1.0 / exp).round() as i64;
            parts.push(format!("1/{denom}s"));
        }
    }
    if let Some(iso) = e.iso {
        parts.push(format!("ISO {iso}"));
    }
    parts
}

pub fn date_text(e: &PhotoExif) -> Option<String> {
    let date = e.date.as_ref()?;
    if date.len() < 10 {
        return None;
    }
    let ymd = &date[..10];
    Some(ymd.replace(':', "."))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn build_test_tiff() -> Vec<u8> {
        let mut buf = vec![0u8; 512];
        buf[0] = 0x49;
        buf[1] = 0x49;
        buf[2..4].copy_from_slice(&42u16.to_le_bytes());
        buf[4..8].copy_from_slice(&8u32.to_le_bytes());

        let mut data = 300usize;

        fn put(s: &str, buf: &mut [u8], data: &mut usize) -> usize {
            let at = *data;
            let bytes = s.as_bytes();
            buf[at..at + bytes.len()].copy_from_slice(bytes);
            *data += bytes.len() + (bytes.len() % 2);
            at
        }

        fn rational(n: u32, d: u32, buf: &mut [u8], data: &mut usize) -> usize {
            let at = *data;
            buf[at..at + 4].copy_from_slice(&n.to_le_bytes());
            buf[at + 4..at + 8].copy_from_slice(&d.to_le_bytes());
            *data += 8;
            at
        }

        let put_entry = |buf: &mut [u8], ifd: usize, i: usize, tag: u16, entry_type: u16, count: u32, value: u32| {
            let e = ifd + 2 + i * 12;
            buf[e..e + 2].copy_from_slice(&tag.to_le_bytes());
            buf[e + 2..e + 4].copy_from_slice(&entry_type.to_le_bytes());
            buf[e + 4..e + 8].copy_from_slice(&count.to_le_bytes());
            if entry_type == 3 && count == 1 {
                buf[e + 8..e + 10].copy_from_slice(&(value as u16).to_le_bytes());
            } else {
                buf[e + 8..e + 12].copy_from_slice(&value.to_le_bytes());
            }
        };

        let make_at = put("NIKON CORPORATION\0", &mut buf, &mut data);
        let model_at = put("NIKON Z f\0", &mut buf, &mut data);
        let lens_at = put("NIKKOR Z 40mm f/2\0", &mut buf, &mut data);
        let date_at = put("2025:11:29 15:23:04\0", &mut buf, &mut data);

        let exp_at = rational(1, 100, &mut buf, &mut data);
        let fnum_at = rational(56, 10, &mut buf, &mut data);
        let focal_at = rational(40, 1, &mut buf, &mut data);

        let ifd0 = 8usize;
        let exif = 60usize;
        buf[ifd0..ifd0 + 2].copy_from_slice(&3u16.to_le_bytes());
        put_entry(&mut buf, ifd0, 0, 0x010f, 2, "NIKON CORPORATION\0".len() as u32, make_at as u32);
        put_entry(&mut buf, ifd0, 1, 0x0110, 2, "NIKON Z f\0".len() as u32, model_at as u32);
        put_entry(&mut buf, ifd0, 2, 0x8769, 4, 1, exif as u32);

        buf[exif..exif + 2].copy_from_slice(&6u16.to_le_bytes());
        put_entry(&mut buf, exif, 0, 0x829a, 5, 1, exp_at as u32);
        put_entry(&mut buf, exif, 1, 0x829d, 5, 1, fnum_at as u32);
        put_entry(&mut buf, exif, 2, 0x8827, 3, 1, 400);
        put_entry(&mut buf, exif, 3, 0x9003, 2, "2025:11:29 15:23:04\0".len() as u32, date_at as u32);
        put_entry(&mut buf, exif, 4, 0x920a, 5, 1, focal_at as u32);
        put_entry(&mut buf, exif, 5, 0xa434, 2, "NIKKOR Z 40mm f/2\0".len() as u32, lens_at as u32);

        buf
    }

    fn make_test_jpeg(tiff: &[u8]) -> Vec<u8> {
        let app1_len = 2 + 6 + tiff.len();
        let mut out = vec![0xff, 0xd8, 0xff, 0xe1];
        out.push(((app1_len >> 8) & 0xff) as u8);
        out.push((app1_len & 0xff) as u8);
        out.extend_from_slice(b"Exif\0\0");
        out.extend_from_slice(tiff);
        out.extend_from_slice(&[0xff, 0xd9]);
        out
    }

    #[test]
    fn test_reads_jpeg_exif() {
        let tiff_bytes = build_test_tiff();
        let jpeg_bytes = make_test_jpeg(&tiff_bytes);
        let exif = read_exif(&jpeg_bytes).expect("Should parse EXIF");

        assert_eq!(exif.make.as_deref(), Some("NIKON CORPORATION"));
        assert_eq!(exif.model.as_deref(), Some("NIKON Z f"));
        assert_eq!(exif.lens.as_deref(), Some("NIKKOR Z 40mm f/2"));
        assert_eq!(exif.iso, Some(400));
        assert_eq!(exif.focal, Some(40.0));

        assert_eq!(camera_name(&exif).as_deref(), Some("Nikon Z f"));
        assert_eq!(brand_name(&exif).as_deref(), Some("NIKON"));
        assert_eq!(model_name(&exif).as_deref(), Some("Z f"));
        assert_eq!(date_text(&exif).as_deref(), Some("2025.11.29"));
        assert_eq!(
            settings_parts(&exif),
            vec!["40mm", "f/5.6", "1/100s", "ISO 400"]
        );
    }

    #[test]
    fn test_splits_maker_for_other_brands() {
        let e = PhotoExif {
            make: Some("FUJIFILM".to_string()),
            model: Some("X-T5".to_string()),
            ..Default::default()
        };
        assert_eq!(brand_name(&e).as_deref(), Some("FUJIFILM"));
        assert_eq!(model_name(&e).as_deref(), Some("X-T5"));

        let canon = PhotoExif {
            make: Some("Canon".to_string()),
            model: Some("Canon EOS R5".to_string()),
            ..Default::default()
        };
        assert_eq!(model_name(&canon).as_deref(), Some("EOS R5"));
    }
}
