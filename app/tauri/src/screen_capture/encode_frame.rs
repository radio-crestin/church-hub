//! Scales a captured image down to fit the stream's bounds and encodes it as
//! JPEG for the browser screens; the scaled RGBA goes to the GPU surfaces.

use image::codecs::jpeg::JpegEncoder;
use image::imageops::FilterType;
use image::{DynamicImage, ExtendedColorType, RgbaImage};

/// The largest frame sent to the screens: projectors are 1080p at most.
pub const MAX_WIDTH: u32 = 1920;
pub const MAX_HEIGHT: u32 = 1080;
const JPEG_QUALITY: u8 = 80;

/// The size `width`x`height` takes when scaled down (never up) to fit within
/// `max_width`x`max_height`, keeping its aspect ratio; at least 1x1.
pub fn fit_within(width: u32, height: u32, max_width: u32, max_height: u32) -> (u32, u32) {
    if width <= max_width && height <= max_height {
        return (width.max(1), height.max(1));
    }
    let scale = f64::min(
        max_width as f64 / width as f64,
        max_height as f64 / height as f64,
    );
    let w = ((width as f64 * scale).round() as u32).clamp(1, max_width);
    let h = ((height as f64 * scale).round() as u32).clamp(1, max_height);
    (w, h)
}

pub struct EncodedFrame {
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
    pub jpeg: Vec<u8>,
}

pub fn encode_frame(image: RgbaImage, max_width: u32, max_height: u32) -> Result<EncodedFrame, String> {
    let (w, h) = fit_within(image.width(), image.height(), max_width, max_height);
    let scaled = if (w, h) == image.dimensions() {
        image
    } else {
        image::imageops::resize(&image, w, h, FilterType::Triangle)
    };
    let jpeg = encode_jpeg(&scaled)?;
    Ok(EncodedFrame {
        width: w,
        height: h,
        rgba: scaled.into_raw(),
        jpeg,
    })
}

pub fn encode_jpeg(image: &RgbaImage) -> Result<Vec<u8>, String> {
    // JPEG has no alpha: drop it before encoding.
    let rgb = DynamicImage::ImageRgba8(image.clone()).into_rgb8();
    let mut jpeg = Vec::new();
    JpegEncoder::new_with_quality(&mut jpeg, JPEG_QUALITY)
        .encode(rgb.as_raw(), rgb.width(), rgb.height(), ExtendedColorType::Rgb8)
        .map_err(|e| format!("JPEG encode failed: {e}"))?;
    Ok(jpeg)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fit_within_keeps_small_frames() {
        assert_eq!(fit_within(1280, 720, MAX_WIDTH, MAX_HEIGHT), (1280, 720));
    }

    #[test]
    fn fit_within_scales_down_keeping_the_ratio() {
        assert_eq!(fit_within(3840, 2160, MAX_WIDTH, MAX_HEIGHT), (1920, 1080));
        // A tall window is bound by its height.
        assert_eq!(fit_within(1000, 2160, MAX_WIDTH, MAX_HEIGHT), (500, 1080));
        // An ultrawide screen is bound by its width.
        assert_eq!(fit_within(5120, 1440, MAX_WIDTH, MAX_HEIGHT), (1920, 540));
    }

    #[test]
    fn fit_within_never_returns_zero() {
        assert_eq!(fit_within(0, 0, MAX_WIDTH, MAX_HEIGHT), (1, 1));
        assert_eq!(fit_within(100_000, 1, MAX_WIDTH, MAX_HEIGHT), (1920, 1));
    }

    #[test]
    fn encode_frame_scales_and_produces_a_decodable_jpeg() {
        let image = RgbaImage::from_pixel(3840, 2160, image::Rgba([200, 30, 30, 255]));
        let frame = encode_frame(image, MAX_WIDTH, MAX_HEIGHT).unwrap();
        assert_eq!((frame.width, frame.height), (1920, 1080));
        assert_eq!(frame.rgba.len(), 1920 * 1080 * 4);
        assert_eq!(&frame.jpeg[..2], &[0xFF, 0xD8], "JPEG SOI marker");

        let decoded = image::load_from_memory_with_format(&frame.jpeg, image::ImageFormat::Jpeg)
            .unwrap()
            .into_rgb8();
        assert_eq!(decoded.dimensions(), (1920, 1080));
        let px = decoded.get_pixel(960, 540);
        assert!(px[0] > 180 && px[1] < 60 && px[2] < 60, "red survives: {px:?}");
    }
}
