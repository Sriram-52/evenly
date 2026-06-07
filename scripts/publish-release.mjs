// Publishes a built APK to GitHub Releases. Invoked by the EAS Workflow
// (.eas/workflows/create-production-builds.yml) after the Android build.
//
// Env in:
//   GH_TOKEN           GitHub token with `contents: write` on the repo (EAS secret)
//   GH_REPO            "owner/repo", e.g. "Sriram-52/evenly"
//   APP_VERSION        marketing version, e.g. "1.0.0"
//   APP_BUILD_VERSION  Android versionCode (may be empty)
//   BUILD_ID           EAS build id (used as a tag fallback)
//   APK_PATH           path to the downloaded .apk (default: evenly.apk)
import { readFileSync } from "node:fs";

const token = process.env.GH_TOKEN;
const repo = process.env.GH_REPO;
const version = process.env.APP_VERSION || "0.0.0";
const buildVersion = (process.env.APP_BUILD_VERSION || "").trim();
const buildId = process.env.BUILD_ID || "";
const apkPath = process.env.APK_PATH || "evenly.apk";

if (!token || !repo) {
  throw new Error("Missing GH_TOKEN or GH_REPO");
}

// Unique, sortable tag: prefer the versionCode; fall back to a short build id.
const suffix = buildVersion || buildId.slice(0, 7) || "build";
const tag = `v${version}-${suffix}`;
const name = `Evenly v${version} (${suffix})`;
const assetName = `evenly-v${version}-${suffix}.apk`;

const api = `https://api.github.com/repos/${repo}`;
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

// Create the release — GitHub creates the tag against the default branch HEAD.
let res = await fetch(`${api}/releases`, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({ tag_name: tag, name, generate_release_notes: true }),
});
if (!res.ok) {
  throw new Error(`Create release failed: ${res.status} ${await res.text()}`);
}
const release = await res.json();

// Upload the APK as a release asset.
const apk = readFileSync(apkPath);
const uploadUrl = `https://uploads.github.com/repos/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(assetName)}`;
res = await fetch(uploadUrl, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/vnd.android.package-archive" },
  body: apk,
});
if (!res.ok) {
  throw new Error(`Asset upload failed: ${res.status} ${await res.text()}`);
}

console.log(`Published ${tag} → ${release.html_url}`);
