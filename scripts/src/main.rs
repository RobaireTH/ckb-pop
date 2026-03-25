mod cache;
mod crypto;
mod module;
mod observe;
mod relay;
mod routes;
mod rpc;
mod state;
mod types;

use std::sync::Arc;

use axum::Router;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::state::AppState;

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    dotenvy::dotenv().ok();

    // Load network-specific env file: .env.testnet, .env.mainnet, or .env.devnet
    let ckb_network = std::env::var("CKB_NETWORK").unwrap_or_else(|_| "testnet".to_string());
    let env_file = format!(".env.{}", ckb_network);
    if dotenvy::from_filename(&env_file).is_err() {
        tracing::warn!("No {} found, using defaults for {}", env_file, ckb_network);
    }

    let database_url =
        std::env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:ckb_pop.db".to_string());
    let ckb_rpc_url =
        std::env::var("CKB_RPC_URL").unwrap_or_else(|_| "https://testnet.ckb.dev/rpc".to_string());

    tracing::info!("Network: {}, RPC: {}", ckb_network, ckb_rpc_url);

    let dob_code_hash = std::env::var("DOB_BADGE_CODE_HASH").ok();
    let address_hrp = if ckb_network == "mainnet" {
        "ckb"
    } else {
        "ckt"
    };

    let state = AppState::new(
        &database_url,
        &ckb_rpc_url,
        dob_code_hash.clone(),
        address_hrp.to_string(),
    )
    .await
    .expect("Failed to initialize app state");

    // Rehydrate badge data from the chain if a code hash is configured.
    if let Some(ref code_hash) = dob_code_hash {
        let cache = Arc::clone(&state.cache);
        let rpc = Arc::clone(&state.rpc);
        observe::rehydrate_from_chain(&cache, &rpc, code_hash, address_hrp).await;
    }

    // Spawn background task to confirm pending badges every 15 seconds.
    {
        let cache = Arc::clone(&state.cache);
        let rpc = Arc::clone(&state.rpc);
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(15));
            loop {
                interval.tick().await;
                observe::confirm_pending_badges(&cache, &rpc).await;
            }
        });
    }

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .nest("/api", routes::router())
        .with_state(state)
        .layer(cors);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3001));
    tracing::info!("Backend listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
