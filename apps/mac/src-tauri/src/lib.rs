use tauri::Manager;
use tauri_plugin_shell::{process::CommandEvent, ShellExt};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Spawn the engine sidecar (bun-compiled binary). Logs are forwarded
            // to the Tauri devtools console.
            let sidecar = app
                .shell()
                .sidecar("dyad-engine")
                .expect("missing sidecar binary dyad-engine");

            let (mut rx, _child) = sidecar
                .spawn()
                .expect("failed to spawn dyad-engine sidecar");

            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            println!("[dyad-engine] {}", String::from_utf8_lossy(&line))
                        }
                        CommandEvent::Stderr(line) => {
                            eprintln!("[dyad-engine] {}", String::from_utf8_lossy(&line))
                        }
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
