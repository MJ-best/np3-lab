use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSettings {
    pub open_on_card: bool,
    pub open_at_login: bool,
    pub can_use_login_item: bool,
}

impl Default for NativeSettings {
    fn default() -> Self {
        Self {
            open_on_card: true,
            open_at_login: true,
            can_use_login_item: cfg!(target_os = "macos"),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPatch {
    pub open_on_card: Option<bool>,
    pub open_at_login: Option<bool>,
}

fn settings_path() -> Option<PathBuf> {
    let mut dir = dirs::data_dir()?;
    dir.push("NP3 Lab");
    let _ = fs::create_dir_all(&dir);
    Some(dir.join("settings.json"))
}

pub fn load_settings() -> NativeSettings {
    let mut current = NativeSettings::default();
    if let Some(path) = settings_path() {
        if let Ok(content) = fs::read_to_string(path) {
            if let Ok(saved) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(b) = saved.get("openOnCard").and_then(|v| v.as_bool()) {
                    current.open_on_card = b;
                }
                if let Some(b) = saved.get("openAtLogin").and_then(|v| v.as_bool()) {
                    current.open_at_login = b;
                }
            }
        }
    }
    current
}

pub fn save_settings(patch: SettingsPatch) -> NativeSettings {
    let mut current = load_settings();
    if let Some(b) = patch.open_on_card {
        current.open_on_card = b;
    }
    if let Some(b) = patch.open_at_login {
        current.open_at_login = b;
    }

    if let Some(path) = settings_path() {
        if let Ok(json) = serde_json::to_string_pretty(&current) {
            let _ = fs::write(path, json);
        }
    }

    current
}
