use std::process::{Child, Command};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[tauri::command]
fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
  std::fs::read(&path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let child_holder: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(None));
  let child_for_setup = child_holder.clone();
  let child_for_exit = child_holder.clone();

  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .invoke_handler(tauri::generate_handler![read_binary_file])
    .setup(move |app| {
      // Iniciar el servidor local de IA en segundo plano silencioso
      let base_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| std::path::PathBuf::from("."));

      let runtime_root = base_dir.join("runtime").join("python.exe");
      let runtime_scripts = base_dir.join("runtime").join("Scripts").join("python.exe");
      let venv_python = base_dir.join("venv").join("Scripts").join("python.exe");

      let python_target = if runtime_root.exists() {
        runtime_root
      } else if runtime_scripts.exists() {
        runtime_scripts
      } else if venv_python.exists() {
        venv_python
      } else {
        std::path::PathBuf::from("python")
      };

      let mut cmd = Command::new(python_target);
      cmd.arg(base_dir.join("server.py"));
      cmd.current_dir(&base_dir);

      #[cfg(windows)]
      cmd.creation_flags(0x08000000);

      match cmd.spawn() {
        Ok(child) => {
          let mut guard = child_for_setup.lock().unwrap();
          *guard = Some(child);
        }
        Err(e) => {
          eprintln!("Fallo al arrancar el servidor backend: {:?}", e);
        }
      }

      // Escuchar eventos nativos de Drag & Drop de archivos de Windows
      if let Some(window) = app.get_webview_window("main") {
        #[cfg(debug_assertions)]
        window.open_devtools();

        let win_clone = window.clone();
        window.on_window_event(move |event| {
          if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event {
            if let Some(first_path) = paths.first() {
              let path_str = first_path.to_string_lossy().to_string();
              let _ = win_clone.emit("file-dropped", path_str);
            }
          }
        });
      }

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(move |_app_handle, event| {
      if let tauri::RunEvent::Exit = event {
        let mut guard = child_for_exit.lock().unwrap();
        if let Some(mut child) = guard.take() {
          let _ = child.kill();
        }
      }
    });
}
