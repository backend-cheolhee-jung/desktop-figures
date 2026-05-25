use tauri::{AppHandle, LogicalSize, Manager, Runtime, Size};

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

/// 페이지 전환 시 창 크기 변경 (위젯 ↔ 풀 패널)
#[tauri::command]
pub async fn resize_window<R: Runtime>(
    app: AppHandle<R>,
    width: f64,
    height: f64,
) -> Result<(), String> {
    app.get_webview_window("main")
        .ok_or_else(|| "Window not found".to_string())?
        .set_size(Size::Logical(LogicalSize { width, height }))
        .map_err(|e| e.to_string())
}
