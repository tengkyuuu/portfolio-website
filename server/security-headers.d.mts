export function securityHeaders(req: { url?: string }, res: { setHeader(name: string, value: string): unknown }, next: () => void): void;
