import "server-only";

/**
 * Envio/leitura de backups num repositório GitHub, via API REST.
 * Push usa a Git Data API (blob → tree → commit → ref), que aceita arquivos até
 * ~100 MB — ideal para backups do banco. Leitura usa o media type "raw".
 */
const API = "https://api.github.com";

type GhOpts = { token: string; repo: string; branch: string; path: string };

async function gh(token: string, method: string, url: string, body?: unknown, accept = "application/vnd.github+json"): Promise<Response> {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: accept,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return res;
}

async function jsonOrThrow(res: Response, ctx: string): Promise<unknown> {
  if (!res.ok) {
    let msg = `${res.status}`;
    try { const j = await res.json(); msg = (j as { message?: string }).message ?? msg; } catch { /* texto */ }
    throw new Error(`GitHub (${ctx}): ${msg}`);
  }
  return res.json();
}

/** Envia um arquivo (bytes) ao repositório como um commit novo. */
export async function pushToGithub(opts: GhOpts & { filename: string; bytes: Uint8Array; message: string }): Promise<{ path: string }> {
  const { token, repo, branch, path, filename, bytes, message } = opts;
  const base64 = Buffer.from(bytes).toString("base64");
  const fullPath = `${path.replace(/\/+$/, "")}/${filename}`.replace(/^\/+/, "");

  const refRes = await gh(token, "GET", `/repos/${repo}/git/ref/heads/${branch}`);
  const ref = (await jsonOrThrow(refRes, "ref")) as { object: { sha: string } };
  const baseCommitSha = ref.object.sha;
  const commit = (await jsonOrThrow(await gh(token, "GET", `/repos/${repo}/git/commits/${baseCommitSha}`), "commit")) as { tree: { sha: string } };
  const blob = (await jsonOrThrow(await gh(token, "POST", `/repos/${repo}/git/blobs`, { content: base64, encoding: "base64" }), "blob")) as { sha: string };
  const tree = (await jsonOrThrow(await gh(token, "POST", `/repos/${repo}/git/trees`, {
    base_tree: commit.tree.sha,
    tree: [{ path: fullPath, mode: "100644", type: "blob", sha: blob.sha }],
  }), "tree")) as { sha: string };
  const newCommit = (await jsonOrThrow(await gh(token, "POST", `/repos/${repo}/git/commits`, {
    message, tree: tree.sha, parents: [baseCommitSha],
  }), "commit-create")) as { sha: string };
  await jsonOrThrow(await gh(token, "PATCH", `/repos/${repo}/git/refs/heads/${branch}`, { sha: newCommit.sha }), "ref-update");
  return { path: fullPath };
}

/** Lista os `.zip` de backup na pasta configurada, mais recente primeiro. */
export async function listGithubBackups(opts: GhOpts): Promise<{ name: string; path: string; size: number }[]> {
  const { token, repo, branch, path } = opts;
  const res = await gh(token, "GET", `/repos/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${branch}`);
  if (res.status === 404) return [];
  const items = (await jsonOrThrow(res, "contents")) as Array<{ name: string; path: string; size: number; type: string }>;
  return items
    .filter((i) => i.type === "file" && i.name.endsWith(".zip"))
    .sort((a, b) => (a.name < b.name ? 1 : -1));
}

/** Baixa um arquivo do repositório como bytes (media type raw, até ~100 MB). */
export async function downloadGithubFile(opts: { token: string; repo: string; branch: string; filePath: string }): Promise<Uint8Array> {
  const { token, repo, branch, filePath } = opts;
  const res = await gh(token, "GET", `/repos/${repo}/contents/${encodeURIComponent(filePath).replace(/%2F/g, "/")}?ref=${branch}`, undefined, "application/vnd.github.raw");
  if (!res.ok) throw new Error(`GitHub (download): ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}
