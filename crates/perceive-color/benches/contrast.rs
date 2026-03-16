use criterion::{Criterion, black_box, criterion_group, criterion_main};

use perceive_color::{Color, apca, palette, wcag};

fn bench_contrast_ratio(c: &mut Criterion) {
    let fg = Color::from_hex("#333333").unwrap();
    let bg = Color::from_hex("#ffffff").unwrap();

    c.bench_function("wcag::contrast_ratio", |b| {
        b.iter(|| wcag::contrast_ratio(black_box(fg), black_box(bg)));
    });
}

fn bench_apca_contrast(c: &mut Criterion) {
    let text = Color::from_hex("#333333").unwrap();
    let bg = Color::from_hex("#ffffff").unwrap();

    c.bench_function("apca::apca_contrast", |b| {
        b.iter(|| apca::apca_contrast(black_box(text), black_box(bg)));
    });
}

fn bench_generate_palette(c: &mut Criterion) {
    let base = Color::from_hex("#3366cc").unwrap();

    c.bench_function("palette::generate_palette(10)", |b| {
        b.iter(|| palette::generate_palette(black_box(base), 10));
    });
}

fn bench_oklch_roundtrip(c: &mut Criterion) {
    let color = Color::from_hex("#ff6633").unwrap();

    c.bench_function("oklch roundtrip", |b| {
        b.iter(|| {
            let oklch = black_box(color).to_oklch();
            Color::from_oklch(oklch)
        });
    });
}

criterion_group!(
    benches,
    bench_contrast_ratio,
    bench_apca_contrast,
    bench_generate_palette,
    bench_oklch_roundtrip,
);
criterion_main!(benches);
