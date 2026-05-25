use base64::{engine::general_purpose::STANDARD, Engine};
use image::{DynamicImage, GenericImage, GenericImageView, Rgba};
use serde::Deserialize;

#[derive(Deserialize)]
struct ImagenResponse {
    predictions: Vec<ImagenPrediction>,
}

#[derive(Deserialize)]
struct ImagenPrediction {
    #[serde(rename = "bytesBase64Encoded")]
    bytes_base64_encoded: String,
}

/// 흰색/밝은 배경 픽셀을 투명하게 변환
fn remove_white_background(img: DynamicImage, threshold: u8) -> DynamicImage {
    let mut rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();
    for y in 0..h {
        for x in 0..w {
            let Rgba([r, g, b, a]) = *rgba.get_pixel(x, y);
            if a > 0 && r >= threshold && g >= threshold && b >= threshold {
                let whiteness = r.min(g).min(b);
                let alpha = if whiteness >= threshold {
                    let t = threshold as f32;
                    let w = whiteness as f32;
                    let max = 255.0_f32;
                    ((1.0 - (w - t) / (max - t)) * 255.0) as u8
                } else {
                    a
                };
                rgba.put_pixel(x, y, Rgba([r, g, b, alpha]));
            }
        }
    }
    DynamicImage::ImageRgba8(rgba)
}

#[tauri::command]
pub async fn generate_image(
    token: String,
    project_id: String,
    location: String,
    prompt: String,
) -> Result<String, String> {
    let url = format!(
        "https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}\
         /locations/{location}/publishers/google/models/imagen-3.0-generate-002:predict"
    );

    let body = serde_json::json!({
        "instances": [{ "prompt": prompt }],
        "parameters": {
            "sampleCount": 1,
            "aspectRatio": "1:1",
            "outputMimeType": "image/png"
        }
    });

    let client = reqwest::Client::new();
    let res = client
        .post(&url)
        .header("Authorization", format!("Bearer {token}"))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let status = res.status().as_u16();
        let text = res.text().await.unwrap_or_default();
        return Err(format!("Vertex AI error {status}: {text}"));
    }

    let data: ImagenResponse = res.json().await.map_err(|e| e.to_string())?;
    let b64 = data
        .predictions
        .into_iter()
        .next()
        .map(|p| p.bytes_base64_encoded)
        .ok_or_else(|| "No prediction returned".to_string())?;

    // 흰 배경 제거
    let bytes = STANDARD.decode(&b64).map_err(|e| format!("base64 decode: {e}"))?;
    let img = image::load_from_memory(&bytes).map_err(|e| format!("image load: {e}"))?;
    let processed = remove_white_background(img, 230);

    let mut out: Vec<u8> = Vec::new();
    processed
        .write_to(&mut std::io::Cursor::new(&mut out), image::ImageFormat::Png)
        .map_err(|e| format!("image encode: {e}"))?;

    Ok(STANDARD.encode(&out))
}

/// 파일 경로 → base64 data URL (convertFileSrc 대체)
#[tauri::command]
pub async fn read_image_as_data_url(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|e| format!("파일 읽기 실패: {e}"))?;
    let b64 = base64_encode(&bytes);
    Ok(format!("data:image/png;base64,{b64}"))
}

fn base64_encode(input: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((input.len() + 2) / 3 * 4);
    for chunk in input.chunks(3) {
        let b = match chunk.len() {
            3 => [chunk[0], chunk[1], chunk[2]],
            2 => [chunk[0], chunk[1], 0],
            _ => [chunk[0], 0, 0],
        };
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | (b[2] as u32);
        out.push(CHARS[((n >> 18) & 63) as usize] as char);
        out.push(CHARS[((n >> 12) & 63) as usize] as char);
        out.push(if chunk.len() > 1 { CHARS[((n >> 6) & 63) as usize] as char } else { '=' });
        out.push(if chunk.len() > 2 { CHARS[(n & 63) as usize] as char } else { '=' });
    }
    out
}
