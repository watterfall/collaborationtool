// apps/desktop/src-tauri/src/commands/ollama.rs
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct OllamaStatus {
    pub available: bool,
    pub version: Option<String>,
    pub endpoint: String,
}

const DEFAULT_OLLAMA_ENDPOINT: &str = "http://localhost:11434";

/// Probe a given Ollama endpoint by calling /api/tags.
///
/// Returns `available=true` if HTTP 200, version string from response (if
/// present). Network/timeout/non-200 all map to `available=false`.
pub async fn probe_ollama(endpoint: &str) -> OllamaStatus {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(500))
        .build()
        .unwrap();

    let url = format!("{}/api/tags", endpoint);
    match client.get(&url).send().await {
        Ok(resp) if resp.status().is_success() => OllamaStatus {
            available: true,
            version: None, // version is parsed from /api/version separately, Spike-1 skip
            endpoint: endpoint.to_string(),
        },
        _ => OllamaStatus {
            available: false,
            version: None,
            endpoint: endpoint.to_string(),
        },
    }
}

#[tauri::command]
pub async fn detect_ollama_available() -> OllamaStatus {
    probe_ollama(DEFAULT_OLLAMA_ENDPOINT).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn probe_returns_unavailable_when_no_server() {
        // No mock — probe a localhost port that is intentionally not bound.
        let status = probe_ollama("http://localhost:1").await;
        assert!(!status.available);
        assert_eq!(status.endpoint, "http://localhost:1");
    }

    #[tokio::test]
    async fn probe_returns_available_when_mock_returns_200() {
        let mut server = mockito::Server::new_async().await;
        let _m = server
            .mock("GET", "/api/tags")
            .with_status(200)
            .with_body(r#"{"models":[]}"#)
            .create_async()
            .await;

        let status = probe_ollama(&server.url()).await;
        assert!(status.available);
        assert_eq!(status.endpoint, server.url());
    }

    #[tokio::test]
    async fn probe_returns_unavailable_when_mock_returns_500() {
        let mut server = mockito::Server::new_async().await;
        let _m = server
            .mock("GET", "/api/tags")
            .with_status(500)
            .create_async()
            .await;

        let status = probe_ollama(&server.url()).await;
        assert!(!status.available);
    }
}
