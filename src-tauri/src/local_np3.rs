use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

const MAX_NP3_BYTES: u64 = 64 * 1024;
const MAX_RESULTS: usize = 100;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalNp3File {
    pub name: String,
    pub mtime_ms: f64,
    pub bytes: Vec<u8>,
}

pub fn is_excluded_path(path: &Path, home: &Path) -> bool {
    let s = path.to_string_lossy();
    if s.starts_with("/Volumes") || s.contains("/node_modules/") || s.contains("/.Trash/") {
        return true;
    }
    let nikon_dir = home.join("Library/Application Support/Nikon");
    if path.starts_with(&nikon_dir) {
        return false;
    }
    let library_dir = home.join("Library");
    if path.starts_with(&library_dir) {
        return true;
    }
    false
}

pub fn find_local_np3(since_ms: f64) -> Vec<LocalNp3File> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"));
    let mut candidate_paths = Vec::new();

    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = Command::new("/usr/bin/mdfind")
            .arg("kMDItemFSName == '*.np3'c")
            .output()
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with('/') && trimmed.to_lowercase().ends_with(".np3") {
                        candidate_paths.push(PathBuf::from(trimmed));
                    }
                }
            }
        }
    }

    if candidate_paths.is_empty() {
        let common = [
            dirs::download_dir(),
            dirs::desktop_dir(),
            dirs::document_dir(),
            dirs::picture_dir(),
        ];
        for dir_opt in common.into_iter().flatten() {
            for entry in WalkDir::new(dir_opt)
                .max_depth(4)
                .into_iter()
                .filter_entry(|e| !e.file_name().to_string_lossy().starts_with('.'))
                .flatten()
            {
                if entry.file_type().is_file() {
                    if let Some(ext) = entry.path().extension() {
                        if ext.to_string_lossy().eq_ignore_ascii_case("np3") {
                            candidate_paths.push(entry.path().to_path_buf());
                        }
                    }
                }
            }
        }
    }

    let nikon_support = home.join("Library/Application Support/Nikon");
    if nikon_support.exists() {
        for entry in WalkDir::new(nikon_support)
            .max_depth(5)
            .into_iter()
            .flatten()
        {
            if entry.file_type().is_file() {
                if let Some(ext) = entry.path().extension() {
                    if ext.to_string_lossy().eq_ignore_ascii_case("np3") {
                        candidate_paths.push(entry.path().to_path_buf());
                    }
                }
            }
        }
    }

    candidate_paths.sort();
    candidate_paths.dedup();

    struct Found {
        path: PathBuf,
        mtime_ms: f64,
    }

    let mut found = Vec::new();
    for p in candidate_paths {
        if is_excluded_path(&p, &home) {
            continue;
        }
        if let Ok(metadata) = fs::metadata(&p) {
            if !metadata.is_file() || metadata.len() > MAX_NP3_BYTES {
                continue;
            }
            let mtime_ms = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs_f64() * 1000.0)
                .unwrap_or(0.0);

            if mtime_ms > since_ms {
                found.push(Found { path: p, mtime_ms });
            }
        }
    }

    found.sort_by(|a, b| b.mtime_ms.partial_cmp(&a.mtime_ms).unwrap_or(std::cmp::Ordering::Equal));

    let mut out = Vec::new();
    for item in found.into_iter().take(MAX_RESULTS) {
        if let Ok(bytes) = fs::read(&item.path) {
            if bytes.len() >= 16 && bytes[0] == 0x4e && bytes[1] == 0x43 && bytes[2] == 0x50 {
                let name = item
                    .path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("RECIPE.NP3")
                    .to_string();
                out.push(LocalNp3File {
                    name,
                    mtime_ms: item.mtime_ms,
                    bytes,
                });
            }
        }
    }

    out
}
