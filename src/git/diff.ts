import simpleGit, { SimpleGit } from 'simple-git';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export interface FileDiff {
  filePath: string;
  oldPath?: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'context' | 'addition' | 'deletion';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

/**
 * 获取两个分支之间的差异
 */
export async function getDiff(baseBranch: string, cwd?: string): Promise<FileDiff[]> {
  const git: SimpleGit = cwd ? simpleGit({ baseDir: cwd }) : simpleGit();
  
  try {
    // 检查是否是 Git 仓库
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      throw new Error('Not a Git repository. Please run this command in a Git repository.');
    }

    // 获取当前分支（如果失败，使用 HEAD）
    let currentBranch: string;
    try {
      currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
    } catch (error) {
      // 如果无法获取分支名，使用 HEAD
      currentBranch = 'HEAD';
    }
    
    // 获取 diff 统计信息
    const diffSummary = await git.diffSummary([baseBranch, currentBranch]);
    
    const fileDiffs: FileDiff[] = [];
    
    // 处理每个变更的文件
    for (const file of diffSummary.files) {
      if (file.binary) {
        // 跳过二进制文件
        continue;
      }
      
      // 获取文件的详细 diff
      const diffText = await git.diff([baseBranch, currentBranch, '--', file.file]);
      
      if (!diffText) {
        continue;
      }
      
      const hunks = parseDiffHunks(diffText);
      
      // 确定文件状态
      let status: 'added' | 'modified' | 'deleted' | 'renamed' = 'modified';
      if (file.insertions > 0 && file.deletions === 0) {
        status = 'added';
      } else if (file.insertions === 0 && file.deletions > 0) {
        status = 'deleted';
      } else if (file.renamed) {
        status = 'renamed';
      }
      
      fileDiffs.push({
        filePath: file.file,
        status,
        additions: file.insertions,
        deletions: file.deletions,
        hunks,
      });
    }
    
    return fileDiffs;
  } catch (error) {
    throw new Error(`Failed to get diff: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 解析 diff 文本为 hunks
 */
function parseDiffHunks(diffText: string): DiffHunk[] {
  const lines = diffText.split('\n');
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let oldLineNum = 0;
  let newLineNum = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 匹配 hunk 头部：@@ -oldStart,oldLines +newStart,newLines @@
    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch) {
      // 保存之前的 hunk
      if (currentHunk) {
        hunks.push(currentHunk);
      }
      
      const oldStart = parseInt(hunkMatch[1], 10);
      const oldLines = parseInt(hunkMatch[2] || '1', 10);
      const newStart = parseInt(hunkMatch[3], 10);
      const newLines = parseInt(hunkMatch[4] || '1', 10);
      
      currentHunk = {
        oldStart,
        oldLines,
        newStart,
        newLines,
        lines: [],
      };
      
      oldLineNum = oldStart;
      newLineNum = newStart;
      continue;
    }
    
    if (!currentHunk) {
      continue;
    }
    
    // 解析 diff 行
    if (line.startsWith('+') && !line.startsWith('+++')) {
      // 新增行
      currentHunk.lines.push({
        type: 'addition',
        content: line.substring(1),
        newLineNumber: newLineNum++,
      });
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      // 删除行
      currentHunk.lines.push({
        type: 'deletion',
        content: line.substring(1),
        oldLineNumber: oldLineNum++,
      });
    } else if (line.startsWith(' ')) {
      // 上下文行
      currentHunk.lines.push({
        type: 'context',
        content: line.substring(1),
        oldLineNumber: oldLineNum++,
        newLineNumber: newLineNum++,
      });
    }
  }
  
  // 添加最后一个 hunk
  if (currentHunk) {
    hunks.push(currentHunk);
  }
  
  return hunks;
}

