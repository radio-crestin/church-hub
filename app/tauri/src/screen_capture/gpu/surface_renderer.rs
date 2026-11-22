//! Draws the hub's latest frame onto one window's GPU surface, on its own
//! thread, whenever a new frame arrives or the surface changes.

use super::fit_quad::{fit_quad, ObjectFit, Quad};
use super::gpu_context::GpuContext;
use crate::screen_capture::frame_hub::{Frame, FrameHub};
use crate::screen_capture::log::{log, Level};
use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::JoinHandle;
use std::time::Duration;

const WAIT_STEP: Duration = Duration::from_millis(100);

/// What the page asked for: the surface's size in physical pixels and how
/// the frame fits it.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SurfaceLayout {
    pub width: u32,
    pub height: u32,
    pub fit: ObjectFit,
}

pub struct SurfaceRenderer {
    layout: Arc<Mutex<SurfaceLayout>>,
    stop: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
}

impl SurfaceRenderer {
    pub fn start(
        gpu: Arc<GpuContext>,
        surface: wgpu::Surface<'static>,
        hub: Arc<FrameHub>,
        layout: SurfaceLayout,
    ) -> Result<SurfaceRenderer, String> {
        let mut state = DrawState::new(gpu, surface, layout)?;
        let layout = Arc::new(Mutex::new(layout));
        let stop = Arc::new(AtomicBool::new(false));
        let (thread_layout, thread_stop) = (layout.clone(), stop.clone());
        let handle = std::thread::Builder::new()
            .name("screen-share-gpu".into())
            .spawn(move || {
                let mut last_seq = 0;
                let mut drawn_layout = None;
                while !thread_stop.load(Ordering::SeqCst) {
                    let wanted = *thread_layout.lock();
                    let new_frame = hub.wait_newer(last_seq, WAIT_STEP);
                    if new_frame.is_none() && drawn_layout == Some(wanted) {
                        continue;
                    }
                    let Some(frame) = new_frame.or_else(|| hub.latest()) else {
                        continue;
                    };
                    last_seq = frame.seq;
                    state.draw(&frame, wanted);
                    drawn_layout = Some(wanted);
                }
            })
            .map_err(|e| format!("spawn GPU thread: {e}"))?;
        Ok(SurfaceRenderer {
            layout,
            stop,
            handle: Some(handle),
        })
    }

    pub fn set_layout(&self, layout: SurfaceLayout) {
        *self.layout.lock() = layout;
    }

    pub fn stop(mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
    }
}

struct DrawState {
    gpu: Arc<GpuContext>,
    surface: wgpu::Surface<'static>,
    config: wgpu::SurfaceConfiguration,
    pipeline: wgpu::RenderPipeline,
    bind_layout: wgpu::BindGroupLayout,
    sampler: wgpu::Sampler,
    quad_buffer: wgpu::Buffer,
    texture: Option<(wgpu::Texture, wgpu::BindGroup, (u32, u32))>,
}

impl DrawState {
    fn new(
        gpu: Arc<GpuContext>,
        surface: wgpu::Surface<'static>,
        layout: SurfaceLayout,
    ) -> Result<DrawState, String> {
        let device = &gpu.device;
        let caps = surface.get_capabilities(&gpu.adapter);
        let format = caps
            .formats
            .iter()
            .copied()
            .find(|f| f.is_srgb())
            .or_else(|| caps.formats.first().copied())
            .ok_or("the GPU cannot draw on this window")?;
        let mut config = surface
            .get_default_config(&gpu.adapter, layout.width.max(1), layout.height.max(1))
            .ok_or("the GPU cannot draw on this window")?;
        config.format = format;
        config.present_mode = wgpu::PresentMode::Fifo;
        surface.configure(device, &config);

        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("screen-share"),
            source: wgpu::ShaderSource::Wgsl(include_str!("shader.wgsl").into()),
        });
        let bind_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("screen-share"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Texture {
                        sample_type: wgpu::TextureSampleType::Float { filterable: true },
                        view_dimension: wgpu::TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::VERTEX,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });
        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("screen-share"),
            bind_group_layouts: &[Some(&bind_layout)],
            ..Default::default()
        });
        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("screen-share"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                compilation_options: Default::default(),
                buffers: &[],
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("fs_main"),
                compilation_options: Default::default(),
                targets: &[Some(format.into())],
            }),
            primitive: Default::default(),
            depth_stencil: None,
            multisample: Default::default(),
            multiview_mask: None,
            cache: None,
        });
        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("screen-share"),
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });
        let quad_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("screen-share-quad"),
            size: std::mem::size_of::<Quad>() as u64,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        Ok(DrawState {
            gpu,
            surface,
            config,
            pipeline,
            bind_layout,
            sampler,
            quad_buffer,
            texture: None,
        })
    }

    fn draw(&mut self, frame: &Frame, layout: SurfaceLayout) {
        let (width, height) = (layout.width.max(1), layout.height.max(1));
        if (self.config.width, self.config.height) != (width, height) {
            self.config.width = width;
            self.config.height = height;
            self.surface.configure(&self.gpu.device, &self.config);
        }
        self.upload(frame);
        let quad = fit_quad(layout.fit, (width, height), (frame.width, frame.height));
        self.gpu
            .queue
            .write_buffer(&self.quad_buffer, 0, bytemuck::bytes_of(&quad));

        let target = match self.surface.get_current_texture() {
            wgpu::CurrentSurfaceTexture::Success(t)
            | wgpu::CurrentSurfaceTexture::Suboptimal(t) => t,
            wgpu::CurrentSurfaceTexture::Outdated | wgpu::CurrentSurfaceTexture::Lost => {
                self.surface.configure(&self.gpu.device, &self.config);
                return;
            }
            other => {
                log(Level::Trace, &format!("skip frame: {other:?}"));
                return;
            }
        };
        let view = target.texture.create_view(&Default::default());
        let mut encoder = self.gpu.device.create_command_encoder(&Default::default());
        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("screen-share"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    depth_slice: None,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                ..Default::default()
            });
            if let Some((_, bind_group, _)) = &self.texture {
                pass.set_pipeline(&self.pipeline);
                pass.set_bind_group(0, bind_group, &[]);
                pass.draw(0..6, 0..1);
            }
        }
        self.gpu.queue.submit([encoder.finish()]);
        self.gpu.queue.present(target);
    }

    /// Copies the frame into the texture, (re)creating it when the size
    /// changed.
    fn upload(&mut self, frame: &Frame) {
        let size = (frame.width, frame.height);
        if self.texture.as_ref().map(|t| t.2) != Some(size) {
            let texture = self.gpu.device.create_texture(&wgpu::TextureDescriptor {
                label: Some("screen-share-frame"),
                size: extent(size),
                mip_level_count: 1,
                sample_count: 1,
                dimension: wgpu::TextureDimension::D2,
                format: wgpu::TextureFormat::Rgba8UnormSrgb,
                usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
                view_formats: &[],
            });
            let view = texture.create_view(&Default::default());
            let bind_group = self
                .gpu
                .device
                .create_bind_group(&wgpu::BindGroupDescriptor {
                    label: Some("screen-share"),
                    layout: &self.bind_layout,
                    entries: &[
                        wgpu::BindGroupEntry {
                            binding: 0,
                            resource: wgpu::BindingResource::TextureView(&view),
                        },
                        wgpu::BindGroupEntry {
                            binding: 1,
                            resource: wgpu::BindingResource::Sampler(&self.sampler),
                        },
                        wgpu::BindGroupEntry {
                            binding: 2,
                            resource: self.quad_buffer.as_entire_binding(),
                        },
                    ],
                });
            self.texture = Some((texture, bind_group, size));
        }
        let (texture, _, _) = self.texture.as_ref().expect("texture created above");
        self.gpu.queue.write_texture(
            wgpu::TexelCopyTextureInfo {
                texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            &frame.rgba,
            wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(4 * frame.width),
                rows_per_image: Some(frame.height),
            },
            extent(size),
        );
    }
}

fn extent((width, height): (u32, u32)) -> wgpu::Extent3d {
    wgpu::Extent3d {
        width,
        height,
        depth_or_array_layers: 1,
    }
}
