const COMMANDS: &[&str] = &["set_brightness", "get_brightness"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .ios_path("ios")
        .build();
}
