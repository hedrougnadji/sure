/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Upload, Image as ImageIcon, Activity, BarChart3, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Slider } from './components/ui/slider';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { addGaussianNoise, denoiseImage, calculateMetrics } from './utils/imageProcessing';

const TARGET_SIZE = 256;

export default function App() {
  const [originalImage, setOriginalImage] = useState<ImageData | null>(null);
  const [noisyImage, setNoisyImage] = useState<ImageData | null>(null);
  const [denoisedImage, setDenoisedImage] = useState<ImageData | null>(null);
  
  const [noiseLevel, setNoiseLevel] = useState<number>(25);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  const [metrics, setMetrics] = useState({
    noisy: { psnr: 0, mse: 0 },
    denoised: { psnr: 0, mse: 0 }
  });
  
  const [sureLetCurveData, setSureLetCurveData] = useState<any[]>([]);

  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const noisyCanvasRef = useRef<HTMLCanvasElement>(null);
  const denoisedCanvasRef = useRef<HTMLCanvasElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = TARGET_SIZE;
        canvas.height = TARGET_SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.drawImage(img, 0, 0, TARGET_SIZE, TARGET_SIZE);
        const imageData = ctx.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE);
        setOriginalImage(imageData);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!originalImage) return;

    setIsProcessing(true);
    
    setTimeout(() => {
      const noisy = addGaussianNoise(originalImage, noiseLevel);
      setNoisyImage(noisy);
      
      const processingSigma = Math.max(0.1, noiseLevel);
      const { denoisedData, sureCurves } = denoiseImage(noisy, processingSigma);
      setDenoisedImage(denoisedData);
      
      const noisyMetrics = calculateMetrics(originalImage, noisy);
      const denoisedMetrics = calculateMetrics(originalImage, denoisedData);
      
      setMetrics({
        noisy: noisyMetrics,
        denoised: denoisedMetrics
      });
      
      if (sureCurves && sureCurves.length > 0) {
        setSureLetCurveData(sureCurves[0]);
      }
      
      setIsProcessing(false);
    }, 50);
  }, [originalImage, noiseLevel]);

  useEffect(() => {
    if (originalImage && originalCanvasRef.current) {
      const ctx = originalCanvasRef.current.getContext('2d');
      ctx?.putImageData(originalImage, 0, 0);
    }
  }, [originalImage]);

  useEffect(() => {
    if (noisyImage && noisyCanvasRef.current) {
      const ctx = noisyCanvasRef.current.getContext('2d');
      ctx?.putImageData(noisyImage, 0, 0);
    }
  }, [noisyImage]);

  useEffect(() => {
    if (denoisedImage && denoisedCanvasRef.current) {
      const ctx = denoisedCanvasRef.current.getContext('2d');
      ctx?.putImageData(denoisedImage, 0, 0);
    }
  }, [denoisedImage]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <header className="text-center space-y-4 py-8">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            SURE-LET Image Denoising
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Educational demo of image denoising using Stein's Unbiased Risk Estimator - Linear Expansion of Thresholds (SURE-LET). 
            Upload an image, add Gaussian noise, and see how the algorithm finds the optimal non-linear thresholding function.
          </p>
        </header>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 w-full">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-3 text-slate-400" />
                  <p className="mb-2 text-sm text-slate-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                  <p className="text-xs text-slate-500">PNG, JPG up to 5MB</p>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
              </label>
            </div>
            
            <div className="flex-1 w-full space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Gaussian Noise Level (&sigma;)
                </label>
                <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                  {noiseLevel}
                </span>
              </div>
              <Slider 
                min={0} 
                max={100} 
                value={noiseLevel} 
                onChange={(e) => setNoiseLevel(Number(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-slate-500">
                Adjust the slider to add synthetic Gaussian noise to the image. The algorithm will automatically estimate the optimal thresholding function to remove it.
              </p>
            </div>
          </CardContent>
        </Card>

        {originalImage && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <CardHeader className="bg-slate-100 border-b border-slate-200 py-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> Original Image
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 flex flex-col items-center justify-center bg-slate-50">
                <canvas 
                  ref={originalCanvasRef} 
                  width={TARGET_SIZE} 
                  height={TARGET_SIZE} 
                  className="rounded-lg shadow-sm w-full max-w-[256px] h-auto object-contain bg-white"
                />
                <div className="mt-4 w-full grid grid-cols-2 gap-2 text-center text-sm">
                  <div className="bg-white p-2 rounded border border-slate-100">
                    <div className="text-slate-500 text-xs">PSNR</div>
                    <div className="font-mono font-medium text-slate-400">-</div>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-100">
                    <div className="text-slate-500 text-xs">MSE</div>
                    <div className="font-mono font-medium text-slate-400">-</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <CardHeader className="bg-slate-100 border-b border-slate-200 py-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="w-4 h-4 text-red-500" /> Noisy Image
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 flex flex-col items-center justify-center bg-slate-50 relative">
                {isProcessing && (
                  <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10 backdrop-blur-sm">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  </div>
                )}
                <canvas 
                  ref={noisyCanvasRef} 
                  width={TARGET_SIZE} 
                  height={TARGET_SIZE} 
                  className="rounded-lg shadow-sm w-full max-w-[256px] h-auto object-contain bg-white"
                />
                <div className="mt-4 w-full grid grid-cols-2 gap-2 text-center text-sm">
                  <div className="bg-white p-2 rounded border border-slate-100">
                    <div className="text-slate-500 text-xs">PSNR</div>
                    <div className="font-mono font-medium text-red-600">{metrics.noisy.psnr.toFixed(2)} dB</div>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-100">
                    <div className="text-slate-500 text-xs">MSE</div>
                    <div className="font-mono font-medium text-red-600">{metrics.noisy.mse.toFixed(2)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <CardHeader className="bg-slate-100 border-b border-slate-200 py-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-500" /> Denoised (SURE-LET)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 flex flex-col items-center justify-center bg-slate-50 relative">
                {isProcessing && (
                  <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10 backdrop-blur-sm">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  </div>
                )}
                <canvas 
                  ref={denoisedCanvasRef} 
                  width={TARGET_SIZE} 
                  height={TARGET_SIZE} 
                  className="rounded-lg shadow-sm w-full max-w-[256px] h-auto object-contain bg-white"
                />
                <div className="mt-4 w-full grid grid-cols-2 gap-2 text-center text-sm">
                  <div className="bg-white p-2 rounded border border-slate-100">
                    <div className="text-slate-500 text-xs">PSNR</div>
                    <div className="font-mono font-medium text-emerald-600">{metrics.denoised.psnr.toFixed(2)} dB</div>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-100">
                    <div className="text-slate-500 text-xs">MSE</div>
                    <div className="font-mono font-medium text-emerald-600">{metrics.denoised.mse.toFixed(2)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        )}

        {originalImage && sureLetCurveData.length > 0 && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-200">
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="w-5 h-5 text-indigo-500" />
                SURE-LET Thresholding Function
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-1">
                  <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                    <strong>SURE-LET</strong> (Linear Expansion of Thresholds) expresses the denoising function as a linear combination of basis functions. 
                    <br/><br/>
                    Instead of searching for a single threshold value, it solves a linear system of equations to find the optimal coefficients that minimize the Stein's Unbiased Risk Estimator (SURE).
                    <br/><br/>
                    The chart shows the resulting non-linear thresholding function applied to the wavelet coefficients (solid blue line) compared to the identity function (dashed gray line). Notice how small coefficients are shrunk towards zero, while large coefficients are preserved.
                  </p>
                </div>
                <div className="flex-1 h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sureLetCurveData} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="x" 
                        type="number" 
                        domain={['dataMin', 'dataMax']} 
                        tickFormatter={(val) => val.toFixed(0)}
                        label={{ value: 'Input Coefficient (y)', position: 'insideBottom', offset: -10 }}
                      />
                      <YAxis 
                        domain={['auto', 'auto']} 
                        tickFormatter={(val) => val.toFixed(0)}
                        label={{ value: 'Output Coefficient', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip 
                        formatter={(value: number) => value.toFixed(2)}
                        labelFormatter={(label: number) => `Input: ${label.toFixed(2)}`}
                      />
                      <Line 
                        name="Identity"
                        type="monotone" 
                        dataKey="identity" 
                        stroke="#94a3b8" 
                        strokeDasharray="5 5"
                        strokeWidth={2} 
                        dot={false} 
                      />
                      <Line 
                        name="SURE-LET"
                        type="monotone" 
                        dataKey="denoised" 
                        stroke="#4f46e5" 
                        strokeWidth={2} 
                        dot={false} 
                        activeDot={{ r: 6 }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}

