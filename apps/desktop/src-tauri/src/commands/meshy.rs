use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::fs;
use tauri::{AppHandle, Manager};

const BASE: &str = "https://api.meshy.ai/openapi";

fn client() -> Client {
    Client::new()
}

// ── 응답 타입 ────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeshyTextResult {
    pub status: String,
    pub glb_url: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeshyRigResult {
    pub status: String,
    pub rigged_glb_url: Option<String>,
    pub walking_glb_url: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeshyAnimResult {
    pub status: String,
    pub glb_url: Option<String>,
}

// ── 헬퍼 ────────────────────────────────────────────────────

fn normalize_status(raw: &str) -> String {
    match raw.to_uppercase().as_str() {
        "SUCCEEDED" => "succeeded".into(),
        "FAILED" | "EXPIRED" => "failed".into(),
        _ => "pending".into(),
    }
}

// ── 커맨드 ──────────────────────────────────────────────────

#[tauri::command]
pub async fn meshy_create_text_model(api_key: String, prompt: String) -> Result<String, String> {
    let res = client()
        .post(format!("{BASE}/v2/text-to-3d"))
        .bearer_auth(&api_key)
        .json(&serde_json::json!({
            "mode": "preview",
            "prompt": prompt,
            "art_style": "realistic",
            "should_remesh": true,
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Meshy text-to-3d {}: {}", res.status(), res.text().await.unwrap_or_default()));
    }
    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    data["result"].as_str().map(String::from).ok_or_else(|| "no result field".into())
}

#[tauri::command]
pub async fn meshy_poll_text_model(api_key: String, task_id: String) -> Result<MeshyTextResult, String> {
    let res = client()
        .get(format!("{BASE}/v2/text-to-3d/{task_id}"))
        .bearer_auth(&api_key)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("poll text-to-3d {}: {}", res.status(), res.text().await.unwrap_or_default()));
    }
    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let status = normalize_status(data["status"].as_str().unwrap_or(""));
    let glb_url = data["model_urls"]["glb"].as_str().map(String::from);
    Ok(MeshyTextResult { status, glb_url })
}

#[tauri::command]
pub async fn meshy_create_refine(api_key: String, preview_task_id: String) -> Result<String, String> {
    let res = client()
        .post(format!("{BASE}/v2/text-to-3d"))
        .bearer_auth(&api_key)
        .json(&serde_json::json!({
            "mode": "refine",
            "preview_task_id": preview_task_id,
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Meshy refine {}: {}", res.status(), res.text().await.unwrap_or_default()));
    }
    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    data["result"].as_str().map(String::from).ok_or_else(|| "no result field".into())
}

#[tauri::command]
pub async fn meshy_create_rig(api_key: String, model_glb_url: String) -> Result<String, String> {
    let res = client()
        .post(format!("{BASE}/v1/rigging"))
        .bearer_auth(&api_key)
        .json(&serde_json::json!({ "model_url": model_glb_url }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Meshy rigging {}: {}", res.status(), res.text().await.unwrap_or_default()));
    }
    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    data["result"].as_str().map(String::from).ok_or_else(|| "no result field".into())
}

#[tauri::command]
pub async fn meshy_poll_rig(api_key: String, rig_task_id: String) -> Result<MeshyRigResult, String> {
    let res = client()
        .get(format!("{BASE}/v1/rigging/{rig_task_id}"))
        .bearer_auth(&api_key)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("poll rig {}: {}", res.status(), res.text().await.unwrap_or_default()));
    }
    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let status = normalize_status(data["status"].as_str().unwrap_or(""));
    let result = &data["result"];
    let rigged_glb_url = result["rigged_character_glb_url"].as_str().map(String::from);
    let walking_glb_url = result["basic_animations"]["walking_glb_url"].as_str().map(String::from);
    Ok(MeshyRigResult { status, rigged_glb_url, walking_glb_url })
}

#[tauri::command]
pub async fn meshy_create_animation(api_key: String, rig_task_id: String, action_id: u32) -> Result<String, String> {
    let res = client()
        .post(format!("{BASE}/v1/animations"))
        .bearer_auth(&api_key)
        .json(&serde_json::json!({ "rig_task_id": rig_task_id, "action_id": action_id }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Meshy animation {}: {}", res.status(), res.text().await.unwrap_or_default()));
    }
    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    data["result"].as_str().map(String::from).ok_or_else(|| "no result field".into())
}

#[tauri::command]
pub async fn meshy_poll_animation(api_key: String, anim_task_id: String) -> Result<MeshyAnimResult, String> {
    let res = client()
        .get(format!("{BASE}/v1/animations/{anim_task_id}"))
        .bearer_auth(&api_key)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("poll animation {}: {}", res.status(), res.text().await.unwrap_or_default()));
    }
    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let status = normalize_status(data["status"].as_str().unwrap_or(""));
    let glb_url = data["result"]["animation_glb_url"].as_str().map(String::from);
    Ok(MeshyAnimResult { status, glb_url })
}

#[tauri::command]
pub async fn meshy_download_glb(
    app: AppHandle,
    url: String,
    sub_dir: String,
    filename: String,
) -> Result<String, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let dir = app_data.join(&sub_dir);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let bytes = client()
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    let file_path = dir.join(&filename);
    fs::write(&file_path, &bytes).map_err(|e| e.to_string())?;

    Ok(format!("{sub_dir}/{filename}"))
}
