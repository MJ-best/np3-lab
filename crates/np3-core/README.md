# np3-core

High-performance Rust core library for **np3-lab**:
- **RAW (NEF/NRW) Parser**: Fast zero-copy TIFF header parser & embedded JPEG extractor (`raw.rs`)
- **EXIF Parser**: Fast metadata reader for camera model, lens, exposure, focal length, ISO, and date (`exif.rs`)
- **Nikon Classic Picture Control (.NCP)**: Complete 638-byte serializer, parser, and converter (`ncp.rs`)
- **Nikon Flexible Color Picture Control (.NP3)**: Complete binary serializer, parser, tone curve, and blender/grading engine (`np3.rs`)
- **Tone Curve**: Fritsch-Carlson monotone cubic spline interpolation & 257-sample LUT generator (`tone_curve.rs`)
- **WASM Bindings**: WebAssembly bindings for Web, Capacitor, and Desktop JavaScript/TypeScript runtime (`wasm.rs`)

## Building and Testing

```bash
# Run unit tests
cargo test

# Build for WebAssembly (WASM)
cargo build --target wasm32-unknown-unknown --release
```
