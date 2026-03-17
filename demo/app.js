import init, { simulate_image } from './pkg/perceive_wasm.js';

// CVD types to render, with human-readable labels and descriptions.
const CVD_TYPES = [
    { id: 'original', label: 'Original', desc: 'Unmodified' },
    { id: 'protan', label: 'Protanopia', desc: 'No L-cones (red-blind)' },
    { id: 'deutan', label: 'Deuteranopia', desc: 'No M-cones (green-blind)' },
    { id: 'tritan', label: 'Tritanopia', desc: 'No S-cones (blue-blind)' },
    { id: 'achromat', label: 'Achromatopsia', desc: 'No color vision' },
];

let wasmReady = false;
let currentImage = null; // { width, height, data: ImageData }

// ── WASM init ──────────────────────────────────────────────────────────

async function initWasm() {
    await init();
    wasmReady = true;
}

const wasmPromise = initWasm();

// ── DOM refs ───────────────────────────────────────────────────────────

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const grid = document.getElementById('image-grid');
const loading = document.getElementById('loading');
const severitySlider = document.getElementById('severity-slider');
const severityDisplay = document.getElementById('severity-display');
const themeToggle = document.getElementById('theme-toggle');

// ── Theme toggle ───────────────────────────────────────────────────────

function applyTheme() {
    // Respect system preference on first load
    const stored = localStorage.getItem('perceive-theme');
    if (stored) {
        document.documentElement.setAttribute('data-theme', stored);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
}

applyTheme();

themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('perceive-theme', next);
});

// ── File handling ──────────────────────────────────────────────────────

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('active');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('active');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('active');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        loadImage(file);
    }
});

fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) loadImage(file);
});

// ── Image loading ──────────────────────────────────────────────────────

function loadImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            // Cap dimensions to avoid very large images overwhelming WASM
            const maxDim = 1200;
            let w = img.width;
            let h = img.height;
            if (w > maxDim || h > maxDim) {
                const scale = maxDim / Math.max(w, h);
                w = Math.round(w * scale);
                h = Math.round(h * scale);
            }

            // Draw to offscreen canvas to get pixel data
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            const imageData = ctx.getImageData(0, 0, w, h);

            currentImage = { width: w, height: h, data: imageData };

            // Hide drop zone, show grid
            dropZone.style.display = 'none';
            processAll();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// ── Simulation ─────────────────────────────────────────────────────────

async function processAll() {
    await wasmPromise;

    const severity = parseInt(severitySlider.value, 10) / 100;
    const { width, height, data } = currentImage;
    const pixels = data.data; // Uint8ClampedArray (RGBA)

    loading.classList.add('visible');
    grid.innerHTML = '';

    // Use requestAnimationFrame to let the loading indicator render
    requestAnimationFrame(() => {
        const cards = [];
        for (const cvd of CVD_TYPES) {
            const card = document.createElement('div');
            card.className = 'image-card';

            const label = document.createElement('div');
            label.className = 'card-label';

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            if (cvd.id === 'original') {
                ctx.putImageData(data, 0, 0);
                label.innerHTML =
                    `<span>${cvd.label} <small style="opacity:0.6">${cvd.desc}</small></span>` +
                    `<span class="timing">${width}x${height}</span>`;
            } else {
                const t0 = performance.now();
                const simulated = simulate_image(
                    new Uint8Array(pixels.buffer),
                    cvd.id,
                    severity
                );
                const elapsed = performance.now() - t0;

                const outData = new ImageData(
                    new Uint8ClampedArray(simulated),
                    width,
                    height
                );
                ctx.putImageData(outData, 0, 0);

                label.innerHTML =
                    `<span>${cvd.label} <small style="opacity:0.6">${cvd.desc}</small></span>` +
                    `<span class="timing">${elapsed.toFixed(0)} ms</span>`;
            }

            card.appendChild(label);
            card.appendChild(canvas);
            cards.push(card);
        }

        for (const card of cards) {
            grid.appendChild(card);
        }

        loading.classList.remove('visible');
    });
}

// ── Severity slider ────────────────────────────────────────────────────

severitySlider.addEventListener('input', () => {
    const val = parseInt(severitySlider.value, 10) / 100;
    severityDisplay.textContent = val.toFixed(2);
    if (currentImage) processAll();
});

// Re-process when model changes (for future: wire up Vienot vs Brettel)
document.getElementById('model-select').addEventListener('change', () => {
    if (currentImage) processAll();
});
