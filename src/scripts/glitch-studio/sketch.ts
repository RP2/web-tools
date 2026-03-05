interface AppState {
  image: HTMLImageElement | null;
  originalImageData: ImageData | null;
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  pixelSort: {
    enabled: boolean;
    direction: "horizontal" | "vertical";
    threshold: number;
    mode: "lighter-first" | "darkest-first";
  };
  chromaticAberration: {
    enabled: boolean;
    redOffset: number;
    blueOffset: number;
    direction: "horizontal" | "vertical";
  };
  sliceOffset: {
    enabled: boolean;
    sliceHeight: number;
    displacement: number;
    randomness: number;
  };
}

const state: AppState = {
  image: null,
  originalImageData: null,
  canvas: null,
  ctx: null,
  pixelSort: {
    enabled: false,
    direction: "horizontal",
    threshold: 200,
    mode: "lighter-first",
  },
  chromaticAberration: {
    enabled: false,
    redOffset: 10,
    blueOffset: -10,
    direction: "horizontal",
  },
  sliceOffset: {
    enabled: false,
    sliceHeight: 20,
    displacement: 50,
    randomness: 50,
  },
};

let container: HTMLElement | null = null;

function getBrightness(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function chromaticAberration(imageData: ImageData): ImageData {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const copy = new Uint8ClampedArray(data);

  const isHorizontal = state.chromaticAberration.direction === "horizontal";
  const redOffset = state.chromaticAberration.redOffset;
  const blueOffset = state.chromaticAberration.blueOffset;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      let redX = x,
        redY = y;
      let blueX = x,
        blueY = y;

      if (isHorizontal) {
        redX = Math.min(Math.max(x + redOffset, 0), width - 1);
        blueX = Math.min(Math.max(x + blueOffset, 0), width - 1);
      } else {
        redY = Math.min(Math.max(y + redOffset, 0), height - 1);
        blueY = Math.min(Math.max(y + blueOffset, 0), height - 1);
      }

      const redI = (redY * width + redX) * 4;
      const blueI = (blueY * width + blueX) * 4;

      data[i] = copy[redI];
      data[i + 1] = copy[i + 1];
      data[i + 2] = copy[blueI + 2];
    }
  }

  return imageData;
}

function sliceOffset(imageData: ImageData): ImageData {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const copy = new Uint8ClampedArray(data);

  const sliceHeight = Math.max(1, Math.floor(state.sliceOffset.sliceHeight));
  const randomness = state.sliceOffset.randomness / 100;
  const displacement = state.sliceOffset.displacement;

  for (let y = 0; y < height; y += sliceHeight) {
    const offset = Math.floor(
      (Math.random() - 0.5) * 2 * displacement * (1 + randomness),
    );
    const sliceEnd = Math.min(y + sliceHeight, height);

    for (let sy = y; sy < sliceEnd; sy++) {
      for (let x = 0; x < width; x++) {
        const destI = (sy * width + x) * 4;
        let srcX = x + offset;
        srcX = Math.max(0, Math.min(width - 1, srcX));
        const srcI = (sy * width + srcX) * 4;

        data[destI] = copy[srcI];
        data[destI + 1] = copy[srcI + 1];
        data[destI + 2] = copy[srcI + 2];
      }
    }
  }

  return imageData;
}

function pixelSort(imageData: ImageData): ImageData {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const threshold = state.pixelSort.threshold;

  if (state.pixelSort.direction === "horizontal") {
    for (let y = 0; y < height; y++) {
      let row: number[] = [];

      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const brightness = getBrightness(data[i], data[i + 1], data[i + 2]);
        const passes =
          state.pixelSort.mode === "lighter-first"
            ? brightness >= threshold
            : brightness < threshold;

        if (passes) {
          row.push(i);
        } else if (row.length > 0) {
          const sorted = row
            .map((idx) => ({
              r: data[idx],
              g: data[idx + 1],
              b: data[idx + 2],
              brightness: getBrightness(
                data[idx],
                data[idx + 1],
                data[idx + 2],
              ),
            }))
            .sort((a, b) =>
              state.pixelSort.mode === "lighter-first"
                ? b.brightness - a.brightness
                : a.brightness - b.brightness,
            );

          for (let j = 0; j < row.length; j++) {
            data[row[j]] = sorted[j].r;
            data[row[j] + 1] = sorted[j].g;
            data[row[j] + 2] = sorted[j].b;
          }
          row = [];
        }
      }

      if (row.length > 0) {
        const sorted = row
          .map((idx) => ({
            r: data[idx],
            g: data[idx + 1],
            b: data[idx + 2],
            brightness: getBrightness(data[idx], data[idx + 1], data[idx + 2]),
          }))
          .sort((a, b) =>
            state.pixelSort.mode === "lighter-first"
              ? b.brightness - a.brightness
              : a.brightness - b.brightness,
          );

        for (let j = 0; j < row.length; j++) {
          data[row[j]] = sorted[j].r;
          data[row[j] + 1] = sorted[j].g;
          data[row[j] + 2] = sorted[j].b;
        }
      }
    }
  } else {
    for (let x = 0; x < width; x++) {
      let col: number[] = [];

      for (let y = 0; y < height; y++) {
        const i = (y * width + x) * 4;
        const brightness = getBrightness(data[i], data[i + 1], data[i + 2]);
        const passes =
          state.pixelSort.mode === "lighter-first"
            ? brightness >= threshold
            : brightness < threshold;

        if (passes) {
          col.push(i);
        } else if (col.length > 0) {
          const sorted = col
            .map((idx) => ({
              r: data[idx],
              g: data[idx + 1],
              b: data[idx + 2],
              brightness: getBrightness(
                data[idx],
                data[idx + 1],
                data[idx + 2],
              ),
            }))
            .sort((a, b) =>
              state.pixelSort.mode === "lighter-first"
                ? b.brightness - a.brightness
                : a.brightness - b.brightness,
            );

          for (let j = 0; j < col.length; j++) {
            data[col[j]] = sorted[j].r;
            data[col[j] + 1] = sorted[j].g;
            data[col[j] + 2] = sorted[j].b;
          }
          col = [];
        }
      }

      if (col.length > 0) {
        const sorted = col
          .map((idx) => ({
            r: data[idx],
            g: data[idx + 1],
            b: data[idx + 2],
            brightness: getBrightness(data[idx], data[idx + 1], data[idx + 2]),
          }))
          .sort((a, b) =>
            state.pixelSort.mode === "lighter-first"
              ? b.brightness - a.brightness
              : a.brightness - b.brightness,
          );

        for (let j = 0; j < col.length; j++) {
          data[col[j]] = sorted[j].r;
          data[col[j] + 1] = sorted[j].g;
          data[col[j] + 2] = sorted[j].b;
        }
      }
    }
  }

  return imageData;
}

export function initSketch(
  containerEl: HTMLElement,
  uploadOverlayEl: HTMLElement,
  controlsContainer: HTMLElement,
): void {
  container = containerEl;

  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  container.appendChild(canvas);
  state.canvas = canvas;
  state.ctx = canvas.getContext("2d");

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  setupControls(controlsContainer, uploadOverlayEl);
}

function resizeCanvas(): void {
  if (!state.canvas || !container) return;
  state.canvas.width = container.clientWidth || 800;
  state.canvas.height = container.clientHeight || 600;

  if (state.originalImageData) {
    render();
  } else if (state.ctx && state.canvas) {
    state.ctx.fillStyle = "#f0f0f0";
    state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
  }
}

function render(): void {
  if (!state.ctx || !state.canvas || !state.originalImageData) return;

  const ctx = state.ctx;
  const canvas = state.canvas;

  ctx.fillStyle = "#f0f0f0";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let imageData = new ImageData(
    new Uint8ClampedArray(state.originalImageData.data),
    state.originalImageData.width,
    state.originalImageData.height,
  );

  if (state.pixelSort.enabled) {
    imageData = pixelSort(imageData);
  }

  if (state.chromaticAberration.enabled) {
    imageData = chromaticAberration(imageData);
  }

  if (state.sliceOffset.enabled) {
    imageData = sliceOffset(imageData);
  }

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = imageData.width;
  tempCanvas.height = imageData.height;
  tempCanvas.getContext("2d")?.putImageData(imageData, 0, 0);

  const imgWidth = imageData.width;
  const imgHeight = imageData.height;
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  const scale = Math.min(canvasWidth / imgWidth, canvasHeight / imgHeight, 1);
  const drawWidth = imgWidth * scale;
  const drawHeight = imgHeight * scale;
  const drawX = (canvasWidth - drawWidth) / 2;
  const drawY = (canvasHeight - drawHeight) / 2;

  ctx.drawImage(tempCanvas, drawX, drawY, drawWidth, drawHeight);
}

function setupControls(
  controlsContainer: HTMLElement,
  uploadOverlay: HTMLElement,
): void {
  controlsContainer.innerHTML = `
    <div class="flex flex-col gap-6 p-4">
      <div class="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-neutral-700">Pixel Sort</span>
          <input type="checkbox" id="pixel-sort-toggle" class="h-4 w-4 cursor-pointer rounded border-neutral-300 text-neutral-800 focus:ring-neutral-800">
        </div>
        <div class="flex flex-col gap-2" id="pixel-sort-controls">
          <div class="flex items-center justify-between">
            <label class="text-xs text-neutral-500" for="pixel-sort-direction">Direction</label>
            <select id="pixel-sort-direction" class="rounded border border-neutral-200 bg-white px-2 py-1 text-sm text-neutral-700">
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
            </select>
          </div>
          <div class="flex items-center justify-between">
            <label class="text-xs text-neutral-500" for="pixel-sort-threshold">Threshold: <span id="pixel-sort-threshold-value">200</span></label>
            <input type="range" id="pixel-sort-threshold" min="0" max="255" value="200" class="w-24 cursor-pointer">
          </div>
          <div class="flex items-center justify-between">
            <label class="text-xs text-neutral-500" for="pixel-sort-mode">Mode</label>
            <select id="pixel-sort-mode" class="rounded border border-neutral-200 bg-white px-2 py-1 text-sm text-neutral-700">
              <option value="lighter-first">Lighter First</option>
              <option value="darkest-first">Darker First</option>
            </select>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-neutral-700">Chromatic Aberration</span>
          <input type="checkbox" id="chroma-toggle" class="h-4 w-4 cursor-pointer rounded border-neutral-300 text-neutral-800 focus:ring-neutral-800">
        </div>
        <div class="flex flex-col gap-2" id="chroma-controls">
          <div class="flex items-center justify-between">
            <label class="text-xs text-neutral-500" for="chroma-red">Red Offset: <span id="chroma-red-value">10</span></label>
            <input type="range" id="chroma-red" min="-50" max="50" value="10" class="w-24 cursor-pointer">
          </div>
          <div class="flex items-center justify-between">
            <label class="text-xs text-neutral-500" for="chroma-blue">Blue Offset: <span id="chroma-blue-value">-10</span></label>
            <input type="range" id="chroma-blue" min="-50" max="50" value="-10" class="w-24 cursor-pointer">
          </div>
          <div class="flex items-center justify-between">
            <label class="text-xs text-neutral-500" for="chroma-direction">Direction</label>
            <select id="chroma-direction" class="rounded border border-neutral-200 bg-white px-2 py-1 text-sm text-neutral-700">
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
            </select>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-neutral-700">Slice Offset</span>
          <input type="checkbox" id="slice-toggle" class="h-4 w-4 cursor-pointer rounded border-neutral-300 text-neutral-800 focus:ring-neutral-800">
        </div>
        <div class="flex flex-col gap-2" id="slice-controls">
          <div class="flex items-center justify-between">
            <label class="text-xs text-neutral-500" for="slice-height">Slice Height: <span id="slice-height-value">20</span></label>
            <input type="range" id="slice-height" min="1" max="100" value="20" class="w-24 cursor-pointer">
          </div>
          <div class="flex items-center justify-between">
            <label class="text-xs text-neutral-500" for="slice-displacement">Displacement: <span id="slice-displacement-value">50</span></label>
            <input type="range" id="slice-displacement" min="0" max="200" value="50" class="w-24 cursor-pointer">
          </div>
          <div class="flex items-center justify-between">
            <label class="text-xs text-neutral-500" for="slice-randomness">Randomness: <span id="slice-randomness-value">50</span></label>
            <input type="range" id="slice-randomness" min="0" max="100" value="50" class="w-24 cursor-pointer">
          </div>
        </div>
      </div>

      <div class="flex gap-2">
        <button id="reset-btn" class="flex-1 cursor-pointer rounded bg-neutral-800 px-4 py-2 text-sm text-white hover:bg-neutral-700">Reset Defaults</button>
        <button id="download-btn" class="flex-1 cursor-pointer rounded bg-neutral-800 px-4 py-2 text-sm text-white hover:bg-neutral-700">Download PNG</button>
      </div>
    </div>
  `;

  document
    .getElementById("pixel-sort-toggle")
    ?.addEventListener("change", (e) => {
      state.pixelSort.enabled = (e.target as HTMLInputElement).checked;
      render();
    });

  document
    .getElementById("pixel-sort-direction")
    ?.addEventListener("change", (e) => {
      state.pixelSort.direction = (e.target as HTMLSelectElement).value as
        | "horizontal"
        | "vertical";
      render();
    });

  document
    .getElementById("pixel-sort-threshold")
    ?.addEventListener("input", (e) => {
      state.pixelSort.threshold = parseInt(
        (e.target as HTMLInputElement).value,
      );
      document.getElementById("pixel-sort-threshold-value")!.textContent = (
        e.target as HTMLInputElement
      ).value;
      render();
    });

  document
    .getElementById("pixel-sort-mode")
    ?.addEventListener("change", (e) => {
      state.pixelSort.mode = (e.target as HTMLSelectElement).value as
        | "lighter-first"
        | "darkest-first";
      render();
    });

  document.getElementById("chroma-toggle")?.addEventListener("change", (e) => {
    state.chromaticAberration.enabled = (e.target as HTMLInputElement).checked;
    render();
  });

  document.getElementById("chroma-red")?.addEventListener("input", (e) => {
    state.chromaticAberration.redOffset = parseInt(
      (e.target as HTMLInputElement).value,
    );
    document.getElementById("chroma-red-value")!.textContent = (
      e.target as HTMLInputElement
    ).value;
    render();
  });

  document.getElementById("chroma-blue")?.addEventListener("input", (e) => {
    state.chromaticAberration.blueOffset = parseInt(
      (e.target as HTMLInputElement).value,
    );
    document.getElementById("chroma-blue-value")!.textContent = (
      e.target as HTMLInputElement
    ).value;
    render();
  });

  document
    .getElementById("chroma-direction")
    ?.addEventListener("change", (e) => {
      state.chromaticAberration.direction = (e.target as HTMLSelectElement)
        .value as "horizontal" | "vertical";
      render();
    });

  document.getElementById("slice-toggle")?.addEventListener("change", (e) => {
    state.sliceOffset.enabled = (e.target as HTMLInputElement).checked;
    render();
  });

  document.getElementById("slice-height")?.addEventListener("input", (e) => {
    state.sliceOffset.sliceHeight = parseInt(
      (e.target as HTMLInputElement).value,
    );
    document.getElementById("slice-height-value")!.textContent = (
      e.target as HTMLInputElement
    ).value;
    render();
  });

  document
    .getElementById("slice-displacement")
    ?.addEventListener("input", (e) => {
      state.sliceOffset.displacement = parseInt(
        (e.target as HTMLInputElement).value,
      );
      document.getElementById("slice-displacement-value")!.textContent = (
        e.target as HTMLInputElement
      ).value;
      render();
    });

  document
    .getElementById("slice-randomness")
    ?.addEventListener("input", (e) => {
      state.sliceOffset.randomness = parseInt(
        (e.target as HTMLInputElement).value,
      );
      document.getElementById("slice-randomness-value")!.textContent = (
        e.target as HTMLInputElement
      ).value;
      render();
    });

  document.getElementById("reset-btn")?.addEventListener("click", () => {
    state.pixelSort.enabled = false;
    state.pixelSort.direction = "horizontal";
    state.pixelSort.threshold = 200;
    state.pixelSort.mode = "lighter-first";

    state.chromaticAberration.enabled = false;
    state.chromaticAberration.redOffset = 10;
    state.chromaticAberration.blueOffset = -10;
    state.chromaticAberration.direction = "horizontal";

    state.sliceOffset.enabled = false;
    state.sliceOffset.sliceHeight = 20;
    state.sliceOffset.displacement = 50;
    state.sliceOffset.randomness = 50;

    (document.getElementById("pixel-sort-toggle") as HTMLInputElement).checked =
      false;
    (
      document.getElementById("pixel-sort-direction") as HTMLSelectElement
    ).value = "horizontal";
    (
      document.getElementById("pixel-sort-threshold") as HTMLInputElement
    ).value = "200";
    document.getElementById("pixel-sort-threshold-value")!.textContent = "200";
    (document.getElementById("pixel-sort-mode") as HTMLSelectElement).value =
      "lighter-first";

    (document.getElementById("chroma-toggle") as HTMLInputElement).checked =
      false;
    (document.getElementById("chroma-red") as HTMLInputElement).value = "10";
    document.getElementById("chroma-red-value")!.textContent = "10";
    (document.getElementById("chroma-blue") as HTMLInputElement).value = "-10";
    document.getElementById("chroma-blue-value")!.textContent = "-10";
    (document.getElementById("chroma-direction") as HTMLSelectElement).value =
      "horizontal";

    (document.getElementById("slice-toggle") as HTMLInputElement).checked =
      false;
    (document.getElementById("slice-height") as HTMLInputElement).value = "20";
    document.getElementById("slice-height-value")!.textContent = "20";
    (document.getElementById("slice-displacement") as HTMLInputElement).value =
      "50";
    document.getElementById("slice-displacement-value")!.textContent = "50";
    (document.getElementById("slice-randomness") as HTMLInputElement).value =
      "50";
    document.getElementById("slice-randomness-value")!.textContent = "50";

    render();
  });

  document.getElementById("download-btn")?.addEventListener("click", () => {
    if (!state.canvas) return;
    const link = document.createElement("a");
    link.download = "glitched-image.png";
    link.href = state.canvas.toDataURL("image/png");
    link.click();
  });
}

export function loadImage(file: File, uploadOverlay?: HTMLElement): void {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      state.image = img;

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) return;

      tempCtx.drawImage(img, 0, 0);
      state.originalImageData = tempCtx.getImageData(
        0,
        0,
        img.width,
        img.height,
      );

      if (uploadOverlay) {
        uploadOverlay.classList.add("hidden");
      }

      render();
    };
    img.src = e.target?.result as string;
  };
  reader.readAsDataURL(file);
}

export function getState(): AppState {
  return state;
}
