#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager};

static EXIT_READY: AtomicBool = AtomicBool::new(false);
#[tauri::command]
fn confirm_exit(app: tauri::AppHandle) {
    EXIT_READY.store(true, Ordering::SeqCst);
    app.exit(0);
}
fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![confirm_exit])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.app_handle().emit("app-exit-requested", ());
            }
        })
        .build(tauri::generate_context!())
        .expect("Unable to start IELTS Simulator");
    app.run(|app, event| {
        if let tauri::RunEvent::ExitRequested { api, .. } = event {
            if !EXIT_READY.load(Ordering::SeqCst) {
                api.prevent_exit();
                let _ = app.emit("app-exit-requested", ());
            }
        }
    });
}
