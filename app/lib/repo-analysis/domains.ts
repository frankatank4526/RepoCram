import {
  getDescriptiveFileName,
  getPathParts,
  normalizePath,
} from "./path-utils.ts";

const DOMAIN_SEGMENTS = new Set([
  "account",
  "admin",
  "analyst",
  "auth",
  "buyer",
  "cart",
  "catalog",
  "customer",
  "dashboard",
  "driver",
  "inventory",
  "menu",
  "order",
  "orders",
  "payment",
  "payments",
  "product",
  "products",
  "profile",
  "recipe",
  "recipes",
  "report",
  "reports",
  "seller",
  "store",
  "stores",
  "user",
  "users",
]);

function getDomainCandidates(path: string) {
  const normalized = normalizePath(path).toLowerCase();
  const parts = getPathParts(normalized);
  const fileTokens = getDescriptiveFileName(normalized)
    .split(/[^a-z0-9]+/)
    .map((token) => token.toLowerCase())
    .filter(Boolean);
  const candidates = [...parts, ...fileTokens].map((part) =>
    part.replace(/^\d+_/, "").replace(/_?(routes?|controllers?|services?|pages?)$/, ""),
  );

  return candidates;
}

function normalizeDomain(domain: string) {
  return {
    orders: "order",
    payments: "payment",
    products: "product",
    recipes: "recipe",
    reports: "report",
    stores: "store",
    users: "user",
  }[domain] ?? domain;
}

export function getApplicationDomain(path: string) {
  const candidates = getDomainCandidates(path);
  const match = candidates.find((candidate) => DOMAIN_SEGMENTS.has(candidate));

  return match ? normalizeDomain(match) : null;
}

export function getFeatureGroup(path: string) {
  const parts = getPathParts(path);
  const routeGroupIndex = parts.findIndex(
    (part) => part.startsWith("(") && part.endsWith(")"),
  );

  if (routeGroupIndex > -1 && parts[routeGroupIndex + 1]) {
    return parts[routeGroupIndex + 1];
  }

  const appIndex = parts.indexOf("app");
  if (appIndex > -1 && parts[appIndex + 1]) {
    return parts[appIndex + 1];
  }

  const srcIndex = parts.indexOf("src");
  if (srcIndex > -1 && parts[srcIndex + 1]) {
    return parts[srcIndex + 1];
  }

  return parts[0] ?? path;
}
