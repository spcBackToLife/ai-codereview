import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { ReviewComment } from '../review/agent.js';
import type { FileDiff } from '../git/diff.js';

export interface ReviewData {
  baseBranch: string;
  diff: unknown;
  review: unknown;
  timestamp: string;
}

const STORAGE_DIR = join(homedir(), '.code-review');

/**
 * 确保存储目录存在
 */
async function ensureStorageDir(): Promise<void> {
  if (!existsSync(STORAGE_DIR)) {
    await mkdir(STORAGE_DIR, { recursive: true });
  }
}

/**
 * 确保指定目录存在
 */
async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

/**
 * 保存审查结果
 */
export async function saveReviewResult(data: ReviewData): Promise<string> {
  await ensureStorageDir();
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `review-${timestamp}.json`;
  const filepath = join(STORAGE_DIR, filename);
  
  await writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
  
  return filepath;
}

/**
 * 保存评论到 JSON 文件
 */
export async function saveCommentsToFile(
  comments: ReviewComment[], 
  outputDir: string,
  timestamp?: string
): Promise<string> {
  await ensureDir(outputDir);
  
  const ts = timestamp || new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `comments-${ts}.json`;
  const filepath = join(outputDir, filename);
  
  await writeFile(filepath, JSON.stringify(comments, null, 2), 'utf-8');
  
  return filepath;
}

/**
 * 保存 Diff 到 JSON 文件
 */
export async function saveDiffToFile(
  diff: FileDiff[], 
  outputDir: string,
  timestamp?: string
): Promise<string> {
  await ensureDir(outputDir);
  
  const ts = timestamp || new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `diff-${ts}.json`;
  const filepath = join(outputDir, filename);
  
  await writeFile(filepath, JSON.stringify(diff, null, 2), 'utf-8');
  
  return filepath;
}

