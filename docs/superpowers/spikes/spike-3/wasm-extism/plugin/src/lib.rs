use extism_pdk::*;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct Input {
    message: String,
}

#[derive(Serialize)]
struct Output {
    echoed: String,
    rejected_if_secret: bool,
}

#[plugin_fn]
pub fn echo(input: String) -> FnResult<String> {
    let parsed: Input =
        serde_json::from_str(&input).map_err(|e| WithReturnCode::new(e, 1))?;
    let rejected = parsed.message.contains("secret");
    let out = Output {
        echoed: if rejected {
            "REJECTED".to_string()
        } else {
            parsed.message
        },
        rejected_if_secret: rejected,
    };
    Ok(serde_json::to_string(&out).map_err(|e| WithReturnCode::new(e, 1))?)
}
