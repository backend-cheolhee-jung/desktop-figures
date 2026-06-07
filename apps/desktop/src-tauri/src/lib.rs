mod commands;

use tauri::WindowEvent;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::set_always_on_top,
            commands::save_window_position,
            commands::quit_app,
            commands::hide_window,
            commands::show_context_menu,
            commands::meshy_create_text_model,
            commands::meshy_create_refine,
            commands::meshy_poll_text_model,
            commands::meshy_create_rig,
            commands::meshy_poll_rig,
            commands::meshy_create_animation,
            commands::meshy_poll_animation,
            commands::meshy_download_glb,
        ])
        .setup(|_app| {
            Ok(())
        })
        .on_menu_event(|app, event| {
            use tauri::{Emitter, Manager};
            if let Some(window) = app.get_webview_window("main") {
                window.emit("context-menu-action", event.id().0.as_str()).ok();
            }
        })
        // 창 닫기(X 클릭) → 숨기기만, 프로세스 유지
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                window.hide().ok();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
