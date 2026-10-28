import { readFile, readdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const baseline = JSON.parse(await readFile(path.join(root, 'deployment/baseline-files.json'), 'utf8'));
const files = new Map(baseline.files.map(f => [f.file, f]));
async function walk(dir, prefix = '') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name.endsWith('.md')) continue;
    const relative = prefix + entry.name;
    if (entry.isDirectory()) await walk(path.join(dir, entry.name), relative + '/');
    else files.set(relative, { file: relative, data: await readFile(path.join(dir, entry.name), 'utf8'), encoding: 'utf-8' });
  }
}
await walk(path.join(root, 'production'));
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const payload = { name: 'pawlex', project: baseline.projectId, files: [...files.values()], projectSettings: { framework: null, nodeVersion: '24.x' }, meta: { githubRepo: 'artffee/meetpawlex', githubCommitSha: commit, baselineDeployment: baseline.deploymentId }, gitMetadata: { remoteUrl: 'https://github.com/artffee/meetpawlex', commitSha: commit, commitRef: execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), dirty: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim().length > 0 } };
await writeFile(path.join(root, 'deployment/payload.json'), JSON.stringify(payload));
console.log(`Prepared ${files.size} files; existing pages and scanner retained by content hash.`);
