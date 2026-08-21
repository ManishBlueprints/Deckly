import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import fs from "node:fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import type { IncomingMessage, ServerResponse } from "http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const parseEnvFile = (filePath: string): Record<string, string> => {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const contents = fs.readFileSync(filePath, "utf8");
  return contents.split(/\r?\n/).reduce<Record<string, string>>((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return acc;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) {
      return acc;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value =
      rawValue.startsWith('"') && rawValue.endsWith('"')
        ? rawValue.slice(1, -1)
        : rawValue;

    if (key) {
      acc[key] = value;
    }

    return acc;
  }, {});
};

const readRequestBody = async (req: IncomingMessage): Promise<ArrayBuffer | null> => {
  if (req.method === "GET" || req.method === "HEAD") {
    return null;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return null;
  }

  const combined = Buffer.concat(chunks);
  return combined.buffer.slice(
    combined.byteOffset,
    combined.byteOffset + combined.byteLength,
  );
};

const sendWebResponse = async (
  webResponse: Response,
  res: ServerResponse,
) => {
  res.statusCode = webResponse.status;
  res.statusMessage = webResponse.statusText;

  webResponse.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  if (!webResponse.body) {
    res.end();
    return;
  }

  const body = Buffer.from(await webResponse.arrayBuffer());
  res.end(body);
};

const toHeaderEntries = (
  headers: IncomingMessage["headers"],
): Array<[string, string]> =>
  Object.entries(headers).flatMap(([key, value]): Array<[string, string]> => {
    if (value === undefined) {
      return [];
    }

    if (Array.isArray(value)) {
      return [[key, value.join(", ")]];
    }

    return [[key, value]];
  });

const apiDevBridge = () => ({
  name: "api-dev-bridge",
  configureServer(server: {
    middlewares: {
      use: (
        handler: (
          req: IncomingMessage,
          res: ServerResponse,
          next: () => void,
        ) => void | Promise<void>,
      ) => void;
    };
  }) {
    server.middlewares.use(async (req, res, next) => {
      const requestUrl = req.url ?? "/";
      const pathname = requestUrl.split("?")[0] ?? requestUrl;

      if (pathname !== "/api/extract-document-text") {
        next();
        return;
      }

      try {
        const moduleUrl = `${pathToFileURL(
          path.resolve(__dirname, "api/extract-document-text.ts"),
        ).href}?t=${Date.now()}`;
        const routeModule = await import(moduleUrl);
        const handler = (routeModule.POST || routeModule.default) as (request: Request) => Promise<Response>;

        const body = await readRequestBody(req);
        const request = new Request(`http://localhost:5173${requestUrl}`, {
          method: req.method ?? "GET",
          headers: new Headers(toHeaderEntries(req.headers)),
          body,
        });

        const response = await handler(request);
        await sendWebResponse(response, res);
      } catch (error) {
        console.error("[api-dev-bridge] extract-document-text failed", error);
        const message = error instanceof Error ? error.message : String(error);
        res.statusCode = 500;
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            error: true,
            message,
          }),
        );
      }
    });
  },
});

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseFunctionsEnv = parseEnvFile(
    path.resolve(__dirname, "supabase/functions/.env"),
  );
  Object.assign(process.env, supabaseFunctionsEnv, env);

  return {
    plugins: [
      apiDevBridge(),
      react(),
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
      }),
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    // These dependencies first appear behind the lazy /upload route. Without
    // eager optimization, Vite can discover them during navigation, invalidate
    // the active dependency graph, and answer the route imports with 504
    // "Outdated Optimize Dep" responses.
    optimizeDeps: {
      include: ["pdfjs-dist", "@radix-ui/react-switch"],
    },
    build: {
      sourcemap: "hidden",
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              return "vendor";
            }
          },
        },
      },
    },
  };
});
