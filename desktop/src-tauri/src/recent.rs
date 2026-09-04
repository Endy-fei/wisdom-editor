use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

const MAX_RECENT: usize = 10;
const RECENT_FILE: &str = "recent.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredRecent {
    path: String,
    name: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct RecentItem {
    pub path: String,
    pub name: String,
    pub exists: bool,
}

fn recent_path(config_dir: &Path) -> PathBuf {
    config_dir.join(RECENT_FILE)
}

fn to_recent_item(stored: StoredRecent) -> RecentItem {
    let exists = Path::new(&stored.path).is_file();
    RecentItem {
        path: stored.path,
        name: stored.name,
        exists,
    }
}

fn save_recent(config_dir: &Path, items: &[RecentItem]) -> Result<(), String> {
    fs::create_dir_all(config_dir).map_err(|e| e.to_string())?;
    let stored: Vec<StoredRecent> = items
        .iter()
        .map(|item| StoredRecent {
            path: item.path.clone(),
            name: item.name.clone(),
        })
        .collect();
    let text = serde_json::to_string_pretty(&stored).map_err(|e| e.to_string())?;
    fs::write(recent_path(config_dir), text).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn load_recent(config_dir: &Path) -> Vec<RecentItem> {
    let path = recent_path(config_dir);
    let Ok(text) = fs::read_to_string(&path) else {
        return Vec::new();
    };
    serde_json::from_str::<Vec<StoredRecent>>(&text)
        .unwrap_or_default()
        .into_iter()
        .map(to_recent_item)
        .collect()
}

pub fn push_recent(config_dir: &Path, file_path: &Path) -> Result<Vec<RecentItem>, String> {
    let path_str = file_path.to_string_lossy().to_string();
    let name = file_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path_str.clone());

    let mut items = load_recent(config_dir);
    items.retain(|item| item.path != path_str);
    items.insert(
        0,
        RecentItem {
            path: path_str,
            name,
            exists: file_path.is_file(),
        },
    );
    items.truncate(MAX_RECENT);
    save_recent(config_dir, &items)?;
    Ok(items)
}

pub fn remove_recent(config_dir: &Path, file_path: &str) -> Result<Vec<RecentItem>, String> {
    let mut items = load_recent(config_dir);
    items.retain(|item| item.path != file_path);
    save_recent(config_dir, &items)?;
    Ok(items)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_dir() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "wisdom-recent-{}-{}",
            std::process::id(),
            nanos
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_recent_json(dir: &Path, items: &[(&str, &str)]) {
        let payload: Vec<serde_json::Value> = items
            .iter()
            .map(|(path, name)| serde_json::json!({ "path": path, "name": name }))
            .collect();
        fs::write(recent_path(dir), serde_json::to_string(&payload).unwrap()).unwrap();
    }

    #[test]
    fn load_recent_marks_missing_path_as_not_exists() {
        let dir = unique_dir();
        let missing = dir.join("gone.wisdom");
        write_recent_json(
            &dir,
            &[(missing.to_string_lossy().as_ref(), "gone.wisdom")],
        );

        let loaded = load_recent(&dir);
        assert_eq!(loaded.len(), 1);
        assert!(!loaded[0].exists);
        assert_eq!(loaded[0].name, "gone.wisdom");
    }

    #[test]
    fn load_recent_marks_existing_file_as_exists() {
        let dir = unique_dir();
        let file = dir.join("alive.wisdom");
        fs::write(&file, b"ok").unwrap();
        write_recent_json(
            &dir,
            &[(file.to_string_lossy().as_ref(), "alive.wisdom")],
        );

        let loaded = load_recent(&dir);
        assert_eq!(loaded.len(), 1);
        assert!(loaded[0].exists);
    }

    #[test]
    fn remove_recent_drops_matching_path_and_keeps_others() {
        let dir = unique_dir();
        let keep = dir.join("keep.wisdom");
        let drop = dir.join("drop.wisdom");
        fs::write(&keep, b"ok").unwrap();
        write_recent_json(
            &dir,
            &[
                (keep.to_string_lossy().as_ref(), "keep.wisdom"),
                (drop.to_string_lossy().as_ref(), "drop.wisdom"),
            ],
        );

        let remaining = remove_recent(&dir, &drop.to_string_lossy()).unwrap();
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].name, "keep.wisdom");
        assert!(remaining[0].exists);

        let reloaded = load_recent(&dir);
        assert_eq!(reloaded.len(), 1);
        assert_eq!(reloaded[0].name, "keep.wisdom");
    }

    #[test]
    fn push_recent_does_not_persist_exists_field() {
        let dir = unique_dir();
        let file = dir.join("a.wisdom");
        fs::write(&file, b"ok").unwrap();
        push_recent(&dir, &file).unwrap();

        let text = fs::read_to_string(recent_path(&dir)).unwrap();
        assert!(
            !text.contains("exists"),
            "recent.json should not persist exists: {text}"
        );
    }
}
