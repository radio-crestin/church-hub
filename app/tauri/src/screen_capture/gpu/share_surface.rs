//! The native share surfaces: for each projector window showing the share, a
//! borderless window owned by it (so it stays above it and goes away with
//! it), placed over the share's area, that the GPU draws the frames on.

use super::fit_quad::ObjectFit;
use super::gpu_context::{gpu_context, GpuContext};
use super::surface_renderer::{SurfaceLayout, SurfaceRenderer};
use crate::screen_capture::frame_hub::FrameHub;
use crate::screen_capture::log::{log, Level};
use parking_lot::Mutex;
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tauri::{Manager, PhysicalPosition, PhysicalSize, Runtime, Window, WindowEvent};

/// The share's area in the projector page, in CSS pixels from the top-left
/// of its viewport.
#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
pub struct SurfaceRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

struct ShareSurface<R: Runtime> {
    window: Window<R>,
    renderer: SurfaceRenderer,
    rect: SurfaceRect,
    fit: ObjectFit,
}

pub struct ShareSurfaces<R: Runtime> {
    surfaces: Mutex<HashMap<String, ShareSurface<R>>>,
    /// Projector windows whose moves we already follow.
    followed: Mutex<HashSet<String>>,
}

impl<R: Runtime> Default for ShareSurfaces<R> {
    fn default() -> Self {
        ShareSurfaces {
            surfaces: Mutex::new(HashMap::new()),
            followed: Mutex::new(HashSet::new()),
        }
    }
}

impl<R: Runtime> ShareSurfaces<R> {
    /// Shows (or moves) the surface over `display`'s share area. Ok(false)
    /// when the GPU can't draw here: the page then draws the share itself.
    pub fn show(
        &self,
        display: &Window<R>,
        rect: SurfaceRect,
        fit: ObjectFit,
        hub: Arc<FrameHub>,
    ) -> Result<bool, String> {
        let label = display.label().to_string();
        let (position, size) = place(display, rect)?;
        let layout = SurfaceLayout {
            width: size.width,
            height: size.height,
            fit,
        };
        if let Some(surface) = self.surfaces.lock().get_mut(&label) {
            surface.window.set_position(position).map_err(|e| e.to_string())?;
            surface.window.set_size(size).map_err(|e| e.to_string())?;
            surface.renderer.set_layout(layout);
            surface.rect = rect;
            surface.fit = fit;
            return Ok(true);
        }
        let Some(gpu) = gpu_context() else {
            return Ok(false);
        };
        let window = create_window(display, position, size)?;
        let renderer = match create_surface(display, &gpu, &window)
            .and_then(|surface| SurfaceRenderer::start(gpu, surface, hub, layout))
        {
            Ok(renderer) => renderer,
            Err(e) => {
                log(Level::Warning, &format!("GPU surface for {label} failed, page draws instead: {e}"));
                let _ = window.destroy();
                return Ok(false);
            }
        };
        log(Level::Info, &format!("GPU surface over {label}: {}x{}", size.width, size.height));
        self.surfaces.lock().insert(
            label.clone(),
            ShareSurface {
                window,
                renderer,
                rect,
                fit,
            },
        );
        self.follow_moves(display);
        Ok(true)
    }

    pub fn hide(&self, display_label: &str) {
        let removed = self.surfaces.lock().remove(display_label);
        if let Some(surface) = removed {
            close(surface);
        }
    }

    pub fn hide_all(&self) {
        let all: Vec<_> = self.surfaces.lock().drain().map(|(_, s)| s).collect();
        all.into_iter().for_each(close);
    }

    /// Keeps the surface over its projector window when that window moves,
    /// and drops it when the window closes.
    fn follow_moves(&self, display: &Window<R>) {
        if !self.followed.lock().insert(display.label().to_string()) {
            return;
        }
        let app = display.app_handle().clone();
        let watched = display.clone();
        display.on_window_event(move |event| {
            let Some(state) = app.try_state::<crate::screen_capture::ScreenCapture<R>>() else {
                return;
            };
            match event {
                WindowEvent::Moved(_) => {
                    let current = state
                        .surfaces
                        .surfaces
                        .lock()
                        .get(watched.label())
                        .map(|s| (s.rect, s.fit));
                    if let Some((rect, fit)) = current {
                        let _ = state.surfaces.show(&watched, rect, fit, state.hub.clone());
                    }
                }
                WindowEvent::Destroyed => {
                    state.surfaces.hide(watched.label());
                    state.surfaces.followed.lock().remove(watched.label());
                }
                _ => {}
            }
        });
    }
}

fn close<R: Runtime>(surface: ShareSurface<R>) {
    surface.renderer.stop();
    let _ = surface.window.destroy();
}

/// The surface's screen position and size, in physical pixels.
fn place<R: Runtime>(
    display: &Window<R>,
    rect: SurfaceRect,
) -> Result<(PhysicalPosition<i32>, PhysicalSize<u32>), String> {
    let scale = display.scale_factor().map_err(|e| e.to_string())?;
    let origin = display.inner_position().map_err(|e| e.to_string())?;
    let position = PhysicalPosition::new(
        origin.x + (rect.x * scale).round() as i32,
        origin.y + (rect.y * scale).round() as i32,
    );
    let size = PhysicalSize::new(
        ((rect.width * scale).round() as u32).max(1),
        ((rect.height * scale).round() as u32).max(1),
    );
    Ok((position, size))
}

fn create_window<R: Runtime>(
    display: &Window<R>,
    position: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
) -> Result<Window<R>, String> {
    let label = format!("share-surface-{}", display.label());
    let window = tauri::window::WindowBuilder::new(display, label)
        .decorations(false)
        .resizable(false)
        .skip_taskbar(true)
        .shadow(false)
        .focused(false)
        .focusable(false)
        .visible(false)
        .parent(display)
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| format!("create surface window: {e}"))?;
    window.set_position(position).map_err(|e| e.to_string())?;
    window.set_size(size).map_err(|e| e.to_string())?;
    // A projector shows; it is never clicked.
    let _ = window.set_ignore_cursor_events(true);
    window.show().map_err(|e| e.to_string())?;
    Ok(window)
}

/// Creates the GPU surface on the main thread (macOS requires it for the
/// Metal layer; it costs nothing elsewhere).
fn create_surface<R: Runtime>(
    display: &Window<R>,
    gpu: &Arc<GpuContext>,
    window: &Window<R>,
) -> Result<wgpu::Surface<'static>, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    let (gpu, target) = (gpu.clone(), window.clone());
    display
        .run_on_main_thread(move || {
            let _ = tx.send(gpu.instance.create_surface(target).map_err(|e| e.to_string()));
        })
        .map_err(|e| e.to_string())?;
    rx.recv().map_err(|e| e.to_string())?
}
