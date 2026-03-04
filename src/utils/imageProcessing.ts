export function addGaussianNoise(imageData: ImageData, sigma: number): ImageData {
  const { width, height, data } = imageData;
  const noisyData = new Uint8ClampedArray(data.length);
  
  for (let i = 0; i < data.length; i += 4) {
    noisyData[i] = clamp(data[i] + gaussianRandom() * sigma);
    noisyData[i + 1] = clamp(data[i + 1] + gaussianRandom() * sigma);
    noisyData[i + 2] = clamp(data[i + 2] + gaussianRandom() * sigma);
    noisyData[i + 3] = data[i + 3];
  }
  
  return new ImageData(noisyData, width, height);
}

function clamp(val: number): number {
  return Math.max(0, Math.min(255, Math.round(val)));
}

function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function haar2D(channel: Float32Array, width: number, height: number): Float32Array {
  const out = new Float32Array(width * height);
  const temp = new Float32Array(width * height);
  const sqrt2 = Math.SQRT2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width / 2; x++) {
      const idx1 = y * width + 2 * x;
      const idx2 = y * width + 2 * x + 1;
      temp[y * width + x] = (channel[idx1] + channel[idx2]) / sqrt2;
      temp[y * width + width / 2 + x] = (channel[idx1] - channel[idx2]) / sqrt2;
    }
  }

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height / 2; y++) {
      const idx1 = 2 * y * width + x;
      const idx2 = (2 * y + 1) * width + x;
      out[y * width + x] = (temp[idx1] + temp[idx2]) / sqrt2;
      out[(height / 2 + y) * width + x] = (temp[idx1] - temp[idx2]) / sqrt2;
    }
  }

  return out;
}

export function invHaar2D(coeffs: Float32Array, width: number, height: number): Float32Array {
  const out = new Float32Array(width * height);
  const temp = new Float32Array(width * height);
  const sqrt2 = Math.SQRT2;

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height / 2; y++) {
      const idx1 = y * width + x;
      const idx2 = (height / 2 + y) * width + x;
      temp[2 * y * width + x] = (coeffs[idx1] + coeffs[idx2]) / sqrt2;
      temp[(2 * y + 1) * width + x] = (coeffs[idx1] - coeffs[idx2]) / sqrt2;
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width / 2; x++) {
      const idx1 = y * width + x;
      const idx2 = y * width + width / 2 + x;
      out[y * width + 2 * x] = (temp[idx1] + temp[idx2]) / sqrt2;
      out[y * width + 2 * x + 1] = (temp[idx1] - temp[idx2]) / sqrt2;
    }
  }

  return out;
}

export function sureLetDenoise(detailCoeffs: Float32Array, sigma: number): { denoisedCoeffs: Float32Array, sureCurve: any[] } {
  const N = detailCoeffs.length;
  if (N === 0) return { denoisedCoeffs: detailCoeffs, sureCurve: [] };

  if (sigma <= 1e-5) {
    return { denoisedCoeffs: detailCoeffs, sureCurve: [] };
  }

  let A11 = 0, A12 = 0, A22 = 0;
  let c1 = 0, c2 = 0;
  const sigmaSq = sigma * sigma;

  for (let i = 0; i < N; i++) {
    const y = detailCoeffs[i];
    const ySq = y * y;
    const expVal = Math.exp(-ySq / (8 * sigmaSq));
    
    A11 += ySq;
    A12 += ySq * expVal;
    A22 += ySq * expVal * expVal;
    
    c1 += ySq - sigmaSq;
    c2 += (1.25 * ySq - sigmaSq) * expVal;
  }

  const det = A11 * A22 - A12 * A12;
  let a1 = 1;
  let a2 = 0;
  
  if (Math.abs(det) > 1e-10) {
    a1 = (c1 * A22 - c2 * A12) / det;
    a2 = (A11 * c2 - A12 * c1) / det;
  } else if (A11 > 1e-10) {
    a1 = c1 / A11;
    a2 = 0;
  }

  const denoisedCoeffs = new Float32Array(N);
  let maxVal = 0;
  for (let i = 0; i < N; i++) {
    const y = detailCoeffs[i];
    const ySq = y * y;
    denoisedCoeffs[i] = a1 * y + a2 * y * Math.exp(-ySq / (8 * sigmaSq));
    if (Math.abs(y) > maxVal) maxVal = Math.abs(y);
  }

  const sureCurve = [];
  const numSteps = 100;
  const stepSize = maxVal / numSteps;
  for (let step = 0; step <= numSteps; step++) {
    const x = step * stepSize;
    const xSq = x * x;
    const y_denoised = a1 * x + a2 * x * Math.exp(-xSq / (8 * sigmaSq));
    sureCurve.push({ x, identity: x, denoised: y_denoised });
  }

  return { denoisedCoeffs, sureCurve };
}

export function calculateMetrics(original: ImageData, processed: ImageData): { mse: number, psnr: number } {
  let mse = 0;
  const N = original.data.length / 4 * 3;
  for (let i = 0; i < original.data.length; i += 4) {
    mse += Math.pow(original.data[i] - processed.data[i], 2);
    mse += Math.pow(original.data[i + 1] - processed.data[i + 1], 2);
    mse += Math.pow(original.data[i + 2] - processed.data[i + 2], 2);
  }
  mse /= N;
  const psnr = mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse);
  return { mse, psnr };
}

export function denoiseImage(noisyData: ImageData, sigma: number): { denoisedData: ImageData, sureCurves: any[] } {
  const { width, height, data } = noisyData;
  const denoisedData = new Uint8ClampedArray(data.length);
  const sureCurves = [];

  for (let c = 0; c < 3; c++) {
    const channel = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      channel[i] = data[i * 4 + c];
    }

    const coeffs = haar2D(channel, width, height);

    const detailCoeffs = [];
    const halfW = width / 2;
    const halfH = height / 2;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!(x < halfW && y < halfH)) {
          detailCoeffs.push(coeffs[y * width + x]);
        }
      }
    }

    const { denoisedCoeffs, sureCurve } = sureLetDenoise(new Float32Array(detailCoeffs), sigma);
    sureCurves.push(sureCurve);

    let detailIdx = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!(x < halfW && y < halfH)) {
          coeffs[y * width + x] = denoisedCoeffs[detailIdx++];
        }
      }
    }

    const denoisedChannel = invHaar2D(coeffs, width, height);

    for (let i = 0; i < width * height; i++) {
      denoisedData[i * 4 + c] = clamp(denoisedChannel[i]);
    }
  }

  for (let i = 3; i < data.length; i += 4) {
    denoisedData[i] = data[i];
  }

  return { denoisedData: new ImageData(denoisedData, width, height), sureCurves };
}
