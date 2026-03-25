use serde::Serialize;

use crate::state::AppState;

#[derive(Clone, Debug, Serialize)]
pub struct ModuleManifest {
    pub namespace: String,
    pub name: String,
    pub version: String,
    pub summary: String,
    pub proof_drivers: Vec<ModuleExtension>,
    pub artifact_drivers: Vec<ModuleExtension>,
    pub policy_extensions: Vec<ModuleExtension>,
    pub api: ModuleApiSurface,
    pub runtime: ModuleRuntime,
    pub notes: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct ModuleExtension {
    pub id: String,
    pub label: String,
    pub summary: String,
    pub status: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct ModuleApiSurface {
    pub base_path: String,
    pub routes: Vec<ModuleRoute>,
}

#[derive(Clone, Debug, Serialize)]
pub struct ModuleRoute {
    pub method: String,
    pub path: String,
    pub purpose: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct ModuleRuntime {
    pub address_hrp: String,
    pub badge_sync_enabled: bool,
    pub backend_authority: String,
}

fn extension(id: &str, label: &str, summary: &str) -> ModuleExtension {
    ModuleExtension {
        id: id.to_string(),
        label: label.to_string(),
        summary: summary.to_string(),
        status: "reference".to_string(),
    }
}

pub fn manifest(state: &AppState) -> ModuleManifest {
    ModuleManifest {
        namespace: "ckb-pop".to_string(),
        name: "CKB Presence Module".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        summary: "Reusable presence primitives for CKB apps, with this backend acting as a non-authoritative reference adapter.".to_string(),
        proof_drivers: vec![
            extension(
                "dynamic-qr",
                "Dynamic QR Proof",
                "Rotating QR payloads for in-person presence verification with bounded replay windows.",
            ),
            extension(
                "plain-event-id",
                "Plain Event ID",
                "Manual lookup mode for apps that want copy-paste, deep-link, or fallback entry.",
            ),
        ],
        artifact_drivers: vec![
            extension(
                "ckb-dob-badge",
                "CKB Presence Badge",
                "Unique, non-transferable badge cell anchored by CKB type scripts.",
            ),
            extension(
                "ckb-event-anchor",
                "CKB Event Anchor",
                "Optional on-chain event anchor that gives off-chain proof systems a stable CKB root.",
            ),
        ],
        policy_extensions: vec![
            extension(
                "timed-window",
                "Timed Window Policy",
                "Constrains proof collection to operator-defined windows.",
            ),
            extension(
                "backend-observation",
                "Backend Observation Policy",
                "Caches event state and observes confirmations without holding protocol authority.",
            ),
        ],
        api: ModuleApiSurface {
            base_path: "/api".to_string(),
            routes: vec![
                ModuleRoute {
                    method: "GET".to_string(),
                    path: "/module/manifest".to_string(),
                    purpose: "Discover module capabilities, extension points, and runtime support.".to_string(),
                },
                ModuleRoute {
                    method: "POST".to_string(),
                    path: "/events/create".to_string(),
                    purpose: "Create a reference event using the module's event metadata envelope.".to_string(),
                },
                ModuleRoute {
                    method: "GET".to_string(),
                    path: "/events/:id".to_string(),
                    purpose: "Resolve a presence event by stable identifier.".to_string(),
                },
                ModuleRoute {
                    method: "GET".to_string(),
                    path: "/events/:id/qr".to_string(),
                    purpose: "Issue a live proof payload for event check-in surfaces.".to_string(),
                },
                ModuleRoute {
                    method: "GET".to_string(),
                    path: "/badges/observe".to_string(),
                    purpose: "Observe presence artifacts by address using the reference badge adapter.".to_string(),
                },
            ],
        },
        runtime: ModuleRuntime {
            address_hrp: state.address_hrp.clone(),
            badge_sync_enabled: state.dob_code_hash.is_some(),
            backend_authority: "non-authoritative".to_string(),
        },
        notes: vec![
            "This backend is a reference adapter. CKB contracts remain the source of truth.".to_string(),
            "Integrators can replace this backend while reusing the same proof, policy, and artifact semantics.".to_string(),
        ],
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;

    #[tokio::test]
    async fn test_manifest_reports_runtime_capabilities() {
        let state = AppState::new(
            "sqlite::memory:",
            "http://localhost:1",
            Some("0xcodehash".to_string()),
            "ckt".to_string(),
        )
        .await
        .unwrap();

        let manifest = manifest(&state);
        assert_eq!(manifest.name, "CKB Presence Module");
        assert!(manifest.runtime.badge_sync_enabled);
        assert_eq!(manifest.runtime.address_hrp, "ckt");
        assert!(manifest
            .proof_drivers
            .iter()
            .any(|driver| driver.id == "dynamic-qr"));
        assert!(manifest
            .artifact_drivers
            .iter()
            .any(|driver| driver.id == "ckb-dob-badge"));
    }
}
