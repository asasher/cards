import { createFileRoute } from "@tanstack/react-router";
import { app } from "@/server/api";

const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);

interface RequestSnapshot {
  url: string;
  method: string;
  headers: Headers;
  body?: ArrayBuffer;
}

async function snapshotRequest(request: Request): Promise<RequestSnapshot> {
  const snapshot: RequestSnapshot = {
    url: request.url,
    method: request.method,
    headers: new Headers(request.headers),
  };

  if (METHODS_WITH_BODY.has(request.method.toUpperCase())) {
    snapshot.body = await request.arrayBuffer();
  }

  return snapshot;
}

function buildRequest(snapshot: RequestSnapshot) {
  return new Request(snapshot.url, {
    method: snapshot.method,
    headers: new Headers(snapshot.headers),
    body: snapshot.body,
  });
}

function isCloneConsumedError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes("Response.clone: Body has already been consumed");
}

const forward = async ({ request }: { request: Request }) => {
  const snapshot = await snapshotRequest(request);

  try {
    return await app.fetch(buildRequest(snapshot));
  } catch (error) {
    if (!isCloneConsumedError(error)) {
      throw error;
    }
  }

  // Retry once on the known Elysia clone race in dev.
  return app.fetch(buildRequest(snapshot));
};

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: forward,
      POST: forward,
      PUT: forward,
      PATCH: forward,
      DELETE: forward,
      OPTIONS: forward,
      HEAD: forward,
    },
  },
});
