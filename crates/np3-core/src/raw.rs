use serde::{Deserialize, Serialize};
use std::collections::{HashSet, VecDeque};

const MAX_IFDS: usize = 32;
const MAX_ENTRIES: usize = 1000;
const MAX_PREVIEW_BYTES: u64 = 40 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NefPreview {
    pub offset: u32,
    pub length: u32,
    /// EXIF orientation of the shot (1 = upright, 6 = rotate 90° CW, 8 = rotate 90° CCW, 3 = 180°).
    pub orientation: u16,
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

/// Find the largest embedded JPEG and the orientation in a NEF's TIFF header. Bounds-checked: the file is untrusted.
pub fn find_nef_preview(head: &[u8], file_size: u64) -> Option<NefPreview> {
    if head.len() < 16 {
        return None;
    }

    let le = head[0] == 0x49 && head[1] == 0x49;
    let be = head[0] == 0x4d && head[1] == 0x4d;
    if !le && !be {
        return None;
    }

    if read_u16(head, 2, le)? != 42 {
        return None;
    }

    let mut orientation = 1u16;
    let mut best: Option<(u32, u32)> = None;
    let mut queue = VecDeque::new();
    queue.push_back(read_u32(head, 4, le)?);

    let mut seen = HashSet::new();
    let mut first = true;

    while let Some(off_u32) = queue.pop_front() {
        if seen.len() >= MAX_IFDS {
            break;
        }

        let off = off_u32 as usize;
        if off < 8 || off + 2 > head.len() || seen.contains(&off) {
            first = false;
            continue;
        }

        seen.insert(off);
        let count = match read_u16(head, off, le) {
            Some(c) => c as usize,
            None => continue,
        };

        if count > MAX_ENTRIES || off + 2 + count * 12 + 4 > head.len() {
            first = false;
            continue;
        }

        let mut jpeg_offset = 0u32;
        let mut jpeg_length = 0u32;

        for i in 0..count {
            let e = off + 2 + i * 12;
            let tag = match read_u16(head, e, le) {
                Some(t) => t,
                None => continue,
            };
            let entry_type = match read_u16(head, e + 2, le) {
                Some(t) => t,
                None => continue,
            };
            let n = match read_u32(head, e + 4, le) {
                Some(v) => v,
                None => continue,
            };

            if tag == 0x0112 && first && entry_type == 3 {
                if let Some(val) = read_u16(head, e + 8, le) {
                    orientation = val;
                }
            } else if tag == 0x014a {
                // SubIFDs: one offset inline, or a list of offsets.
                if n == 1 {
                    if let Some(sub_off) = read_u32(head, e + 8, le) {
                        queue.push_back(sub_off);
                    }
                } else if n > 1 && n <= 8 {
                    if let Some(list) = read_u32(head, e + 8, le) {
                        let list_off = list as usize;
                        for k in 0..n {
                            let item_off = list_off + (k as usize) * 4;
                            if item_off + 4 <= head.len() {
                                if let Some(sub_off) = read_u32(head, item_off, le) {
                                    queue.push_back(sub_off);
                                }
                            }
                        }
                    }
                }
            } else if tag == 0x0201 {
                if let Some(val) = read_u32(head, e + 8, le) {
                    jpeg_offset = val;
                }
            } else if tag == 0x0202 {
                if let Some(val) = read_u32(head, e + 8, le) {
                    jpeg_length = val;
                }
            }
        }

        let next = read_u32(head, off + 2 + count * 12, le).unwrap_or(0);
        if next != 0 {
            queue.push_back(next);
        }

        first = false;

        if jpeg_offset > 0
            && jpeg_length > 0
            && (jpeg_length as u64) <= MAX_PREVIEW_BYTES
            && ((jpeg_offset as u64) + (jpeg_length as u64)) <= file_size
        {
            match best {
                None => best = Some((jpeg_offset, jpeg_length)),
                Some((_, prev_len)) if jpeg_length > prev_len => {
                    best = Some((jpeg_offset, jpeg_length));
                }
                _ => {}
            }
        }
    }

    let final_orientation = match orientation {
        1 | 3 | 6 | 8 => orientation,
        _ => 1,
    };

    best.map(|(offset, length)| NefPreview {
        offset,
        length,
        orientation: final_orientation,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn build_test_tiff(orientation: u16, previews: &[(u32, u32)]) -> Vec<u8> {
        let mut b = vec![0u8; 4096];
        b[0] = 0x49;
        b[1] = 0x49;
        b[2..4].copy_from_slice(&42u16.to_le_bytes());
        b[4..8].copy_from_slice(&8u32.to_le_bytes());

        let put_entry = |b: &mut [u8], at: usize, tag: u16, entry_type: u16, count: u32, value: u32| {
            b[at..at + 2].copy_from_slice(&tag.to_le_bytes());
            b[at + 2..at + 4].copy_from_slice(&entry_type.to_le_bytes());
            b[at + 4..at + 8].copy_from_slice(&count.to_le_bytes());
            if entry_type == 3 && count == 1 {
                b[at + 8..at + 10].copy_from_slice(&(value as u16).to_le_bytes());
            } else {
                b[at + 8..at + 12].copy_from_slice(&value.to_le_bytes());
            }
        };

        // IFD0 at 8: 2 entries
        b[8..10].copy_from_slice(&2u16.to_le_bytes());
        put_entry(&mut b, 10, 0x0112, 3, 1, orientation as u32);
        put_entry(&mut b, 22, 0x014a, 4, previews.len() as u32, 100);
        b[34..38].copy_from_slice(&0u32.to_le_bytes());

        for (i, &(off, len)) in previews.iter().enumerate() {
            let ifd = 200 + i * 40;
            b[100 + i * 4..100 + i * 4 + 4].copy_from_slice(&(ifd as u32).to_le_bytes());
            b[ifd..ifd + 2].copy_from_slice(&2u16.to_le_bytes());
            put_entry(&mut b, ifd + 2, 0x0201, 4, 1, off);
            put_entry(&mut b, ifd + 14, 0x0202, 4, 1, len);
            b[ifd + 26..ifd + 30].copy_from_slice(&0u32.to_le_bytes());
        }

        b
    }

    #[test]
    fn test_picks_largest_embedded_jpeg_and_orientation() {
        let tiff = build_test_tiff(8, &[(400, 50), (500, 3000)]);
        let preview = find_nef_preview(&tiff, 10_000).unwrap();
        assert_eq!(preview.offset, 500);
        assert_eq!(preview.length, 3000);
        assert_eq!(preview.orientation, 8);

        let tiff6 = build_test_tiff(6, &[(400, 50), (500, 3000)]);
        assert_eq!(find_nef_preview(&tiff6, 10_000).unwrap().orientation, 6);
    }

    #[test]
    fn test_ignores_out_of_bounds_and_odd_orientations() {
        let tiff = build_test_tiff(5, &[(400, 50), (500, 99_999)]);
        let preview = find_nef_preview(&tiff, 10_000).unwrap();
        assert_eq!(preview.offset, 400);
        assert_eq!(preview.length, 50);
        assert_eq!(preview.orientation, 1); // 5 falls back to 1
    }

    #[test]
    fn test_rejects_invalid_tiff_and_loops() {
        assert!(find_nef_preview(b"not a tiff at all, nope", 100).is_none());

        let mut looped = build_test_tiff(8, &[(400, 50), (500, 3000)]);
        looped[34..38].copy_from_slice(&8u32.to_le_bytes()); // IFD0 points back to itself
        let preview = find_nef_preview(&looped, 10_000).unwrap();
        assert_eq!(preview.length, 3000);

        assert!(find_nef_preview(&looped[..30], 10_000).is_none());
    }
}
