//! rustc invocation. Warnings fail the build (-D warnings) so
//! sloppy-but-compiling code (extra semicolons, unreachable code) doesn't
//! pass. Lints that legitimate lesson solutions trigger (e.g. lesson 2's
//! `let mut score = 50; score = 100;` hits unused_assignments) are allowed.

use std::os::unix::process::CommandExt;
use std::process::{Command, Stdio};
use std::time::Duration;

use wait_timeout::ChildExt;

use crate::report::{cap, MAX_COMPILE_ERR};
use crate::run::{drain, kill_group, READER_GRACE};

const COMPILE_TIMEOUT: Duration = Duration::from_secs(20);
const STDERR_KEEP: usize = MAX_COMPILE_ERR + 4;

pub struct CompileOutcome {
    pub compiled: bool,
    /// Capped rustc stderr when compilation failed (empty on success).
    pub error: String,
}

pub fn compile(src_path: &str, out_path: &str) -> CompileOutcome {
    let mut cmd = Command::new("rustc");
    cmd.args([
        "--edition",
        "2021",
        "--color",
        "never",
        "-D",
        "warnings",
        "-A",
        "unused_variables",
        "-A",
        "unused_assignments",
        "-A",
        "unused_mut",
        "-A",
        "dead_code",
        "-A",
        "unused_imports",
        "-o",
        out_path,
        src_path,
    ]);
    compile_with(cmd, COMPILE_TIMEOUT)
}

fn compile_with(mut cmd: Command, timeout: Duration) -> CompileOutcome {
    let failed = |error: String| CompileOutcome {
        compiled: false,
        error,
    };

    let mut child = match cmd
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .current_dir("/tmp")
        .process_group(0)
        .spawn()
    {
        Ok(c) => c,
        Err(e) => return failed(format!("internal: failed to invoke rustc: {e}")),
    };

    let pipe = child.stderr.take().expect("stderr was piped");
    let stderr = drain(pipe, STDERR_KEEP);

    let waited = child.wait_timeout(timeout);
    kill_group(&child);

    match waited {
        Ok(Some(status)) => {
            let stderr_bytes = stderr.finish(READER_GRACE);
            if status.success() {
                CompileOutcome {
                    compiled: true,
                    error: String::new(),
                }
            } else {
                failed(cap(
                    &String::from_utf8_lossy(&stderr_bytes),
                    MAX_COMPILE_ERR,
                ))
            }
        }
        Ok(None) => {
            let _ = child.kill();
            let _ = child.wait();
            let _ = stderr.finish(READER_GRACE);
            failed(format!(
                "internal: rustc timed out after {}s",
                timeout.as_secs()
            ))
        }
        Err(e) => {
            let _ = child.kill();
            let _ = child.wait();
            let _ = stderr.finish(READER_GRACE);
            failed(format!("internal: rustc wait failed: {e}"))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::run::tests::{assert_dead, read_pid, scratch, sh};
    use std::time::Instant;

    #[test]
    fn timeout_kills_the_rustc_process_group() {
        let pidfile = scratch("rustc-orphan.pid");
        let script = format!(
            "/bin/sleep 30 & echo $! > {}; echo slow >&2; /bin/sleep 30",
            pidfile.display()
        );

        let started = Instant::now();
        let outcome = compile_with(sh(&script), Duration::from_secs(1));
        let elapsed = started.elapsed();

        assert!(elapsed < Duration::from_secs(3), "took {elapsed:?}");
        assert!(!outcome.compiled);
        assert_eq!(outcome.error, "internal: rustc timed out after 1s");
        assert_dead(read_pid(&pidfile));
        let _ = std::fs::remove_file(&pidfile);
    }

    #[test]
    fn huge_stderr_does_not_deadlock_and_is_capped() {
        let outcome = compile_with(
            sh("/usr/bin/yes error | /usr/bin/head -c 1000000 >&2; exit 1"),
            COMPILE_TIMEOUT,
        );
        assert!(!outcome.compiled);
        assert_eq!(outcome.error.len(), MAX_COMPILE_ERR);
        assert!(outcome.error.starts_with("error\nerror\n"));
    }

    #[test]
    fn missing_compiler_is_an_internal_error() {
        let outcome = compile_with(Command::new("/nonexistent/rustc"), COMPILE_TIMEOUT);
        assert!(!outcome.compiled);
        assert!(
            outcome
                .error
                .starts_with("internal: failed to invoke rustc:"),
            "{}",
            outcome.error
        );
    }

    #[test]
    fn rustc_errors_are_reported() {
        let dir = scratch("bad-src");
        std::fs::create_dir_all(&dir).unwrap();
        let src = dir.join("main.rs");
        std::fs::write(&src, "fn main() { let x: i32 = \"a\"; }\n").unwrap();

        let outcome = compile(src.to_str().unwrap(), dir.join("prog").to_str().unwrap());
        let _ = std::fs::remove_dir_all(&dir);

        assert!(!outcome.compiled);
        assert!(outcome.error.contains("error[E0308]"), "{}", outcome.error);
    }

    #[test]
    fn warnings_fail_the_build() {
        let dir = scratch("warn-src");
        std::fs::create_dir_all(&dir).unwrap();
        let src = dir.join("main.rs");
        std::fs::write(&src, "fn main() { let n = 1;; println!(\"{n}\"); }\n").unwrap();

        let outcome = compile(src.to_str().unwrap(), dir.join("prog").to_str().unwrap());
        let _ = std::fs::remove_dir_all(&dir);

        assert!(!outcome.compiled);
        assert!(
            outcome.error.contains("redundant_semicolons"),
            "{}",
            outcome.error
        );
    }
}
