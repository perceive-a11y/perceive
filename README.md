# Perceive

Rust crates for checking color contrast and simulating color blindness.

| Package | What it does |
| --- | --- |
| [`perceive-color`](crates/perceive-color) | WCAG 2.2 contrast, APCA, OKLCH and accessible palette generation |
| [`perceive-cvd`](crates/perceive-cvd) | Color blindness simulation with the Brettel (1997) and Viénot (1999) models |
| [`@perceive-a11y/perceive-wasm`](bindings/wasm) | WASM bindings for both, published to npm |

API docs are on docs.rs for [perceive-color](https://docs.rs/perceive-color) and
[perceive-cvd](https://docs.rs/perceive-cvd).

[The demo](https://perceive-a11y.github.io/perceive/) runs on the WASM build. Drop in an image and
it shows you how it looks with each type of color vision deficiency.

## Building

You'll need Rust 1.85 or newer and [just](https://github.com/casey/just). The WASM recipes also need
[wasm-pack](https://github.com/drager/wasm-pack) and Node.

```sh
just test        # all crate tests
just lint        # clippy, pedantic, warnings are errors
just wasm-test   # build the Node package and run tests/wasm_node_test.mjs
just demo        # build the web package and serve the demo on localhost:8765
```

## Releasing

Bump `version` under `[workspace.package]` in `Cargo.toml` and commit it. Then tag and push:

```sh
git tag -a v0.1.1 -m "perceive 0.1.1"
git push origin v0.1.1
```

The tag starts the release workflow. It checks that the tag matches the version, publishes
perceive-color and perceive-cvd to crates.io, then builds the WASM package and publishes it to
npm. Both registries trust the workflow itself, so there are no tokens to keep around.

## License

MIT or Apache-2.0, at your option.
