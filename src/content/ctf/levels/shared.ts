import "server-only";

// Project boilerplate every Gauntlet level shares, so a pin bump or a change
// to the sandbox rules is made once. scripts/check-forge-pins.mjs compares the
// Forge templates against runner-soroban/warm/Cargo.toml but does NOT read
// CTF levels, so these pins must keep matching that manifest by hand.

/** Cargo.toml for a level crate. `crateName` must be a valid Rust identifier. */
export function cargoToml(crateName: string): string {
  return `[package]
name = "${crateName}"
version = "0.1.0"
edition = "2021"
publish = false

[lib]
# rlib is required for the hidden integration test to link the crate.
crate-type = ["cdylib", "rlib"]
doctest = false

[dependencies]
soroban-sdk = "=26.1.1"

[dev-dependencies]
soroban-sdk = { version = "=26.1.1", features = ["testutils"] }

# Keep the warm runner target valid: these match runner-soroban/warm/Cargo.toml.
[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
panic = "abort"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false

[profile.dev]
debug = false
`;
}

/** src/lib.rs: the player's module is unsafe-free; level.rs holds the contract. */
export const LIB_RS = `#![no_std]

// The player's file may not use unsafe code (forbid, so an inner #[allow]
// cannot lift it). Scoped to this module: #[contractimpl] in level.rs expands
// to code that the lint would flag.
#[forbid(unsafe_code)]
pub mod exploit;
pub mod level;
`;
