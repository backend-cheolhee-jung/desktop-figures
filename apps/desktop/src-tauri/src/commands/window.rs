use tauri::{AppHandle, Manager, Runtime};

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
