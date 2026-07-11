import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
export class GitRepository {
  constructor(readonly cwd: string) {}
  async git(args: string[]) {
    try {
      return (
        await run('git', args, {
          cwd: this.cwd,
          maxBuffer: 100 * 1024 * 1024,
          encoding: 'utf8',
        })
      ).stdout;
    } catch (e) {
      throw new Error(
        `Git command failed (git ${args[0] ?? ''}): ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  async verify() {
    await this.git(['rev-parse', '--is-inside-work-tree']);
    return (await this.git(['rev-parse', 'HEAD'])).trim();
  }
  async isAncestor(oldSha: string, newSha: string) {
    try {
      await this.git(['merge-base', '--is-ancestor', oldSha, newSha]);
      return true;
    } catch {
      return false;
    }
  }
  async commits(range?: string) {
    const format = '%H%x00%P%x00%aI%x00%cI%x00%s%x1e';
    const out = await this.git([
      'log',
      '--reverse',
      `--format=${format}`,
      ...(range ? [range] : []),
    ]);
    return out
      .split('\x1e')
      .map((record) => record.replace(/^\s+|\s+$/g, '').split('\0'))
      .filter((record) => record.length === 5);
  }
  async changedFiles(sha: string) {
    const out = await this.git([
      'diff-tree',
      '--root',
      '--no-commit-id',
      '--name-status',
      '-r',
      '-M',
      '-z',
      sha,
    ]);
    const parts = out.split('\0').filter(Boolean);
    const result: { status: string; path: string; oldPath: string | null }[] =
      [];
    for (let i = 0; i < parts.length;) {
      const status = parts[i++]!;
      if (status.startsWith('R')) {
        const oldPath = parts[i++]!;
        result.push({ status, path: parts[i++]!, oldPath });
      } else result.push({ status, path: parts[i++]!, oldPath: null });
    }
    return result;
  }
  async show(sha: string, file: string) {
    try {
      return await this.git(['show', `${sha}:${file}`]);
    } catch {
      return null;
    }
  }
}
