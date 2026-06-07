use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::{AppHandle, Manager, Runtime, WebviewWindow};

/// 네이티브 OS 컨텍스트 메뉴 표시
#[tauri::command]
pub async fn show_context_menu<R: Runtime>(
    window: WebviewWindow<R>,
    is_pinned: bool,
) -> Result<(), String> {
    let app = window.app_handle();

    let pin = MenuItem::with_id(
        app,
        "pin",
        if is_pinned { "고정 해제" } else { "최상위 고정" },
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let delete = MenuItem::with_id(app, "delete", "캐릭터 삭제", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let sep = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;

    let menu = Menu::with_items(app, &[&pin, &sep, &delete])
        .map_err(|e| e.to_string())?;

    window.popup_menu(&menu).map_err(|e| e.to_string())
}

/// 앱 완전 종료
#[tauri::command]
pub async fn quit_app<R: Runtime>(app: AppHandle<R>) {
    app.exit(0);
}

/// 창 숨기기 (트레이로 최소화)
#[tauri::command]
pub async fn hide_window<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    app.get_webview_window("main")
        .ok_or_else(|| "Window not found".to_string())?
        .hide()
        .map_err(|e| e.to_string())
}

/// 행동 시작 시: always-on-top 활성화
#[tauri::command]
pub async fn set_always_on_top<R: Runtime>(
    app: AppHandle<R>,
    enabled: bool,
) -> Result<(), String> {
    app.get_webview_window("main")
        .ok_or_else(|| "Window not found".to_string())?
        .set_always_on_top(enabled)
        .map_err(|e| e.to_string())
}

/// 현재 윈도우 위치 저장 (드래그 후 위치 유지)
#[tauri::command]
pub async fn save_window_position<R: Runtime>(
    app: AppHandle<R>,
) -> Result<(i32, i32), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Window not found".to_string())?;
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    Ok((pos.x, pos.y))
}
