//! Execute the compiled submission with a hard 5s timeout.

use std::io::{ErrorKind, Read};
use std::os::unix::process::CommandExt;
use std::process::{Child, Command, Stdio};
use std::sync::{mpsc, Arc, Mutex, PoisonError};
use std::time::Duration;

use wait_timeout::ChildExt;

use crate::report::{cap, RunStatus, MAX_STDOUT};

const RUN_TIMEOUT: Duration = Duration::from_secs(5);
pub(crate) const READER_GRACE: Duration = Duration::from_millis(500);

pub struct RunOutcome {
    pub status: RunStatus,
    pub exit_code: Option<i32>,
    pub stdout: String,
}

pub fn execute(prog_path: &str) -> RunOutcome {
    execute_with(Command::new(prog_path), RUN_TIMEOUT)
}

fn execute_with(mut cmd: Command, timeout: Duration) -> RunOutcome {
    let infra = |msg: String| RunOutcome {
        status: RunStatus::Crash,
        exit_code: None,
        stdout: msg,
    };

    // stdin(null) + env_clear: the student process must not be able to reach
    // back to the check spec (which arrived on OUR stdin) or observe anything
    // about the grading environment.
    let mut child = match cmd
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .env_clear()
        .current_dir("/tmp")
        .process_group(0)
        .spawn()
    {
        Ok(c) => c,
        Err(e) => return infra(format!("internal: failed to run program: {e}")),
    };

    // Drain stdout on a thread, continuously, keeping only the first 16KB.
    // Never stop reading: a fast, verbose program would otherwise fill the
    // pipe, block on write, and masquerade as a timeout.
    let pipe = child.stdout.take().expect("stdout was piped");
    let stdout = drain(pipe, MAX_STDOUT);

    let waited = child.wait_timeout(timeout);
    kill_group(&child);

    let status = match waited {
        Ok(Some(status)) => status,
        Ok(None) => {
            // Timed out: SIGKILL (same net effect as coreutils `timeout -k`).
            let _ = child.kill();
            let _ = child.wait();
            let stdout_bytes = stdout.finish(READER_GRACE);
            return RunOutcome {
                status: RunStatus::Timeout,
                exit_code: None,
                stdout: capped_lossy(&stdout_bytes),
            };
        }
        Err(e) => {
            let _ = child.kill();
            let _ = child.wait();
            let _ = stdout.finish(READER_GRACE);
            return infra(format!("internal: wait failed: {e}"));
        }
    };

    let stdout_bytes = stdout.finish(READER_GRACE);
    RunOutcome {
        status: if status.success() {
            RunStatus::Ok
        } else {
            RunStatus::Crash
        },
        exit_code: status.code(),
        stdout: capped_lossy(&stdout_bytes),
    }
}

pub(crate) struct Drain {
    kept: Arc<Mutex<Vec<u8>>>,
    done: mpsc::Receiver<()>,
}

pub(crate) fn drain<R: Read + Send + 'static>(mut pipe: R, limit: usize) -> Drain {
    let kept = Arc::new(Mutex::new(Vec::with_capacity(limit)));
    let sink = Arc::clone(&kept);
    let (tx, done) = mpsc::channel();
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match pipe.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let mut kept = sink.lock().unwrap_or_else(PoisonError::into_inner);
                    let room = limit.saturating_sub(kept.len());
                    kept.extend_from_slice(&buf[..n.min(room)]);
                    // room == 0 → keep looping, discarding
                }
                Err(e) if e.kind() == ErrorKind::Interrupted => continue,
                Err(_) => break,
            }
        }
        let _ = tx.send(());
    });
    Drain { kept, done }
}

impl Drain {
    pub(crate) fn finish(self, grace: Duration) -> Vec<u8> {
        let _ = self.done.recv_timeout(grace);
        let mut kept = self.kept.lock().unwrap_or_else(PoisonError::into_inner);
        std::mem::take(&mut *kept)
    }
}

pub(crate) fn kill_group(child: &Child) {
    let Ok(pgid) = libc::pid_t::try_from(child.id()) else {
        return;
    };
    if pgid > 0 {
        unsafe {
            libc::killpg(pgid, libc::SIGKILL);
        }
    }
}

fn capped_lossy(bytes: &[u8]) -> String {
    cap(&String::from_utf8_lossy(bytes), MAX_STDOUT)
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::Instant;

    pub(crate) fn scratch(name: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!("tusst-{}-{name}", std::process::id()));
        let _ = std::fs::remove_file(&path);
        path
    }

    pub(crate) fn sh(script: &str) -> Command {
        let mut cmd = Command::new("/bin/sh");
        cmd.arg("-c").arg(script);
        cmd
    }

    pub(crate) fn read_pid(path: &PathBuf) -> libc::pid_t {
        let deadline = Instant::now() + Duration::from_secs(5);
        loop {
            if let Ok(text) = std::fs::read_to_string(path) {
                if let Ok(pid) = text.trim().parse() {
                    return pid;
                }
            }
            assert!(
                Instant::now() < deadline,
                "pid file {path:?} never appeared"
            );
            std::thread::sleep(Duration::from_millis(20));
        }
    }

    fn is_gone(pid: libc::pid_t) -> bool {
        if unsafe { libc::kill(pid, 0) } == -1 {
            return std::io::Error::last_os_error().raw_os_error() == Some(libc::ESRCH);
        }
        is_zombie(pid)
    }

    #[cfg(target_os = "linux")]
    fn is_zombie(pid: libc::pid_t) -> bool {
        std::fs::read_to_string(format!("/proc/{pid}/stat"))
            .ok()
            .and_then(|stat| {
                stat.rsplit_once(')')
                    .map(|(_, rest)| rest.trim_start().starts_with('Z'))
            })
            .unwrap_or(false)
    }

    #[cfg(not(target_os = "linux"))]
    fn is_zombie(_pid: libc::pid_t) -> bool {
        false
    }

    pub(crate) fn assert_dead(pid: libc::pid_t) {
        let deadline = Instant::now() + Duration::from_secs(5);
        while !is_gone(pid) {
            assert!(Instant::now() < deadline, "process {pid} survived");
            std::thread::sleep(Duration::from_millis(20));
        }
    }

    #[test]
    fn background_child_holding_stdout_is_killed_after_normal_exit() {
        let pidfile = scratch("ok-orphan.pid");
        let script = format!("/bin/sleep 30 & echo $! > {}; echo hi", pidfile.display());

        let started = Instant::now();
        let outcome = execute_with(sh(&script), RUN_TIMEOUT);
        let elapsed = started.elapsed();

        assert!(elapsed < Duration::from_secs(3), "took {elapsed:?}");
        assert_eq!(outcome.status, RunStatus::Ok);
        assert_eq!(outcome.exit_code, Some(0));
        assert_eq!(outcome.stdout, "hi\n");
        assert_dead(read_pid(&pidfile));
        let _ = std::fs::remove_file(&pidfile);
    }

    #[test]
    fn timeout_kills_the_whole_process_group() {
        let pidfile = scratch("timeout-orphan.pid");
        let script = format!(
            "/bin/sleep 30 & echo $! > {}; echo before; /bin/sleep 30",
            pidfile.display()
        );

        let started = Instant::now();
        let outcome = execute_with(sh(&script), RUN_TIMEOUT);
        let elapsed = started.elapsed();

        assert!(elapsed >= RUN_TIMEOUT, "took {elapsed:?}");
        assert!(
            elapsed < RUN_TIMEOUT + Duration::from_secs(2),
            "took {elapsed:?}"
        );
        assert_eq!(outcome.status, RunStatus::Timeout);
        assert_eq!(outcome.exit_code, None);
        assert_eq!(outcome.stdout, "before\n");
        assert_dead(read_pid(&pidfile));
        let _ = std::fs::remove_file(&pidfile);
    }

    #[test]
    fn nonzero_exit_is_a_crash_with_its_code() {
        let outcome = execute_with(sh("echo out; exit 3"), RUN_TIMEOUT);
        assert_eq!(outcome.status, RunStatus::Crash);
        assert_eq!(outcome.exit_code, Some(3));
        assert_eq!(outcome.stdout, "out\n");
    }

    #[test]
    fn verbose_output_is_drained_and_capped() {
        let outcome = execute_with(
            sh("/usr/bin/yes tusst | /usr/bin/head -c 1000000"),
            RUN_TIMEOUT,
        );
        assert_eq!(outcome.status, RunStatus::Ok);
        assert_eq!(outcome.stdout.len(), MAX_STDOUT);
        assert!(outcome.stdout.starts_with("tusst\ntusst\n"));
    }

    #[test]
    fn environment_is_cleared_and_cwd_is_tmp() {
        let outcome = execute_with(sh("echo \"[$HOME]\"; /bin/pwd -P"), RUN_TIMEOUT);
        let tmp = std::fs::canonicalize("/tmp").unwrap();
        assert_eq!(outcome.stdout, format!("[]\n{}\n", tmp.display()));
    }

    #[test]
    fn descendant_escaping_the_group_does_not_block_the_runner() {
        let dir = scratch("escape");
        std::fs::create_dir_all(&dir).unwrap();
        let pidfile = dir.join("child.pid");
        let src = dir.join("main.rs");
        let prog = dir.join("prog");
        std::fs::write(
            &src,
            format!(
                r#"use std::io::Write;
use std::process::Command;
use std::time::Duration;

extern "C" {{
    fn setsid() -> i32;
}}

fn main() {{
    let pidfile = {pidfile:?};
    if std::env::args().nth(1).as_deref() == Some("child") {{
        unsafe {{
            setsid();
        }}
        std::fs::write(pidfile, std::process::id().to_string()).unwrap();
        std::thread::sleep(Duration::from_secs(30));
        return;
    }}
    Command::new(std::env::current_exe().unwrap())
        .arg("child")
        .spawn()
        .unwrap();
    for _ in 0..500 {{
        if std::path::Path::new(pidfile).exists() {{
            break;
        }}
        std::thread::sleep(Duration::from_millis(10));
    }}
    println!("parent done");
    std::io::stdout().flush().unwrap();
}}
"#,
                pidfile = pidfile.display().to_string()
            ),
        )
        .unwrap();

        let compiled = crate::compile::compile(src.to_str().unwrap(), prog.to_str().unwrap());
        assert!(compiled.compiled, "{}", compiled.error);

        let started = Instant::now();
        let outcome = execute(prog.to_str().unwrap());
        let elapsed = started.elapsed();

        let escaped = read_pid(&pidfile);
        let escaped_alive = unsafe { libc::kill(escaped, 0) } == 0;
        unsafe {
            libc::kill(escaped, libc::SIGKILL);
        }
        let _ = std::fs::remove_dir_all(&dir);

        assert!(escaped_alive, "the descendant did not escape the group");
        assert!(elapsed < Duration::from_secs(3), "took {elapsed:?}");
        assert_eq!(outcome.status, RunStatus::Ok);
        assert_eq!(outcome.stdout, "parent done\n");
    }

    #[test]
    fn finish_returns_partial_output_while_the_writer_is_alive() {
        let mut holder = sh("echo partial; exec /bin/sleep 30")
            .stdout(Stdio::piped())
            .spawn()
            .unwrap();
        let pending = drain(holder.stdout.take().unwrap(), MAX_STDOUT);
        std::thread::sleep(Duration::from_millis(200));

        let started = Instant::now();
        let bytes = pending.finish(Duration::from_millis(100));
        let elapsed = started.elapsed();

        let _ = holder.kill();
        let _ = holder.wait();
        assert!(elapsed < Duration::from_secs(1), "took {elapsed:?}");
        assert_eq!(bytes, b"partial\n");
    }
}
