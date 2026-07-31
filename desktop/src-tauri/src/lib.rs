mod commands;
mod recent;
mod wisdom_io;

use commands::AppState;
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri::menu::{MenuBuilder, PredefinedMenuItem, SubmenuBuilder};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            startup_path: Mutex::new(None),
        })
        .setup(|app| {
            let mut open_path: Option<String> = None;
            for arg in std::env::args().skip(1) {
                let lower = arg.to_lowercase();
                if lower.ends_with(".wisdom") {
                    open_path = Some(arg);
                    break;
                }
            }
            if let Ok(mut guard) = app.state::<AppState>().startup_path.lock() {
                *guard = open_path;
            }

            let file_menu = SubmenuBuilder::new(app, "文件")
                .text("menu-open", "打开…")
                .text("menu-save", "保存")
                .text("menu-save-as", "另存为…")
                .separator()
                .item(&PredefinedMenuItem::quit(app, Some("退出"))?)
                .build()?;

            let menu = MenuBuilder::new(app).item(&file_menu).build()?;
            app.set_menu(menu)?;

            let handle = app.handle().clone();
            app.on_menu_event(move |_app, event| {
                let id = event.id().0.as_str();
                let event_name = match id {
                    "menu-open" => Some("menu-open"),
                    "menu-save" => Some("menu-save"),
                    "menu-save-as" => Some("menu-save-as"),
                    _ => None,
                };
                if let Some(name) = event_name {
                    let _ = handle.emit(name, ());
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_startup_state,
            commands::list_recent,
            commands::open_wisdom_path,
            commands::open_wisdom_dialog,
            commands::save_wisdom,
            commands::save_wisdom_as,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
