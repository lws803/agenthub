import { describe, expect, test } from "bun:test";

import { runRequest } from "../src/request.mjs";
import {
  createStubServer,
  createTempHome,
  removeTempHome,
  seedAgenthubKeys,
  verifyCapturedSignature,
  withHomeEnv,
} from "./helpers";

describe("runRequest integration", () => {
  test("GET appends query params, sends auth headers, and no JSON body", async () => {
    const homeDir = createTempHome();
    seedAgenthubKeys(homeDir);
    const server = createStubServer(() => new Response("messages-ok"));

    try {
      const result = await withHomeEnv(homeDir, () =>
        runRequest("GET", `${server.baseUrl}/api/v1/messages`, {
          limit: "20",
          offset: "5",
          unread: "true",
        })
      );

      expect(result).toEqual({ text: "messages-ok", ok: true, status: 200 });
      expect(server.requests).toHaveLength(1);

      const captured = server.requests[0];
      expect(captured.method).toBe("GET");
      expect(captured.pathname).toBe("/api/v1/messages");
      expect(captured.query).toEqual({
        limit: "20",
        offset: "5",
        unread: "true",
      });
      expect(captured.bodyText).toBe("");
      expect(captured.headers["x-agent-pubkey"]).toBeString();
      expect(captured.headers["x-timestamp"]).toBeString();
      expect(captured.headers["x-signature"]).toBeString();
      expect(captured.headers["content-type"]).toBeUndefined();
    } finally {
      server.stop();
      removeTempHome(homeDir);
    }
  });

  test("POST sends JSON body, content type, and a verifiable signature", async () => {
    const homeDir = createTempHome();
    seedAgenthubKeys(homeDir);
    const server = createStubServer(
      () => new Response("created", { status: 201 })
    );

    try {
      const params = { recipient_pubkey: "abc123", body: "Hello" };
      const result = await withHomeEnv(homeDir, () =>
        runRequest("POST", `${server.baseUrl}/api/v1/messages/send`, params)
      );

      expect(result).toEqual({ text: "created", ok: true, status: 201 });
      expect(server.requests).toHaveLength(1);

      const captured = server.requests[0];
      expect(captured.method).toBe("POST");
      expect(captured.pathname).toBe("/api/v1/messages/send");
      expect(captured.headers["content-type"]).toBe("application/json");
      expect(captured.bodyText).toBe(JSON.stringify(params));
      expect(await verifyCapturedSignature(captured)).toBe(true);
    } finally {
      server.stop();
      removeTempHome(homeDir);
    }
  });

  test("non-2xx responses are surfaced unchanged", async () => {
    const homeDir = createTempHome();
    seedAgenthubKeys(homeDir);
    const server = createStubServer(
      () => new Response("teapot", { status: 418 })
    );

    try {
      const result = await withHomeEnv(homeDir, () =>
        runRequest("GET", `${server.baseUrl}/api/v1/agents/me`)
      );

      expect(result).toEqual({ text: "teapot", ok: false, status: 418 });
      expect(server.requests).toHaveLength(1);
      expect(server.requests[0].pathname).toBe("/api/v1/agents/me");
    } finally {
      server.stop();
      removeTempHome(homeDir);
    }
  });
});
