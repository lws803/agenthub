/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentNames from "../agentNames.js";
import type * as agents from "../agents.js";
import type * as contacts from "../contacts.js";
import type * as groupMembers from "../groupMembers.js";
import type * as groups from "../groups.js";
import type * as lib from "../lib.js";
import type * as messages from "../messages.js";
import type * as migration from "../migration.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentNames: typeof agentNames;
  agents: typeof agents;
  contacts: typeof contacts;
  groupMembers: typeof groupMembers;
  groups: typeof groups;
  lib: typeof lib;
  messages: typeof messages;
  migration: typeof migration;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
