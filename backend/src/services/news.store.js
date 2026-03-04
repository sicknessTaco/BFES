import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../../data");
const storePath = path.join(dataDir, "news.json");

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify({ pages: [] }, null, 2), "utf8");
  }
}

function readStore() {
  ensureStore();
  const raw = fs.readFileSync(storePath, "utf8");
  const parsed = JSON.parse(String(raw || "").replace(/^\uFEFF/, ""));
  if (!Array.isArray(parsed.pages)) parsed.pages = [];
  return parsed;
}

function writeStore(next) {
  ensureStore();
  fs.writeFileSync(storePath, JSON.stringify(next, null, 2), "utf8");
}

function toSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizePage(input, original = {}) {
  const title = String(input.title || "").trim();
  const summary = String(input.summary || "").trim();
  const content = String(input.content || "").trim();
  const coverImage = String(input.coverImage || "").trim();
  const published = input.published === true || input.published === "true";
  const slug = toSlug(input.slug || title || original.slug);

  if (!slug) throw new Error("slug is required");
  if (!title) throw new Error("title is required");
  if (!content) throw new Error("content is required");

  const now = new Date().toISOString();
  const next = {
    slug,
    title,
    summary,
    content,
    coverImage,
    published,
    updatedAt: now,
    createdAt: original.createdAt || now,
    publishedAt: published ? (original.publishedAt || now) : ""
  };

  return next;
}

export function listNewsPages(options = {}) {
  const includeDrafts = options.includeDrafts === true;
  const state = readStore();
  const pages = includeDrafts
    ? state.pages
    : state.pages.filter((item) => item.published);

  return [...pages].sort((a, b) => String(b.publishedAt || b.updatedAt || "").localeCompare(String(a.publishedAt || a.updatedAt || "")));
}

export function getNewsPage(slug, options = {}) {
  const value = toSlug(slug);
  const includeDrafts = options.includeDrafts === true;
  if (!value) return null;
  const state = readStore();
  const page = state.pages.find((item) => item.slug === value);
  if (!page) return null;
  if (!includeDrafts && !page.published) return null;
  return page;
}

export function addNewsPage(payload) {
  const state = readStore();
  const page = normalizePage(payload || {});
  if (state.pages.some((item) => item.slug === page.slug)) {
    throw new Error("news slug already exists");
  }
  state.pages.push(page);
  writeStore(state);
  return page;
}

export function updateNewsPage(slug, payload) {
  const currentSlug = toSlug(slug);
  if (!currentSlug) throw new Error("slug is required");
  const state = readStore();
  const idx = state.pages.findIndex((item) => item.slug === currentSlug);
  if (idx < 0) throw new Error("news page not found");

  const merged = normalizePage({ ...state.pages[idx], ...payload }, state.pages[idx]);
  if (merged.slug !== currentSlug && state.pages.some((item, i) => i !== idx && item.slug === merged.slug)) {
    throw new Error("news slug already exists");
  }

  state.pages[idx] = merged;
  writeStore(state);
  return merged;
}

export function removeNewsPage(slug) {
  const value = toSlug(slug);
  if (!value) throw new Error("slug is required");
  const state = readStore();
  const before = state.pages.length;
  state.pages = state.pages.filter((item) => item.slug !== value);
  if (state.pages.length === before) throw new Error("news page not found");
  writeStore(state);
}
