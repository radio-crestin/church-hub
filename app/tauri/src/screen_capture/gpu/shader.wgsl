// Draws the latest frame as one textured quad (two triangles from six
// vertex indices), placed and cropped by the Quad uniform (fit_quad.rs).

struct Quad {
    scale: vec2<f32>,
    uv_offset: vec2<f32>,
    uv_scale: vec2<f32>,
    pad: vec2<f32>,
};

@group(0) @binding(0) var frame_texture: texture_2d<f32>;
@group(0) @binding(1) var frame_sampler: sampler;
@group(0) @binding(2) var<uniform> quad: Quad;

struct VertexOut {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) index: u32) -> VertexOut {
    var corners = array<vec2<f32>, 6>(
        vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 0.0), vec2<f32>(0.0, 1.0),
        vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 0.0), vec2<f32>(1.0, 1.0),
    );
    let corner = corners[index];
    var out: VertexOut;
    let clip = vec2<f32>(corner.x * 2.0 - 1.0, 1.0 - corner.y * 2.0) * quad.scale;
    out.position = vec4<f32>(clip, 0.0, 1.0);
    out.uv = quad.uv_offset + corner * quad.uv_scale;
    return out;
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
    return textureSample(frame_texture, frame_sampler, in.uv);
}
