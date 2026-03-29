use axum::{
    http::{
        header::{ACCEPT, CONTENT_TYPE},
        HeaderValue, Method,
    },
    response::Response,
};
use tower_http::cors::{Any, CorsLayer};

pub fn build_cors_layer() -> CorsLayer {
    let origins = configured_origins();

    let layer = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([CONTENT_TYPE, ACCEPT]);

    if origins.is_empty() {
        tracing::warn!("ALLOWED_ORIGINS not set; allowing any origin");
        layer.allow_origin(Any)
    } else {
        tracing::info!("Restricting CORS to {} configured origin(s)", origins.len());
        layer.allow_origin(origins)
    }
}

pub async fn set_security_headers<B>(mut response: Response<B>) -> Response<B> {
    let headers = response.headers_mut();
    headers.insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
    headers.insert("x-frame-options", HeaderValue::from_static("DENY"));
    headers.insert(
        "referrer-policy",
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
    headers.insert(
        "permissions-policy",
        HeaderValue::from_static("camera=(self), microphone=(), geolocation=()"),
    );
    response
}

fn configured_origins() -> Vec<HeaderValue> {
    std::env::var("ALLOWED_ORIGINS")
        .map(|raw| parse_allowed_origins(&raw))
        .unwrap_or_default()
}

fn parse_allowed_origins(raw: &str) -> Vec<HeaderValue> {
    raw.split(',')
        .filter_map(|origin| {
            let trimmed = origin.trim();
            if trimmed.is_empty()
                || !(trimmed.starts_with("http://") || trimmed.starts_with("https://"))
            {
                return None;
            }
            HeaderValue::from_str(trimmed).ok()
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::parse_allowed_origins;

    #[test]
    fn test_parse_allowed_origins_trims_and_filters_empty_values() {
        let origins = parse_allowed_origins(" https://pop.nervos.org, ,http://localhost:3000 ");
        let values: Vec<_> = origins
            .into_iter()
            .map(|value| value.to_str().unwrap().to_string())
            .collect();

        assert_eq!(
            values,
            vec![
                "https://pop.nervos.org".to_string(),
                "http://localhost:3000".to_string(),
            ]
        );
    }

    #[test]
    fn test_parse_allowed_origins_ignores_invalid_headers() {
        let origins = parse_allowed_origins("https://valid.example,\ninvalid");
        let values: Vec<_> = origins
            .into_iter()
            .map(|value| value.to_str().unwrap().to_string())
            .collect();

        assert_eq!(values, vec!["https://valid.example".to_string()]);
    }
}
