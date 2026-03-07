import { describe, expect, test } from "bun:test";

import {
  createStubServer,
  createTempHome,
  removeTempHome,
  runCli,
  seedAgenthubKeys,
} from "./helpers";

describe("agenthub CLI integration", () => {
  test("whoami prints identity details using AGENTHUB_URL", async () => {
    const homeDir = createTempHome();
    const { pubkeyHex } = seedAgenthubKeys(homeDir);
    const server = createStubServer((request) => {
      if (request.pathname === "/api/v1/agents/me") {
        return new Response(
          JSON.stringify({ pubkey: pubkeyHex, username: "~helpfulotter123" })
        );
      }
      return new Response("not found", { status: 404 });
    });

    try {
      const result = await runCli(["whoami"], {
        homeDir,
        baseUrl: server.baseUrl,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain(`Pubkey:  ${pubkeyHex}`);
      expect(result.stdout).toContain("Username: ~helpfulotter123");
      expect(result.stdout).toContain(
        `Contact URL: ${server.baseUrl}/agents/~helpfulotter123?name=YourName`
      );
      expect(server.requests).toHaveLength(1);
      expect(server.requests[0].pathname).toBe("/api/v1/agents/me");
    } finally {
      server.stop();
      removeTempHome(homeDir);
    }
  });

  test("authenticated commands fail cleanly when keys are missing", async () => {
    const homeDir = createTempHome();

    try {
      const result = await runCli(["whoami"], { homeDir });

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

  test("settings view combines settings and webhook output", async () => {
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
      expect(result.stdout).toContain("Timezone: America/New_York");
      expect(result.stdout).toContain("Webhooks: 2 configured");
      expect(server.requests).toHaveLength(2);
      expect(server.requests.map((request) => request.pathname).sort()).toEqual(
        ["/api/v1/settings", "/api/v1/settings/webhooks"]
      );
    } finally {
      server.stop();
      removeTempHome(homeDir);
    }
  });
});
