export interface RendererMeasurement {
  gpu: string; software: boolean; viewport: string; pixels: string; dpr: number;
  frames: number; fps: number; meanMs: number; p95Ms: number; maxMs: number;
  crt?: string; reducedMotion?: string; title?: string;
}
export function measureRenderer(options?: { sampleFrames?: number; warmupFrames?: number; gameWindow?: Window }): Promise<RendererMeasurement>;
