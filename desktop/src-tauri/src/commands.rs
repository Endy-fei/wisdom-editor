use crate::recent::{self, RecentItem};
use crate::wisdom_io;
use serde::Serialize;
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

pub struct AppState {
    pub startup_path: Mutex<Option<String>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupState {
    pub recent: Vec<RecentItem>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub open_path: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenResult {
    pub path: String,
    pub file_name: String,
    pub data: Value,
    pub warnings: Vec<String>,
}

fn config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map_err(|e| format!("无法获取配置目录：{e}"))
}

fn open_path_inner(app: &AppHandle, path: &Path) -> Result<OpenResult, String> {
    let (data, warnings) = wisdom_io::read_wisdom(path)?;
    let _ = recent::push_recent(&config_dir(app)?, path);
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "file.wisdom".into());
    Ok(OpenResult {
        path: path.to_string_lossy().to_string(),
        file_name,
        data,
        warnings,
    })
}

fn file_path_to_pathbuf(file_path: tauri_plugin_dialog::FilePath) -> Result<PathBuf, String> {
    file_path
        .into_path()
        .map_err(|e| format!("无效路径：{e}"))
}

#[tauri::command]
pub fn get_startup_state(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<StartupState, String> {
    let recent = recent::load_recent(&config_dir(&app)?);
    let open_path = state.startup_path.lock().map_err(|e| e.to_string())?.take();
    Ok(StartupState { recent, open_path })
}

#[tauri::command]
pub fn list_recent(app: AppHandle) -> Result<Vec<RecentItem>, String> {
    Ok(recent::load_recent(&config_dir(&app)?))
}

#[tauri::command]
pub fn remove_recent(app: AppHandle, path: String) -> Result<Vec<RecentItem>, String> {
    recent::remove_recent(&config_dir(&app)?, &path)
}

#[tauri::command]
pub fn open_wisdom_path(app: AppHandle, path: String) -> Result<OpenResult, String> {
    open_path_inner(&app, Path::new(&path))
}

#[tauri::command]
pub fn open_wisdom_dialog(app: AppHandle) -> Result<Option<OpenResult>, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("Wisdom", &["wisdom"])
        .blocking_pick_file();
    let Some(file_path) = picked else {
        return Ok(None);
    };
    let path = file_path_to_pathbuf(file_path)?;
    Ok(Some(open_path_inner(&app, &path)?))
}

#[tauri::command]
pub fn save_wisdom(app: AppHandle, path: String, data: Value) -> Result<(), String> {
    let path = PathBuf::from(path);
    wisdom_io::write_wisdom(&path, &data)?;
    let _ = recent::push_recent(&config_dir(&app)?, &path);
    Ok(())
}

#[tauri::command]
pub fn save_wisdom_as(app: AppHandle, data: Value) -> Result<Option<String>, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("Wisdom", &["wisdom"])
        .set_file_name("untitled.wisdom")
        .blocking_save_file();
    let Some(file_path) = picked else {
        return Ok(None);
    };
    let mut path = file_path_to_pathbuf(file_path)?;
    if path.extension().is_none() {
        path.set_extension("wisdom");
    }
    wisdom_io::write_wisdom(&path, &data)?;
    let _ = recent::push_recent(&config_dir(&app)?, &path);
    Ok(Some(path.to_string_lossy().to_string()))
}

fn norm_path(path: &Path) -> String {
    path.to_string_lossy()
        .replace('\\', "/")
        .trim_end_matches('/')
        .to_lowercase()
}

#[tauri::command]
pub fn open_wisdom_dialog_many(app: AppHandle) -> Result<Vec<OpenResult>, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("Wisdom", &["wisdom"])
        .blocking_pick_files();
    let Some(files) = picked else {
        return Ok(Vec::new());
    };
    let mut out = Vec::new();
    for file_path in files {
        let path = file_path_to_pathbuf(file_path)?;
        out.push(open_path_inner(&app, &path)?);
    }
    Ok(out)
}

#[tauri::command]
pub fn save_merged_wisdom(
    app: AppHandle,
    data: Value,
    default_name: String,
    blocked_paths: Vec<String>,
) -> Result<Option<String>, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("Wisdom", &["wisdom"])
        .set_file_name(&default_name)
        .blocking_save_file();
    let Some(file_path) = picked else {
        return Ok(None);
    };
    let mut path = file_path_to_pathbuf(file_path)?;
    if path.extension().is_none() {
        path.set_extension("wisdom");
    }
    let save_norm = norm_path(&path);
    for blocked in blocked_paths {
        if save_norm == norm_path(Path::new(&blocked)) {
            return Err("不能覆盖参与合并的原文件，请另存为新文件".into());
        }
    }
    wisdom_io::write_wisdom(&path, &data)?;
    let _ = recent::push_recent(&config_dir(&app)?, &path);
    Ok(Some(path.to_string_lossy().to_string()))
}
