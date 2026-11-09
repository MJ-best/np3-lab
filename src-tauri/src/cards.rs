use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeCard {
    pub id: String,
    pub name: String,
    pub path: String,
    pub np3_count: usize,
    pub free_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeCardFile {
    pub file_name: String,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct WriteFileInput {
    pub file_name: String,
    pub bytes: Vec<u8>,
    pub overwrite: Option<bool>,
}

pub fn is_pc_file(name: &str) -> bool {
    let lower = name.to_lowercase();
    (lower.ends_with(".np3") || lower.ends_with(".np2") || lower.ends_with(".ncp"))
        && !lower.starts_with('.')
        && !lower.starts_with("._")
}

pub fn is_safe_np3_name(name: &str) -> bool {
    name.len() >= 5
        && name.len() <= 255
        && is_pc_file(name)
        && !name.contains('/')
        && !name.contains('\\')
        && !name.contains('\0')
}

pub fn looks_like_nikon_card(root: &Path) -> bool {
    let entries = match fs::read_dir(root) {
        Ok(e) => e,
        Err(_) => return false,
    };

    let mut names = Vec::new();
    for entry in entries.flatten() {
        if let Ok(s) = entry.file_name().into_string() {
            names.push(s.to_uppercase());
        }
    }

    if names.contains(&"NIKON".to_string()) {
        return true;
    }
    if names.iter().any(|n| n.starts_with("NIKON") && n.ends_with(".DSC")) {
        return true;
    }
    if !names.contains(&"DCIM".to_string()) {
        return false;
    }

    let dcim_path = root.join("DCIM");
    let dcim_entries = match fs::read_dir(dcim_path) {
        Ok(e) => e,
        Err(_) => return true,
    };

    let mut sub_names = Vec::new();
    for entry in dcim_entries.flatten() {
        if let Ok(s) = entry.file_name().into_string() {
            sub_names.push(s.to_uppercase());
        }
    }

    let numbered: Vec<_> = sub_names
        .iter()
        .filter(|n| n.len() >= 3 && n[..3].chars().all(|c| c.is_ascii_digit()))
        .collect();

    if numbered.is_empty() {
        return true;
    }

    numbered.iter().any(|n| n.len() >= 4 && &n[3..4] == "N")
}

pub fn find_custom_pc_dir(root: &Path, create: bool) -> Option<PathBuf> {
    let mut nikon_name = None;
    if let Ok(entries) = fs::read_dir(root) {
        for entry in entries.flatten() {
            if let Ok(name) = entry.file_name().into_string() {
                if name.eq_ignore_ascii_case("NIKON") {
                    nikon_name = Some(name);
                    break;
                }
            }
        }
    }

    let nikon_dir = match nikon_name {
        Some(name) => root.join(name),
        None => {
            if !create {
                return None;
            }
            let dir = root.join("NIKON");
            if fs::create_dir_all(&dir).is_err() {
                return None;
            }
            dir
        }
    };

    let mut custom_name = None;
    if let Ok(entries) = fs::read_dir(&nikon_dir) {
        for entry in entries.flatten() {
            if let Ok(name) = entry.file_name().into_string() {
                if name.eq_ignore_ascii_case("CUSTOMPC") {
                    custom_name = Some(name);
                    break;
                }
            }
        }
    }

    match custom_name {
        Some(name) => Some(nikon_dir.join(name)),
        None => {
            if !create {
                return None;
            }
            let dir = nikon_dir.join("CUSTOMPC");
            if fs::create_dir_all(&dir).is_err() {
                return None;
            }
            Some(dir)
        }
    }
}

pub fn candidate_volume_paths() -> Vec<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        let volumes = Path::new("/Volumes");
        if let Ok(entries) = fs::read_dir(volumes) {
            return entries
                .flatten()
                .map(|e| e.path())
                .filter(|p| p.is_dir())
                .collect();
        }
        Vec::new()
    }
    #[cfg(target_os = "windows")]
    {
        let mut out = Vec::new();
        for letter in b'D'..=b'Z' {
            let s = format!("{}:\\", letter as char);
            let p = PathBuf::from(s);
            if p.exists() {
                out.push(p);
            }
        }
        out
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let mut out = Vec::new();
        if let Ok(user) = std::env::var("USER") {
            for base in &[format!("/media/{user}"), format!("/run/media/{user}")] {
                let p = Path::new(base);
                if let Ok(entries) = fs::read_dir(p) {
                    for entry in entries.flatten() {
                        if entry.path().is_dir() {
                            out.push(entry.path());
                        }
                    }
                }
            }
        }
        out
    }
}

pub fn scan_cards() -> Vec<NativeCard> {
    let mut cards = Vec::new();
    for vol in candidate_volume_paths() {
        if !looks_like_nikon_card(&vol) {
            continue;
        }

        let np3_count = if let Some(dir) = find_custom_pc_dir(&vol, false) {
            fs::read_dir(&dir)
                .map(|entries| {
                    entries
                        .flatten()
                        .filter(|e| {
                            e.file_name()
                                .into_string()
                                .map(|s| is_pc_file(&s))
                                .unwrap_or(false)
                        })
                        .count()
                })
                .unwrap_or(0)
        } else {
            0
        };

        let name = vol
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("SD CARD")
            .to_string();

        let path_str = vol.to_string_lossy().to_string();

        cards.push(NativeCard {
            id: path_str.clone(),
            name,
            path: path_str,
            np3_count,
            free_bytes: None,
        });
    }
    cards
}

pub fn read_card(card_path: &str) -> Result<Vec<NativeCardFile>, String> {
    let root = Path::new(card_path);
    if !root.exists() {
        return Err("card-not-found".to_string());
    }

    let dir = match find_custom_pc_dir(root, false) {
        Some(d) => d,
        None => return Ok(Vec::new()),
    };

    let mut files = Vec::new();
    let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let p = entry.path();
        if !p.is_file() {
            continue;
        }
        let name = match entry.file_name().into_string() {
            Ok(n) => n,
            Err(_) => continue,
        };

        if !is_pc_file(&name) {
            continue;
        }

        if let Ok(metadata) = entry.metadata() {
            if metadata.len() > 64 * 1024 {
                continue;
            }
        }

        if let Ok(bytes) = fs::read(&p) {
            files.push(NativeCardFile {
                file_name: name,
                bytes,
            });
        }
    }

    files.sort_by(|a, b| a.file_name.cmp(&b.file_name));
    Ok(files)
}

pub fn write_files(card_path: &str, files: Vec<WriteFileInput>) -> Result<bool, String> {
    let root = Path::new(card_path);
    let dir = find_custom_pc_dir(root, true).ok_or("no-folder")?;

    for f in &files {
        if !is_safe_np3_name(&f.file_name) {
            return Err("invalid-file-name".to_string());
        }
        if f.bytes.len() < 32 || f.bytes.len() > 64 * 1024 || &f.bytes[0..4] != b"NCP\0" {
            return Err("invalid-bytes".to_string());
        }

        let target_path = dir.join(&f.file_name);
        if target_path.exists() && !f.overwrite.unwrap_or(false) {
            return Err(format!("exists:{}", f.file_name));
        }
    }

    for f in files {
        let target_path = dir.join(&f.file_name);
        fs::write(target_path, f.bytes).map_err(|e| e.to_string())?;
    }

    Ok(true)
}

pub fn trash_file(card_path: &str, file_name: &str) -> Result<bool, String> {
    if !is_safe_np3_name(file_name) {
        return Err("invalid-file-name".to_string());
    }
    let root = Path::new(card_path);
    let dir = find_custom_pc_dir(root, false).ok_or("no-folder")?;
    let target = dir.join(file_name);
    if !target.exists() {
        return Err("file-not-found".to_string());
    }

    trash::delete(&target).map_err(|e| e.to_string())?;
    Ok(true)
}

pub fn eject_card(card_path: &str) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        let status = Command::new("diskutil")
            .args(["eject", card_path])
            .status()
            .map_err(|e| e.to_string())?;
        if status.success() {
            Ok(true)
        } else {
            Err("eject-failed".to_string())
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = card_path;
        Err("eject-unsupported".to_string())
    }
}

pub fn reveal_card(card_path: &str) -> Result<bool, String> {
    let root = Path::new(card_path);
    let target = find_custom_pc_dir(root, false).unwrap_or_else(|| root.to_path_buf());
    open::that(target).map_err(|e| e.to_string())?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_pc_file() {
        assert!(is_pc_file("PICCON01.NP3"));
        assert!(is_pc_file("portrait.np2"));
        assert!(is_pc_file("CUSTOM.NCP"));
        assert!(!is_pc_file("._PICCON01.NP3"));
        assert!(!is_pc_file(".DS_Store"));
        assert!(!is_pc_file("image.jpg"));
    }

    #[test]
    fn test_is_safe_np3_name() {
        assert!(is_safe_np3_name("PICCON01.NP3"));
        assert!(is_safe_np3_name("Kodak Gold.np2"));
        assert!(!is_safe_np3_name(".NP3"));
        assert!(!is_safe_np3_name("x.ncp.txt"));
        assert!(!is_safe_np3_name("../PICCON01.NP3"));
        assert!(!is_safe_np3_name("sub/PICCON01.NP3"));
    }
}
