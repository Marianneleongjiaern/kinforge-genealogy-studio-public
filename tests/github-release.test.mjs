import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { expectedReleaseFiles, parseChecksums, verifyGitHubRelease } from '../scripts/verify-github-release.mjs';

const digest = text => createHash('sha256').update(text).digest('hex');
function fixture() {
  const names = expectedReleaseFiles('v1.3.8');
  const bodies = new Map(names.map((name, index) => [index + 1, Buffer.from(`test file ${name}`)]));
  const assets = names.map((name, index) => ({ name, id: index + 1, state: 'uploaded', size: bodies.get(index + 1).length, digest: `sha256:${digest(bodies.get(index + 1))}` }));
  const manifest = Buffer.from(assets.map(asset => `${asset.digest.slice(7)}  ${asset.name}`).join('\n'));
  bodies.set(10, manifest);
  assets.push({ id: 10, name: 'SHA256SUMS.txt', state: 'uploaded', size: manifest.length, digest: `sha256:${digest(manifest)}` });
  const release = { tag_name: 'v1.3.8', draft: false, assets };
  const calls = [];
  const options = {
    repository: 'Aesdocktectics/kinforge-genealogy-studio', token: 'test-only', log() {},
    async fetchImpl(url, init) {
      assert.equal(new URL(url).hostname, 'api.github.com');
      assert.equal(init.headers.Authorization, 'Bearer test-only');
      calls.push(url);
      const id = /\/assets\/(\d+)$/.exec(url)?.[1];
      return id ? new Response(bodies.get(Number(id))) : Response.json(release);
    },
  };
  return { options, release, bodies, calls };
}

test('verifies all nine downloaded files and the manifest', async () => {
  const f = fixture();
  const result = await verifyGitHubRelease(f.options);
  assert.equal(result.verified.length, 9);
  assert.equal(result.tag, 'v1.3.8');
  assert.equal(f.calls.length, 11);
  assert.ok(f.calls[0].endsWith('/releases/latest'));
});

test('can verify a selected release tag', async () => {
  const f = fixture();
  await verifyGitHubRelease({ ...f.options, tag: 'v1.3.8' });
  assert.ok(f.calls[0].endsWith('/releases/tags/v1.3.8'));
});

for (const [name, mutate, pattern] of [
  ['missing file', f => f.release.assets.shift(), /Missing release file/],
  ['empty file', f => { f.release.assets[0].size = 0; }, /Empty release file/],
  ['unfinished upload', f => { f.release.assets[0].state = 'new'; }, /Incomplete release file/],
  ['missing digest', f => { delete f.release.assets[0].digest; }, /Missing GitHub SHA-256/],
  ['truncated download', f => { f.bodies.set(1, Buffer.from('short')); }, /Incomplete download/],
  ['corrupt download', f => { f.bodies.set(1, Buffer.alloc(f.bodies.get(1).length, 65)); }, /GitHub digest mismatch/],
  ['changed file with stale manifest', f => { f.bodies.set(1, Buffer.alloc(f.bodies.get(1).length, 65)); f.release.assets[0].digest = `sha256:${digest(f.bodies.get(1))}`; }, /Manifest checksum mismatch/],
  ['duplicate asset', f => f.release.assets.push(f.release.assets[0]), /Duplicate release assets/],
  ['draft release', f => { f.release.draft = true; }, /Release must be published/],
  ['wrong release', f => { f.options.tag = 'v1.3.9'; }, /Wrong release returned/],
]) {
  test(`rejects ${name}`, async () => {
    const f = fixture();
    mutate(f);
    await assert.rejects(verifyGitHubRelease(f.options), pattern);
  });
}

test('rejects malformed, duplicate, and unsafe checksum entries', () => {
  const hash = 'a'.repeat(64);
  assert.throws(() => parseChecksums('invalid'), /Malformed/);
  assert.throws(() => parseChecksums(`${hash}  file\n${hash}  file`), /Duplicate/);
  assert.throws(() => parseChecksums(`${hash}  ../file`), /Unsafe/);
  assert.throws(() => parseChecksums(`${hash}  folder\\file`), /Unsafe/);
  assert.equal(parseChecksums(`${hash.toUpperCase()} *file\r\n`).get('file'), hash);
});

test('rejects partial checksum coverage even if manifest digest matches', async () => {
  const f = fixture();
  const partial = Buffer.from(f.bodies.get(10).toString().split('\n').slice(1).join('\n'));
  f.bodies.set(10, partial);
  Object.assign(f.release.assets.at(-1), { size: partial.length, digest: `sha256:${digest(partial)}` });
  await assert.rejects(verifyGitHubRelease(f.options), /all nine release files/);
});

test('rejects invalid inputs and failed API requests without exposing tokens', async () => {
  const f = fixture();
  assert.throws(() => expectedReleaseFiles('../../other'), /Invalid version/);
  await assert.rejects(verifyGitHubRelease({ ...f.options, repository: 'https://example.com' }), /Invalid GitHub repository/);
  await assert.rejects(verifyGitHubRelease({ ...f.options, token: '' }), /token is required/);
  await assert.rejects(verifyGitHubRelease({ ...f.options, fetchImpl: async () => new Response('', { status: 403 }) }), /GitHub request failed \(403\)/);
});
