import type { CorsOptions, CorsOptionsDelegate } from 'cors';
import type { Request } from 'express';

export const CHATGPT_ORIGIN = 'https://chatgpt.com';

const CHATGPT_CONNECTION_PATHS = [
  /^\/mcp$/,
  /^\/oauth\//,
  /^\/\.well-known\/oauth-authorization-server$/,
  /^\/\.well-known\/oauth-protected-resource(?:\/mcp)?$/,
];

export function isChatGptConnectionPath(path: string): boolean {
  return CHATGPT_CONNECTION_PATHS.some((pattern) => pattern.test(path));
}

export function isCorsOriginAllowed(input: {
  origin: string | undefined;
  path: string;
  allowedOrigins: readonly string[];
  isDevelopment: boolean;
}): boolean {
  const { origin, path, allowedOrigins, isDevelopment } = input;
  if (!origin) return true;
  if (isDevelopment || allowedOrigins.includes(origin)) return true;
  return origin === CHATGPT_ORIGIN && isChatGptConnectionPath(path);
}

export function createCorsOptionsDelegate(input: {
  allowedOrigins: readonly string[];
  isDevelopment: boolean;
}): CorsOptionsDelegate<Request> {
  return (req, callback) => {
    const options: CorsOptions = {
      credentials: true,
      optionsSuccessStatus: 200,
      origin: (origin, originCallback) => {
        if (
          isCorsOriginAllowed({
            origin,
            path: req.path,
            allowedOrigins: input.allowedOrigins,
            isDevelopment: input.isDevelopment,
          })
        ) {
          originCallback(null, true);
          return;
        }
        originCallback(new Error('Not allowed by CORS'));
      },
    };
    callback(null, options);
  };
}
