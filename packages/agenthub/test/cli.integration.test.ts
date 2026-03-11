import { describe, expect, test } from "bun:test";

import {
  createStubServer,
  createTempHome,
  removeTempHome,
  runCli,
  seedAgenthubKeys,
} from "./helpers";

describe("agenthub CLI integration", () => {
  test("authenticated commands fail cleanly when keys are missing", async () => {
    const homeDir = createTempHome();

    try {
      const result = await runCli(["messages"], { homeDir });

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("No keypair found");
    } finally {
      removeTempHome(homeDir);
    }
  });

  test("contacts block falls back from PATCH 404 to POST", async () => {
    const homeDir = createTempHome();
    seedAgenthubKeys(homeDir);
    const pubkey = "ff".repeat(32);
    const server = createStubServer((request) => {
      if (
        request.method === "PATCH" &&
        request.pathname === `/api/v1/contacts/${pubkey}`
      ) {
        return new Response("missing contact", { status: 404 });
      }

      if (
        request.method === "POST" &&
        request.pathname === "/api/v1/contacts"
      ) {
        return new Response("blocked created");
      }

      return new Response("unexpected request", { status: 500 });
    });

    try {
      const result = await runCli(["contacts", "block", "--pubkey", pubkey], {
        homeDir,
        baseUrl: server.baseUrl,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("blocked created");
      expect(server.requests).toHaveLength(2);
      expect(server.requests[0].method).toBe("PATCH");
      expect(server.requests[0].pathname).toBe(`/api/v1/contacts/${pubkey}`);
      expect(server.requests[1].method).toBe("POST");
      expect(server.requests[1].pathname).toBe("/api/v1/contacts");
      expect(JSON.parse(server.requests[1].bodyText)).toEqual({
        contact_pubkey: pubkey,
        name: "Blocked",
        is_blocked: true,
      });
    } finally {
      server.stop();
      removeTempHome(homeDir);
    }
  });

  test("settings view outputs JSON", async () => {
    const homeDir = createTempHome();
    seedAgenthubKeys(homeDir);
    const server = createStubServer((request) => {
      if (request.pathname === "/api/v1/settings") {
        return new Response(JSON.stringify({ timezone: "America/New_York" }));
      }

      if (request.pathname === "/api/v1/settings/webhooks") {
        return new Response(
          JSON.stringify({ webhooks: [{ id: 1 }, { id: 2 }] })
        );
      }

      return new Response("not found", { status: 404 });
    });

    try {
      const result = await runCli(["settings", "view"], {
        homeDir,
        baseUrl: server.baseUrl,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      const out = JSON.parse(result.stdout);
      expect(out.timezone).toBe("America/New_York");
      expect(out.webhooks).toHaveLength(2);
      expect(out.webhooks[0].id).toBe(1);
      expect(server.requests).toHaveLength(2);
      expect(server.requests.map((request) => request.pathname).sort()).toEqual(
        ["/api/v1/settings", "/api/v1/settings/webhooks"]
      );
    } finally {
      server.stop();
      removeTempHome(homeDir);
    }
  });

  test("wait exits immediately when unread messages exist", async () => {
    const homeDir = createTempHome();
    const { pubkeyHex } = seedAgenthubKeys(homeDir);
    const messagesPayload = {
      messages: [
        {
          id: "msg_1",
          sender_pubkey: "ab".repeat(32),
          sender_name: "~alice",
          recipient_pubkey: pubkeyHex,
          recipient_name: null,
          body: "Hello",
          created_at: "2025-03-09T12:00:00Z",
          is_new: true,
        },
        {
          id: "msg_2",
          sender_pubkey: pubkeyHex,
          sender_name: null,
          recipient_pubkey: "cd".repeat(32),
          recipient_name: null,
          body: "My reply",
          created_at: "2025-03-09T12:00:01Z",
          is_from_me: true,
        },
      ],
      total: 2,
      limit: 20,
      offset: 0,
    };
    const server = createStubServer((request) => {
      if (
        request.pathname === "/api/v1/messages" &&
        request.query.is_read === "false"
      ) {
        return new Response(JSON.stringify(messagesPayload), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    });

    try {
      const result = await runCli(["wait"], {
        homeDir,
        baseUrl: server.baseUrl,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(JSON.parse(result.stdout)).toEqual(messagesPayload);
      expect(server.requests).toHaveLength(1);
      expect(server.requests[0].pathname).toBe("/api/v1/messages");
      expect(server.requests[0].query.is_read).toBe("false");
    } finally {
      server.stop();
      removeTempHome(homeDir);
    }
  });

  test("wait polls until unread messages arrive", async () => {
    const homeDir = createTempHome();
    seedAgenthubKeys(homeDir);
    let pollCount = 0;
    const emptyPayload = {
      messages: [],
      total: 0,
      limit: 20,
      offset: 0,
    };
    const messagesPayload = {
      messages: [
        {
          id: "msg_2",
          sender_pubkey: "ab".repeat(32),
          sender_name: null,
          recipient_pubkey: "cd".repeat(32),
          recipient_name: null,
          body: "New message",
          created_at: "2025-03-09T12:01:00Z",
          is_new: true,
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    };
    const server = createStubServer((request) => {
      if (
        request.pathname === "/api/v1/messages" &&
        request.query.is_read === "false"
      ) {
        pollCount += 1;
        if (pollCount < 3) {
          return new Response(JSON.stringify(emptyPayload), {
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify(messagesPayload), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    });

    try {
      const result = await runCli(["wait"], {
        homeDir,
        baseUrl: server.baseUrl,
        env: { AGENTHUB_STANDBY_INTERVAL_MS: "50" },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(JSON.parse(result.stdout)).toEqual(messagesPayload);
      expect(server.requests).toHaveLength(3);
    } finally {
      server.stop();
      removeTempHome(homeDir);
    }
  });

  test("wait exits with code 1 and empty JSON when --timeout is reached", async () => {
    const homeDir = createTempHome();
    seedAgenthubKeys(homeDir);
    const emptyPayload = {
      messages: [],
      total: 0,
      limit: 20,
      offset: 0,
    };
    const server = createStubServer((request) => {
      if (
        request.pathname === "/api/v1/messages" &&
        request.query.is_read === "false"
      ) {
        return new Response(JSON.stringify(emptyPayload), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    });

    try {
      const result = await runCli(["wait", "--timeout", "1"], {
        homeDir,
        baseUrl: server.baseUrl,
        env: { AGENTHUB_STANDBY_INTERVAL_MS: "50" },
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe("");
      const out = JSON.parse(result.stdout);
      expect(out.messages).toEqual([]);
      expect(out.total).toBe(0);
      expect(server.requests.length).toBeGreaterThanOrEqual(1);
    } finally {
      server.stop();
      removeTempHome(homeDir);
    }
  });

  test("wait surfaces API errors and exits with code 1", async () => {
    const homeDir = createTempHome();
    seedAgenthubKeys(homeDir);
    const server = createStubServer((request) => {
      if (
        request.pathname === "/api/v1/messages" &&
        request.query.is_read === "false"
      ) {
        return new Response(
          JSON.stringify({ error: "Internal server error" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      return new Response("not found", { status: 404 });
    });

    try {
      const result = await runCli(["wait"], {
        homeDir,
        baseUrl: server.baseUrl,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Internal server error");
      expect(server.requests).toHaveLength(1);
    } finally {
      server.stop();
      removeTempHome(homeDir);
    }
  });
});
