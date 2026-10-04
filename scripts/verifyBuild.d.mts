export function auditProductionBuild(directory: string): Promise<{ gzipBytes: number; limitBytes: number; files: string[]; chunks: { file: string; bytes: number; gzipBytes: number }[] }>;
