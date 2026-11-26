> Vendored from tauri-plugin-keep-screen-on 0.1.4 (https://gitlab.com/cristofa/tauri-plugin-keep-screen-on, MIT OR Apache-2.0).
> Changed: the Android library no longer sets `targetSdk`, which Android Gradle Plugin 9 (Tauri CLI 2.12's Android template) rejects; compileSdk 36, minSdk 24 like the app.

# Tauri Plugin keep-screen-on

Provides commands to disable automatic screen dimming in Android and iOS.

## Install

> If you are installing from npm and crate.io package registry, make sure the versions for both packages are the same, otherwise, the API may not match.

Install the Core plugin by adding the following to your `Cargo.toml` file:

`src-tauri/Cargo.toml`

```toml
[dependencies]
tauri-plugin-keep-screen-on = "0.1.2"
```


You can install the JavaScript Guest bindings using your preferred JavaScript package manager:

```sh
pnpm add tauri-plugin-keep-screen-on-api
# or
npm add tauri-plugin-keep-screen-on-api
# or
yarn add tauri-plugin-keep-screen-on-api
```

## Usage

First you need to register the core plugin with Tauri:

```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_keep_screen_on::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Afterwards all the plugin's APIs are available through the JavaScript guest bindings:

```typescript
import { keepScreenOn } from "tauri-plugin-keep-screen-on-api";

keepScreenOn(true);

```

Or in Leptos:

```rust
#[derive(Serialize)]
struct KeepScreenOnArgs {
    enable: bool,
}


invoke(
        "plugin:keep-screen-on|keep_screen_on",
        to_value(&KeepScreenOnArgs { enable: true })
        .expect("Failed to serialize KeepScreenOnArgs"),
      )
.await
.unwrap();


```

## License

Code: (c) 2015 - Present - The Tauri Programme within The Commons Conservancy.

MIT or MIT/Apache 2.0 where applicable.
