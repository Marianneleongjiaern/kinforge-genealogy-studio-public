import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function expectedReleaseFiles(tag) {
  assert.match(tag, /^v\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/, 'Invalid version tag');
  const version = tag.slice(1);
  const stem = `KinForge.Genealogy.Studio-${version}`;
  return [
    ...['Apple-Silicon', 'Intel'].flatMap(arch => ['dmg', 'pkg', 'zip'].map(ext => `${stem}-${arch}.${ext}`)),
    ...['setup', 'portable'].map(kind => `${stem}-x64-${kind}.exe`),
    `KinForge-${version}-webapp-website-chatgpt-site.tar.gz`,
  ];
}

export function parseChecksums(text) {
  const entries = new Map();
  for (const line of text.trim().split(/\r?\n/)) {
    const match = /^([a-fA-F0-9]{64}) [ *](.+)$/.exec(line);
    assert.ok(match, 'Malformed checksum entry');
    const [, hash, name] = match;
    assert.ok(!/[\\/\x00-\x1f]/.test(name) && name !== '.' && name !== '..', 'Unsafe checksum filename');
    assert.ok(!entries.has(name), `Duplicate checksum: ${name}`);
    entries.set(name, hash.toLowerCase());
  }
  return entries;
}

export async function verifyGitHubRelease({ repository, tag = '', token, fetchImpl = fetch, log = console.log }) {
  assert.match(repository, /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/, 'Invalid GitHub repository');
  assert.ok(token, 'A read-only GitHub token is required');
  if (tag) expectedReleaseFiles(tag);
  const request = async (path, binary = false) => {
    const response = await fetchImpl(`https://api.github.com/repos/${repository}/${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: binary ? 'application/octet-stream' : 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(180_000),
    });
    assert.ok(response.ok, `GitHub request failed (${response.status})`);
    return response;
  };
  const release = await (await request(tag ? `releases/tags/${encodeURIComponent(tag)}` : 'releases/latest')).json();
  assert.equal(release.draft, false, 'Release must be published');
  if (tag) assert.equal(release.tag_name, tag, 'Wrong release returned');
  const required = expectedReleaseFiles(release.tag_name);
  assert.ok(Array.isArray(release.assets), 'Release asset list is missing');
  const assets = new Map(release.assets.map(asset => [asset.name, asset]));
  assert.equal(assets.size, release.assets.length, 'Duplicate release assets');

  // Stream installers through the hash without saving or executing downloaded files.
  async function readAsset(name, checksum, collect = false) {
    const asset = assets.get(name);
    assert.ok(asset, `Missing release file: ${name}`);
    assert.equal(asset.state, 'uploaded', `Incomplete release file: ${name}`);
    assert.ok(Number.isSafeInteger(asset.id) && asset.id > 0, 'Invalid asset ID');
    assert.ok(Number.isSafeInteger(asset.size) && asset.size > 0, `Empty release file: ${name}`);
    assert.ok(asset.size <= (collect ? 65_536 : 4_000_000_000), `Oversized release file: ${name}`);
    assert.match(asset.digest || '', /^sha256:[a-f0-9]{64}$/, `Missing GitHub SHA-256 digest: ${name}`);
    const response = await request(`releases/assets/${asset.id}`, true);
    assert.ok(response.body, `No download body: ${name}`);
    const hash = createHash('sha256');
    const chunks = [];
    let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      assert.ok(bytes <= asset.size, `Download larger than declared size: ${name}`);
      hash.update(chunk);
      if (collect) chunks.push(Buffer.from(chunk));
    }
    assert.equal(bytes, asset.size, `Incomplete download: ${name}`);
    const digest = hash.digest('hex');
    assert.equal(`sha256:${digest}`, asset.digest, `GitHub digest mismatch: ${name}`);
    if (checksum) assert.equal(digest, checksum, `Manifest checksum mismatch: ${name}`);
    return collect ? Buffer.concat(chunks).toString('utf8') : { name, bytes, sha256: digest };
  }

  const checksums = parseChecksums(await readAsset('SHA256SUMS.txt', undefined, true));
  assert.deepEqual([...checksums.keys()].sort(), [...required].sort(), 'Checksum manifest must cover all nine release files');
  const verified = [];
  for (const name of required) {
    verified.push(await readAsset(name, checksums.get(name)));
    log(`Verified ${name}`);
  }
  return { tag: release.tag_name, verified };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await verifyGitHubRelease({
      repository: process.env.GITHUB_REPOSITORY,
      tag: process.env.RELEASE_TAG || '',
      token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
    });
    console.log(`${result.tag}: all ${result.verified.length} downloads verified.`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      await appendFile(process.env.GITHUB_STEP_SUMMARY, [
        `## KinForge ${result.tag} release verification`,
        '',
        'All nine downloads match their declared sizes, GitHub digests, and published SHA-256 checksums.',
        '',
        ...result.verified.map(file => `- ${file.name}`),
        '',
        'This checks download integrity, not signing, notarization, installer execution, feature completeness, or live deployment.',
        '',
      ].join('\n'));
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
