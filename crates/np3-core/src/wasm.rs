use wasm_bindgen::prelude::*;

use crate::exif::read_exif;
use crate::ncp::{ncp_bytes, to_ncp, NcpParams};
use crate::np3::{parse_np3, serialize_np3, with_np_name, RecipeParams};
use crate::raw::find_nef_preview;
use crate::tone_curve::{points_to_raw, CurvePoint};

#[wasm_bindgen]
pub fn wasm_find_nef_preview(head: &[u8], file_size: f64) -> Result<JsValue, JsValue> {
    match find_nef_preview(head, file_size as u64) {
        Some(preview) => serde_wasm_bindgen_to_value(&preview),
        None => Ok(JsValue::NULL),
    }
}

#[wasm_bindgen]
pub fn wasm_read_exif(bytes: &[u8]) -> Result<JsValue, JsValue> {
    match read_exif(bytes) {
        Some(exif) => serde_wasm_bindgen_to_value(&exif),
        None => Ok(JsValue::NULL),
    }
}

#[wasm_bindgen]
pub fn wasm_parse_np3(bytes: &[u8]) -> Result<JsValue, JsValue> {
    match parse_np3(bytes) {
        Ok(parsed) => serde_wasm_bindgen_to_value(&parsed),
        Err(err) => Err(JsValue::from_str(err)),
    }
}

#[wasm_bindgen]
pub fn wasm_serialize_np3(name: &str, params_json: &str) -> Result<Vec<u8>, JsValue> {
    let params: RecipeParams = serde_json::from_str(params_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid params JSON: {e}")))?;
    Ok(serialize_np3(name, &params))
}

#[wasm_bindgen]
pub fn wasm_with_np_name(bytes: &[u8], name: &str) -> Vec<u8> {
    with_np_name(bytes, name)
}

#[wasm_bindgen]
pub fn wasm_to_ncp(params_json: &str) -> Result<JsValue, JsValue> {
    let params: RecipeParams = serde_json::from_str(params_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid params JSON: {e}")))?;
    let ncp = to_ncp(&params);
    serde_wasm_bindgen_to_value(&ncp)
}

#[wasm_bindgen]
pub fn wasm_ncp_bytes(name: &str, ncp_json: &str) -> Result<Vec<u8>, JsValue> {
    let ncp: NcpParams = serde_json::from_str(ncp_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid NCP JSON: {e}")))?;
    Ok(ncp_bytes(name, &ncp))
}

#[wasm_bindgen]
pub fn wasm_points_to_raw(points_json: &str) -> Result<Vec<u16>, JsValue> {
    let points: Vec<CurvePoint> = serde_json::from_str(points_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid points JSON: {e}")))?;
    Ok(points_to_raw(&points))
}

fn serde_wasm_bindgen_to_value<T: serde::Serialize>(val: &T) -> Result<JsValue, JsValue> {
    let json_str = serde_json::to_string(val)
        .map_err(|e| JsValue::from_str(&format!("Serialization failed: {e}")))?;
    js_sys::JSON::parse(&json_str)
        .map_err(|e| JsValue::from_str(&format!("JSON parse error: {e:?}")))
}
