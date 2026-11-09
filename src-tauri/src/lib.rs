pub mod cards;
pub mod export;
pub mod local_np3;
pub mod settings;

use cards::{
    eject_card, read_card, reveal_card, scan_cards, trash_file, write_files, NativeCard,
    NativeCardFile, WriteFileInput,
};
use export::{export_recipes, ExportFileInput, ExportResult};
use local_np3::{find_local_np3, LocalNp3File};
use settings::{load_settings, save_settings, NativeSettings, SettingsPatch};

use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

#[tauri::command]
pub fn cmd_list_cards() -> Vec<NativeCard> {
    scan_cards()
}

#[tauri::command]
pub fn cmd_read_card(card_path: String) -> Result<Vec<NativeCardFile>, String> {
    read_card(&card_path)
}

#[tauri::command]
pub fn cmd_write_files(card_path: String, files: Vec<WriteFileInput>) -> Result<bool, String> {
    write_files(&card_path, files)
}

#[tauri::command]
pub fn cmd_trash_file(card_path: String, file_name: String) -> Result<bool, String> {
    trash_file(&card_path, &file_name)
}

#[tauri::command]
pub fn cmd_eject(card_path: String) -> Result<bool, String> {
    eject_card(&card_path)
}

#[tauri::command]
pub fn cmd_reveal(card_path: String) -> Result<bool, String> {
    reveal_card(&card_path)
}

#[tauri::command]
pub fn cmd_choose_export_folder(default_path: Option<String>) -> Result<Option<String>, String> {
    let _ = default_path;
    // Tauri dialog can be integrated or fallback to picture_dir
    let dir = dirs::picture_dir()
        .map(|p| p.to_string_lossy().to_string());
    Ok(dir)
}

#[tauri::command]
pub fn cmd_export_recipes(folder: String, files: Vec<ExportFileInput>) -> Result<ExportResult, String> {
    Ok(export_recipes(&folder, files))
}

#[tauri::command]
pub fn cmd_reveal_export(folder: String) -> Result<bool, String> {
    open::that(folder).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub fn cmd_find_local_np3(since_ms: Option<f64>) -> Result<Vec<LocalNp3File>, String> {
    Ok(find_local_np3(since_ms.unwrap_or(0.0)))
}

#[tauri::command]
pub fn cmd_get_settings() -> NativeSettings {
    load_settings()
}

#[tauri::command]
pub fn cmd_set_settings(patch: SettingsPatch) -> NativeSettings {
    save_settings(patch)
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Setup Tray
            let show_i = MenuItem::with_id(app, "show", "NP3 Lab 열기", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Background Card Watcher Thread
            let watcher_app = app_handle.clone();
            let known_cards = Arc::new(Mutex::new(Vec::<String>::new()));

            thread::spawn(move || loop {
                thread::sleep(Duration::from_millis(2000));
                let current = scan_cards();
                let current_ids: Vec<String> = current.iter().map(|c| c.id.clone()).collect();

                let mut known = known_cards.lock().unwrap();
                let has_changes = *known != current_ids;

                let inserted: Vec<&NativeCard> = current
                    .iter()
                    .filter(|c| !known.contains(&c.id))
                    .collect();

                if has_changes {
                    *known = current_ids;
                    let _ = watcher_app.emit("cards:changed", &current);
                }

                if !inserted.is_empty() {
                    let settings = load_settings();
                    if settings.open_on_card {
                        if let Some(window) = watcher_app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Prevent destroying window; hide it to keep tray resident.
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            cmd_list_cards,
            cmd_read_card,
            cmd_write_files,
            cmd_trash_file,
            cmd_eject,
            cmd_reveal,
            cmd_choose_export_folder,
            cmd_export_recipes,
            cmd_reveal_export,
            cmd_find_local_np3,
            cmd_get_settings,
            cmd_set_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running NP3 Lab desktop application");
}
