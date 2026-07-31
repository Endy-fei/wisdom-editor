use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use serde_json::Value;
use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;

pub fn read_wisdom(path: &Path) -> Result<(Value, Vec<String>), String> {
    let file = File::open(path).map_err(|e| format!("无法打开文件：{e}"))?;
    let mut decoder = GzDecoder::new(file);
    let mut json = String::new();
    decoder
        .read_to_string(&mut json)
        .map_err(|e| format!("无法解压 Wisdom 文件（需为 gzip+JSON）：{e}"))?;
    let data: Value = serde_json::from_str(&json)
        .map_err(|e| format!("无法解析 Wisdom JSON：{e}"))?;
    if !data.is_object() {
        return Err("Wisdom JSON root must be an object".into());
    }
    let mut warnings = Vec::new();
    if !data
        .get("MeterInfoList")
        .map(|v| v.is_array())
        .unwrap_or(false)
    {
        warnings.push("结构不完整，已用空值兜底（MeterInfoList 非数组）".into());
    }
    Ok((data, warnings))
}

pub fn write_wisdom(path: &Path, data: &Value) -> Result<(), String> {
    let json = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    let file = File::create(path).map_err(|e| format!("无法写入文件：{e}"))?;
    let mut encoder = GzEncoder::new(file, Compression::default());
    encoder
        .write_all(json.as_bytes())
        .map_err(|e| format!("gzip 写入失败：{e}"))?;
    encoder.finish().map_err(|e| format!("gzip 完成失败：{e}"))?;
    Ok(())
}
