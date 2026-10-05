//! Local review builds (app/scripts/review-build.ts). One shell binary, built
//! with the `review-shell` feature, serves every task: each task's copy carries
//! a `review-build.json` with its own port, data folder, identity and web
//! build, so the Rust shell is compiled once and only the web build and the
//! sidecar change per task. Release builds leave the feature off: every
//! function here is then a no-op, and the app uses port 3000 and the real data.

use std::path::PathBuf;

#[cfg(feature = "review-shell")]
mod shell {
    use serde::Deserialize;
    use std::borrow::Cow;
    use std::path::{Component, Path, PathBuf};
    use std::sync::OnceLock;
    use tauri::utils::assets::{AssetKey, AssetsIter, CspHash};

    const FILE_NAME: &str = "review-build.json";

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct ReviewBuild {
        pub port: u16,
        pub data_dir: PathBuf,
        pub identifier: String,
        pub title: String,
        pub client_dist: PathBuf,
    }

    /// Next to the executable; on macOS among the bundle's resources, so the
    /// code folder holds only code.
    fn file() -> PathBuf {
        let exe = std::env::current_exe().expect("review shell: no executable path");
        let exe_dir = exe.parent().expect("review shell: executable has no folder");
        if cfg!(target_os = "macos") {
            exe_dir.join("..").join("Resources").join(FILE_NAME)
        } else {
            exe_dir.join(FILE_NAME)
        }
    }

    /// A review shell without its file would take port 3000 and the real
    /// data, so it refuses to start instead.
    pub fn review_build() -> &'static ReviewBuild {
        static REVIEW: OnceLock<ReviewBuild> = OnceLock::new();
        REVIEW.get_or_init(|| {
            let path = file();
            let text = std::fs::read_to_string(&path)
                .unwrap_or_else(|err| panic!("review shell: cannot read {path:?}: {err}"));
            serde_json::from_str(&text)
                .unwrap_or_else(|err| panic!("review shell: invalid {path:?}: {err}"))
        })
    }

    /// Serves the task's web build from its folder instead of the assets
    /// embedded at compile time; same `tauri://` origin, IPC and CSP config.
    pub struct DiskAssets(pub PathBuf);

    impl DiskAssets {
        fn path_of(&self, key: &AssetKey) -> Option<PathBuf> {
            let relative = Path::new(key.as_ref().trim_start_matches('/'));
            let inside = relative
                .components()
                .all(|part| matches!(part, Component::Normal(_)));
            inside.then(|| self.0.join(relative))
        }
    }

    impl<R: tauri::Runtime> tauri::Assets<R> for DiskAssets {
        fn get(&self, key: &AssetKey) -> Option<Cow<'_, [u8]>> {
            std::fs::read(self.path_of(key)?).ok().map(Cow::Owned)
        }

        fn iter(&self) -> Box<AssetsIter<'_>> {
            Box::new(std::iter::empty())
        }

        fn csp_hashes(&self, _html_path: &AssetKey) -> Box<dyn Iterator<Item = CspHash<'_>> + '_> {
            Box::new(std::iter::empty())
        }
    }
}

/// The review build's own server port; None in a release build (port 3000).
pub fn server_port() -> Option<u16> {
    #[cfg(feature = "review-shell")]
    return Some(shell::review_build().port);
    #[cfg(not(feature = "review-shell"))]
    None
}

/// The review build's own data folder; None in a release build (real data).
pub fn data_dir() -> Option<PathBuf> {
    #[cfg(feature = "review-shell")]
    return Some(shell::review_build().data_dir.clone());
    #[cfg(not(feature = "review-shell"))]
    None
}

/// Gives a review build its own identity (bundle identifier, so app folders,
/// single instance and window state stay apart), window titles, web build and
/// a dead updater endpoint, so an update never replaces it with the release.
#[allow(unused_variables)]
pub fn apply<R: tauri::Runtime>(context: &mut tauri::Context<R>) {
    #[cfg(feature = "review-shell")]
    {
        let review = shell::review_build();
        let config = context.config_mut();
        config.identifier = review.identifier.clone();
        for window in &mut config.app.windows {
            window.title = review.title.clone();
        }
        if let Some(updater) = config.plugins.0.get_mut("updater") {
            updater["endpoints"] =
                serde_json::json!(["https://127.0.0.1:9/review-builds-never-update"]);
        }
        context.set_assets(Box::new(shell::DiskAssets(review.client_dist.clone())));
    }
}
