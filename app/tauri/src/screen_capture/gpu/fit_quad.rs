//! Where a frame lands on the GPU surface for a CSS `object-fit`: the quad's
//! half-size in clip space and the part of the texture it samples.

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ObjectFit {
    Contain,
    Cover,
    Fill,
}

/// The shader's uniform: `scale` is the quad's half-size in clip space
/// (1.0 fills the surface), `uv_offset`/`uv_scale` the sampled texture area.
#[repr(C)]
#[derive(Debug, Clone, Copy, PartialEq, bytemuck::Pod, bytemuck::Zeroable)]
pub struct Quad {
    pub scale: [f32; 2],
    pub uv_offset: [f32; 2],
    pub uv_scale: [f32; 2],
    pub _pad: [f32; 2],
}

pub fn fit_quad(fit: ObjectFit, surface: (u32, u32), frame: (u32, u32)) -> Quad {
    let full = Quad {
        scale: [1.0, 1.0],
        uv_offset: [0.0, 0.0],
        uv_scale: [1.0, 1.0],
        _pad: [0.0, 0.0],
    };
    let (sw, sh) = (surface.0.max(1) as f32, surface.1.max(1) as f32);
    let (fw, fh) = (frame.0.max(1) as f32, frame.1.max(1) as f32);
    // > 1: the frame is wider than the surface.
    let ratio = (fw / fh) / (sw / sh);
    match fit {
        ObjectFit::Fill => full,
        ObjectFit::Contain if ratio >= 1.0 => Quad {
            scale: [1.0, 1.0 / ratio],
            ..full
        },
        ObjectFit::Contain => Quad {
            scale: [ratio, 1.0],
            ..full
        },
        ObjectFit::Cover if ratio >= 1.0 => {
            let visible = 1.0 / ratio;
            Quad {
                uv_offset: [(1.0 - visible) / 2.0, 0.0],
                uv_scale: [visible, 1.0],
                ..full
            }
        }
        ObjectFit::Cover => Quad {
            uv_offset: [0.0, (1.0 - ratio) / 2.0],
            uv_scale: [1.0, ratio],
            ..full
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: [f32; 2], b: [f32; 2]) -> bool {
        (a[0] - b[0]).abs() < 1e-5 && (a[1] - b[1]).abs() < 1e-5
    }

    #[test]
    fn same_ratio_fills_whatever_the_fit() {
        for fit in [ObjectFit::Contain, ObjectFit::Cover, ObjectFit::Fill] {
            let q = fit_quad(fit, (1920, 1080), (1280, 720));
            assert!(close(q.scale, [1.0, 1.0]) && close(q.uv_scale, [1.0, 1.0]), "{fit:?}");
        }
    }

    #[test]
    fn contain_letterboxes_a_wide_frame() {
        // 2:1 frame on a 16:9 surface: full width, shorter height.
        let q = fit_quad(ObjectFit::Contain, (1600, 900), (2000, 1000));
        assert!(close(q.scale, [1.0, (16.0 / 9.0) / 2.0]));
        assert!(close(q.uv_scale, [1.0, 1.0]));
    }

    #[test]
    fn contain_pillarboxes_a_tall_frame() {
        let q = fit_quad(ObjectFit::Contain, (1000, 1000), (500, 1000));
        assert!(close(q.scale, [0.5, 1.0]));
    }

    #[test]
    fn cover_crops_the_sides_of_a_wide_frame() {
        let q = fit_quad(ObjectFit::Cover, (1000, 1000), (2000, 1000));
        assert!(close(q.scale, [1.0, 1.0]));
        assert!(close(q.uv_offset, [0.25, 0.0]) && close(q.uv_scale, [0.5, 1.0]));
    }

    #[test]
    fn cover_crops_top_and_bottom_of_a_tall_frame() {
        let q = fit_quad(ObjectFit::Cover, (1000, 1000), (1000, 2000));
        assert!(close(q.uv_offset, [0.0, 0.25]) && close(q.uv_scale, [1.0, 0.5]));
    }

    #[test]
    fn fill_stretches() {
        let q = fit_quad(ObjectFit::Fill, (1000, 1000), (3000, 100));
        assert!(close(q.scale, [1.0, 1.0]) && close(q.uv_scale, [1.0, 1.0]));
    }

    #[test]
    fn object_fit_parses_from_the_css_value() {
        let fit: ObjectFit = serde_json::from_str("\"cover\"").unwrap();
        assert_eq!(fit, ObjectFit::Cover);
    }
}
