use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Deserialize)]
pub struct ExportFileInput {
    pub dir: String,
    pub base: String,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportResult {
    pub written: usize,
    pub renamed: usize,
    pub unchanged: usize,
    pub failed: usize,
}

pub fn safe_segment(name: &str) -> String {
    let mut out = String::new();
    for ch in name.chars() {
        if matches!(ch, '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\0'..='\x1f') {
            out.push('_');
        } else {
            out.push(ch);
        }
    }
    let trimmed = out.trim_start_matches('.').trim();
    if trimmed.is_empty() {
        "_".to_string()
    } else if trimmed.len() > 80 {
        trimmed[..80].to_string()
    } else {
        trimmed.to_string()
    }
}

pub fn pc_ext_of(bytes: &[u8]) -> &'static str {
    if bytes.len() >= 14 {
        let v = &bytes[12..14];
        if v == b"01" {
            return ".NCP";
        }
        if v == b"02" {
            return ".NP2";
        }
    }
    ".NP3"
}

pub fn date_tag() -> String {
    Local::now().format("%Y%m%d").to_string()
}

pub fn export_recipes(root_folder: &str, files: Vec<ExportFileInput>) -> ExportResult {
    let mut result = ExportResult {
        written: 0,
        renamed: 0,
        unchanged: 0,
        failed: 0,
    };

    let tag = date_tag();
    let root = Path::new(root_folder);

    for f in files {
        if f.bytes.len() < 32 || &f.bytes[0..4] != b"NCP\0" {
            result.failed += 1;
            continue;
        }

        let mut dir = root.to_path_buf();
        for part in f.dir.split('/').filter(|s| !s.is_empty()) {
            dir.push(safe_segment(part));
        }

        if fs::create_dir_all(&dir).is_err() {
            result.failed += 1;
            continue;
        }

        let ext = pc_ext_of(&f.bytes);
        let base = safe_segment(&f.base);

        let mut existing_same_bytes = false;
        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                if let Ok(name) = entry.file_name().into_string() {
                    let lower = name.to_lowercase();
                    let base_lower = base.to_lowercase();
                    if lower.starts_with(&base_lower) && lower.ends_with(&ext.to_lowercase()) {
                        if let Ok(existing_bytes) = fs::read(entry.path()) {
                            if existing_bytes == f.bytes {
                                existing_same_bytes = true;
                                break;
                            }
                        }
                    }
                }
            }
        }

        if existing_same_bytes {
            result.unchanged += 1;
            continue;
        }

        let primary_name = format!("{base}{ext}");
        let primary_path = dir.join(&primary_name);

        if !primary_path.exists() {
            if fs::write(&primary_path, &f.bytes).is_ok() {
                result.written += 1;
            } else {
                result.failed += 1;
            }
            continue;
        }

        let mut written_renamed = false;
        let dated_name = format!("{base}_{tag}{ext}");
        let dated_path = dir.join(&dated_name);
        if !dated_path.exists() {
            if fs::write(&dated_path, &f.bytes).is_ok() {
                result.renamed += 1;
                written_renamed = true;
            }
        } else {
            for n in 2..1000 {
                let candidate = format!("{base}_{tag}-{n}{ext}");
                let p = dir.join(&candidate);
                if !p.exists() {
                    if fs::write(&p, &f.bytes).is_ok() {
                        result.renamed += 1;
                        written_renamed = true;
                    }
                    break;
                }
            }
        }

        if !written_renamed {
            result.failed += 1;
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_safe_segment() {
        assert_eq!(safe_segment("Film: Kodak 400?"), "Film_ Kodak 400_");
        assert_eq!(safe_segment("..hidden"), "hidden");
    }

    #[test]
    fn test_pc_ext_of() {
        let mut ncp = vec![0u8; 32];
        ncp[12..14].copy_from_slice(b"01");
        assert_eq!(pc_ext_of(&ncp), ".NCP");

        let mut np3 = vec![0u8; 32];
        np3[12..14].copy_from_slice(b"03");
        assert_eq!(pc_ext_of(&np3), ".NP3");
    }
}
