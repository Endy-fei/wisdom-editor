use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

const MAX_RECENT: usize = 10;
const RECENT_FILE: &str = "recent.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentItem {
    pub path: String,
    pub name: String,
}

fn recent_path(config_dir: &Path) -> PathBuf {
    config_dir.join(RECENT_FILE)
}

pub fn load_recent(config_dir: &Path) -> Vec<RecentItem> {
    let path = recent_path(config_dir);
    let Ok(text) = fs::read_to_string(&path) else {
        return Vec::new();
    };
    serde_json::from_str::<Vec<RecentItem>>(&text).unwrap_or_default()
}

pub fn push_recent(config_dir: &Path, file_path: &Path) -> Result<Vec<RecentItem>, String> {
    fs::create_dir_all(config_dir).map_err(|e| e.to_string())?;
    let path_str = file_path.to_string_lossy().to_string();
    let name = file_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path_str.clone());

    let mut items = load_recent(config_dir);
    items.retain(|item| item.path != path_str);
    items.insert(0, RecentItem { path: path_str, name });
    items.truncate(MAX_RECENT);

    let text = serde_json::to_string_pretty(&items).map_err(|e| e.to_string())?;
    fs::write(recent_path(config_dir), text).map_err(|e| e.to_string())?;
    Ok(items)
}
