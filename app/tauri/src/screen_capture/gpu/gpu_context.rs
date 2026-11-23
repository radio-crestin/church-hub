//! The one GPU device every share surface draws with, created on first use.
//! None when this machine has no usable GPU adapter: the projector pages then
//! show the shared stream themselves (the canvas fallback).

use crate::screen_capture::log::{log, Level};
use std::sync::{Arc, OnceLock};

pub struct GpuContext {
    pub instance: wgpu::Instance,
    pub adapter: wgpu::Adapter,
    pub device: wgpu::Device,
    pub queue: wgpu::Queue,
}

pub fn gpu_context() -> Option<Arc<GpuContext>> {
    static CONTEXT: OnceLock<Option<Arc<GpuContext>>> = OnceLock::new();
    CONTEXT
        .get_or_init(|| match create() {
            Ok(context) => Some(Arc::new(context)),
            Err(e) => {
                log(
                    Level::Warning,
                    &format!("no GPU, projector pages draw the share: {e}"),
                );
                None
            }
        })
        .clone()
}

fn create() -> Result<GpuContext, String> {
    let instance =
        wgpu::Instance::new(wgpu::InstanceDescriptor::new_without_display_handle_from_env());
    let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
        power_preference: wgpu::PowerPreference::HighPerformance,
        ..Default::default()
    }))
    .map_err(|e| format!("no GPU adapter: {e}"))?;
    let info = adapter.get_info();
    log(
        Level::Info,
        &format!("GPU: {} ({:?})", info.name, info.backend),
    );
    let (device, queue) = pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor {
        label: Some("screen-share"),
        ..Default::default()
    }))
    .map_err(|e| format!("no GPU device: {e}"))?;
    Ok(GpuContext {
        instance,
        adapter,
        device,
        queue,
    })
}

#[cfg(test)]
mod tests {
    /// Needs a GPU (or a software adapter): `cargo test -- --ignored`.
    #[test]
    #[ignore]
    fn finds_a_gpu_device() {
        let gpu = super::gpu_context().expect("a GPU device");
        println!("GPU: {}", gpu.adapter.get_info().name);
    }
}
