//! Scan the Shopify Dawn theme and print findings.
//!
//! Usage: cargo run --example `scan_dawn` -p shopify-auditor-scanner
//!
//! Expects Dawn to be cloned at /tmp/dawn:
//!   git clone --depth 1 <https://github.com/Shopify/dawn.git> /tmp/dawn

use shopify_auditor_scanner::pipeline::{ThemeFile, scan_theme};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

fn main() {
    let dawn_path = Path::new("/tmp/dawn");
    if !dawn_path.exists() {
        eprintln!("Dawn theme not found at /tmp/dawn");
        eprintln!(
            "Clone it first: git clone --depth 1 https://github.com/Shopify/dawn.git /tmp/dawn"
        );
        std::process::exit(1);
    }

    // Collect all .liquid and .css files
    let mut files = Vec::new();
    collect_files(dawn_path, dawn_path, &mut files);

    println!("Collected {} files from Dawn theme\n", files.len());

    let result = scan_theme(&files);

    // Print summary
    println!("=== Scan Results ===");
    println!("Files scanned:  {}", result.files_scanned);
    println!("Total findings: {}\n", result.findings.len());

    // Count by severity
    let mut by_severity: HashMap<&str, usize> = HashMap::new();
    for f in &result.findings {
        let sev = match f.severity {
            a11y_rules::Severity::Critical => "Critical",
            a11y_rules::Severity::Serious => "Serious",
            a11y_rules::Severity::Moderate => "Moderate",
            a11y_rules::Severity::Minor => "Minor",
        };
        *by_severity.entry(sev).or_default() += 1;
    }
    for sev in &["Critical", "Serious", "Moderate", "Minor"] {
        println!("  {:<10} {}", sev, by_severity.get(sev).unwrap_or(&0));
    }

    // Count by criterion
    println!("\n=== By WCAG Criterion ===");
    let mut by_criterion: HashMap<&str, usize> = HashMap::new();
    for f in &result.findings {
        *by_criterion.entry(&f.criterion_id).or_default() += 1;
    }
    let mut criteria: Vec<_> = by_criterion.into_iter().collect();
    criteria.sort_by_key(|(id, _)| *id);
    for (id, count) in &criteria {
        let name = a11y_rules::criterion_by_id(id).map_or("Unknown", |c| c.name);
        println!("  SC {id:<6} {name:<30} {count}");
    }

    // Print first 30 findings with details
    println!("\n=== Sample Findings (first 30) ===");
    for (i, f) in result.findings.iter().take(30).enumerate() {
        println!(
            "\n{}. [{:?}] SC {} - {}",
            i + 1,
            f.severity,
            f.criterion_id,
            f.message
        );
        println!("   File: {}:{}", f.file_path, f.line);
        println!("   Fix:  {}", f.suggestion);
    }
}

/// Recursively collect .liquid and .css files from a directory.
fn collect_files(root: &Path, dir: &Path, files: &mut Vec<ThemeFile>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            // Skip hidden dirs and node_modules
            let name = path.file_name().unwrap_or_default().to_string_lossy();
            if !name.starts_with('.') && name != "node_modules" {
                collect_files(root, &path, files);
            }
        } else if let Some(ext) = path.extension()
            && (ext == "liquid" || ext == "css")
            && let Ok(content) = fs::read_to_string(&path)
        {
            let rel = path.strip_prefix(root).unwrap_or(&path);
            files.push(ThemeFile {
                path: rel.to_string_lossy().to_string(),
                content,
            });
        }
    }
}
