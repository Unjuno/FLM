use flate2::read::GzDecoder;
use sha2::{Digest, Sha256};
use std::env;
use std::fs::{self, File};
use std::io::{Cursor, Read, Write};
use std::path::{Path, PathBuf};
use tar::Archive;
use zip::ZipArchive;

const LEGO_VERSION: &str = "4.15.0";

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    if let Ok(path) = env::var("FLM_LEGO_BIN") {
        println!("cargo:rustc-env=FLM_LEGO_BIN_PATH={path}");
        return;
    }
    if is_offline() {
        println!("cargo:warning=Skipping lego download (offline mode detected); set FLM_LEGO_BIN to override");
        println!("cargo:rustc-env=FLM_LEGO_BIN_PATH=lego");
        return;
    }
    let target = env::var("TARGET").expect("TARGET is set by cargo");

    let spec = platform_spec(&target).unwrap_or_else(|| {
        panic!("lego-runner does not support target triple '{target}' yet");
    });

    let install_dir = target_dir()
        .join("lego")
        .join(format!("v{LEGO_VERSION}"))
        .join(&target);
    let binary_name = spec.binary_name();
    let binary_path = install_dir.join(&binary_name);
    if binary_path.exists() {
        println!(
            "cargo:rustc-env=FLM_LEGO_BIN_PATH={}",
            binary_path.display()
        );
        return;
    }

    fs::create_dir_all(&install_dir)
        .unwrap_or_else(|err| panic!("failed to create lego dir {install_dir:?}: {err}"));

    let archive_name = spec.archive_name();
    let archive_url =
        format!("https://github.com/go-acme/lego/releases/download/v{LEGO_VERSION}/{archive_name}");
    let checksums_url = format!(
        "https://github.com/go-acme/lego/releases/download/v{LEGO_VERSION}/lego_v{LEGO_VERSION}_checksums.txt"
    );

    let archive_bytes = download(&archive_url)
        .unwrap_or_else(|err| panic!("failed to download {archive_url}: {err}"));

    // Try to download and verify checksums, but don't fail if checksums file doesn't exist
    if let Ok(checksums) = download(&checksums_url) {
        if let Err(err) = verify_checksum(&archive_name, &archive_bytes, &checksums) {
            eprintln!("cargo:warning=Checksum verification failed for {archive_name}: {err}");
            eprintln!("cargo:warning=Continuing without checksum verification");
        }
    } else {
        eprintln!(
            "cargo:warning=Checksums file not found at {checksums_url}, skipping verification"
        );
    }

    let binary_bytes = extract_binary(&archive_name, &archive_bytes, &binary_name)
        .unwrap_or_else(|err| panic!("failed to extract lego binary: {err}"));

    write_binary(&binary_path, &binary_bytes)
        .unwrap_or_else(|err| panic!("failed to write lego binary: {err}"));

    println!(
        "cargo:rustc-env=FLM_LEGO_BIN_PATH={}",
        binary_path.display()
    );
}

fn is_offline() -> bool {
    env::var("CARGO_NET_OFFLINE")
        .map(|val| {
            matches!(
                val.to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "on"
            )
        })
        .unwrap_or(false)
        || env::var("FLM_SKIP_LEGO_DOWNLOAD").is_ok()
}

fn download(url: &str) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    let response = ureq::get(url).call()?;
    let mut reader = response.into_reader();
    let mut buf = Vec::new();
    reader.read_to_end(&mut buf)?;
    Ok(buf)
}

fn verify_checksum(
    archive_name: &str,
    archive_bytes: &[u8],
    checksum_body: &[u8],
) -> Result<(), Box<dyn std::error::Error>> {
    let target_line = format!(" {archive_name}");
    let text = std::str::from_utf8(checksum_body)?;
    let mut expected: Option<String> = None;
    for line in text.lines() {
        if line.ends_with(&target_line) {
            expected = line.split_whitespace().next().map(|s| s.to_string());
            if expected.is_none() {
                return Err(
                    format!("Invalid checksum line format (empty checksum): {line}").into(),
                );
            }
            break;
        }
    }
    let expected = expected
        .ok_or_else(|| format!("checksum file did not contain entry for '{archive_name}'"))?;
    let mut hasher = Sha256::new();
    hasher.update(archive_bytes);
    let actual = format!("{:x}", hasher.finalize());
    if actual != expected {
        return Err(format!("checksum mismatch (expected {expected}, got {actual})").into());
    }
    Ok(())
}

fn extract_binary(
    archive_name: &str,
    archive_bytes: &[u8],
    binary_name: &str,
) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    if archive_name.ends_with(".tar.gz") {
        let decoder = GzDecoder::new(Cursor::new(archive_bytes));
        let mut archive = Archive::new(decoder);
        for entry in archive.entries()? {
            let mut entry = entry?;
            let path = entry.path()?;
            if let Some(file_name) = path.file_name() {
                if file_name == binary_name {
                    let mut buf = Vec::new();
                    entry.read_to_end(&mut buf)?;
                    return Ok(buf);
                }
            }
        }
        Err(format!("binary {binary_name} not found in archive").into())
    } else if archive_name.ends_with(".zip") {
        let reader = Cursor::new(archive_bytes);
        let mut archive = ZipArchive::new(reader)?;
        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let name = file.name().to_string();
            if name.ends_with(binary_name) {
                let mut buf = Vec::new();
                std::io::copy(&mut file, &mut buf)?;
                return Ok(buf);
            }
        }
        Err(format!("binary {binary_name} not found in archive").into())
    } else {
        Err(format!("unsupported archive format for {archive_name}").into())
    }
}

fn write_binary(path: &Path, bytes: &[u8]) -> Result<(), Box<dyn std::error::Error>> {
    let mut file = File::create(path)?;
    file.write_all(bytes)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = file.metadata()?.permissions();
        perms.set_mode(0o755);
        fs::set_permissions(path, perms)?;
    }
    Ok(())
}

fn target_dir() -> PathBuf {
    if let Ok(dir) = env::var("CARGO_TARGET_DIR") {
        return PathBuf::from(dir);
    }
    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR is set"));
    out_dir
        .ancestors()
        .nth(4)
        .expect("failed to derive target dir from OUT_DIR")
        .to_path_buf()
}

enum ArchiveKind {
    TarGz,
    Zip,
}

struct PlatformSpec {
    os: &'static str,
    arch: &'static str,
    archive: ArchiveKind,
    binary_suffix: &'static str,
}

impl PlatformSpec {
    fn archive_name(&self) -> String {
        let platform = format!("{}_{}", self.os, self.arch);
        let ext = match self.archive {
            ArchiveKind::TarGz => "tar.gz",
            ArchiveKind::Zip => "zip",
        };
        format!("lego_v{LEGO_VERSION}_{platform}.{ext}")
    }

    fn binary_name(&self) -> String {
        format!("lego{}", self.binary_suffix)
    }
}

fn platform_spec(target: &str) -> Option<PlatformSpec> {
    match target {
        "x86_64-unknown-linux-gnu" => Some(PlatformSpec {
            os: "linux",
            arch: "amd64",
            archive: ArchiveKind::TarGz,
            binary_suffix: "",
        }),
        "aarch64-unknown-linux-gnu" => Some(PlatformSpec {
            os: "linux",
            arch: "arm64",
            archive: ArchiveKind::TarGz,
            binary_suffix: "",
        }),
        "x86_64-apple-darwin" => Some(PlatformSpec {
            os: "darwin",
            arch: "amd64",
            archive: ArchiveKind::TarGz,
            binary_suffix: "",
        }),
        "aarch64-apple-darwin" => Some(PlatformSpec {
            os: "darwin",
            arch: "arm64",
            archive: ArchiveKind::TarGz,
            binary_suffix: "",
        }),
        "x86_64-pc-windows-msvc" => Some(PlatformSpec {
            os: "windows",
            arch: "amd64",
            archive: ArchiveKind::Zip,
            binary_suffix: ".exe",
        }),
        "aarch64-pc-windows-msvc" => Some(PlatformSpec {
            os: "windows",
            arch: "arm64",
            archive: ArchiveKind::Zip,
            binary_suffix: ".exe",
        }),
        _ => None,
    }
}
