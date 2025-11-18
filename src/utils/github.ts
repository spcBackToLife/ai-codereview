import type { ReviewComment } from '../review/agent.js';
import type { FileDiff } from '../git/diff.js';

export interface GitHubPRComment {
  path: string;
  line: number;
  side: 'LEFT' | 'RIGHT';
  body: string;
}

export interface GitHubPRReview {
  event: 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES';
  body: string;
  comments?: GitHubPRComment[];
}

/**
 * 将 ReviewComment 转换为 GitHub PR Comment 格式
 */
export function convertToGitHubComments(
  comments: ReviewComment[],
  fileDiffs: FileDiff[]
): GitHubPRComment[] {
  const githubComments: GitHubPRComment[] = [];
  
  // 创建文件路径到 diff 的映射
  const fileDiffMap = new Map<string, FileDiff>();
  for (const diff of fileDiffs) {
    fileDiffMap.set(diff.filePath, diff);
  }
  
  for (const comment of comments) {
    const fileDiff = fileDiffMap.get(comment.filePath);
    if (!fileDiff) {
      continue; // 跳过找不到对应 diff 的评论
    }
    
    // 确定评论应该在哪一侧（LEFT 是旧代码，RIGHT 是新代码）
    // 对于新增的文件，只有 RIGHT
    // 对于修改的文件，根据行号判断
    let side: 'LEFT' | 'RIGHT' = 'RIGHT';
    if (fileDiff.status === 'deleted') {
      side = 'LEFT';
    } else if (fileDiff.status === 'modified') {
      // 检查行号是否在新代码中
      const isInNewCode = fileDiff.hunks.some(hunk => {
        const newStart = hunk.newStart;
        const newEnd = newStart + hunk.newLines;
        return comment.line >= newStart && comment.line <= newEnd;
      });
      side = isInNewCode ? 'RIGHT' : 'LEFT';
    }
    
    // 构建评论内容
    const severityEmoji = {
      error: '🔴',
      warning: '🟡',
      info: 'ℹ️',
    }[comment.severity] || 'ℹ️';
    
    const levelEmoji = {
      '强卡控': '🚫',
      '建议': '💡',
      '优化': '✨',
    }[comment.ruleLevel] || '💡';
    
    const body = [
      `${severityEmoji} **${comment.severity.toUpperCase()}** | ${levelEmoji} ${comment.ruleLevel}`,
      '',
      `**规则**: ${comment.ruleName} (${comment.ruleId})`,
      `**描述**: ${comment.ruleDesc}`,
      '',
      comment.message,
      ...(comment.suggestion ? [`\n**建议**: ${comment.suggestion}`] : []),
    ].join('\n');
    
    githubComments.push({
      path: comment.filePath,
      line: comment.line,
      side,
      body,
    });
  }
  
  return githubComments;
}

/**
 * 生成 PR Review 的总结内容
 */
export function generatePRReviewBody(
  comments: ReviewComment[],
  summary: string,
  startTime?: string,
  endTime?: string,
  duration?: number
): string {
  const errorCount = comments.filter(c => c.severity === 'error').length;
  const warningCount = comments.filter(c => c.severity === 'warning').length;
  const infoCount = comments.filter(c => c.severity === 'info').length;
  
  const sections: string[] = [
    '## 🤖 AI Code Review Results',
    '',
  ];
  
  if (startTime && endTime && duration) {
    const start = new Date(startTime).toLocaleString('zh-CN');
    const end = new Date(endTime).toLocaleString('zh-CN');
    const durationStr = formatDuration(duration);
    sections.push(`**审查时间**: ${start} - ${end} (耗时: ${durationStr})`);
    sections.push('');
  }
  
  sections.push('### 📊 统计信息');
  sections.push('');
  sections.push(`- 🔴 **错误**: ${errorCount}`);
  sections.push(`- 🟡 **警告**: ${warningCount}`);
  sections.push(`- ℹ️ **信息**: ${infoCount}`);
  sections.push(`- 📝 **总计**: ${comments.length} 个评论`);
  sections.push('');
  
  if (summary) {
    sections.push('### 📋 总结');
    sections.push('');
    sections.push(summary);
    sections.push('');
  }
  
  if (errorCount > 0) {
    sections.push('⚠️ **发现错误，请优先修复后再合并**');
  } else if (warningCount > 0) {
    sections.push('💡 **发现一些建议，建议在合并前处理**');
  } else if (comments.length === 0) {
    sections.push('✅ **未发现问题，代码审查通过**');
  } else {
    sections.push('✅ **仅发现一些优化建议，可以合并**');
  }
  
  return sections.join('\n');
}

/**
 * 格式化耗时
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(2);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * 创建 GitHub PR Review
 */
export async function createGitHubPRReview(
  owner: string,
  repo: string,
  pullNumber: number,
  review: GitHubPRReview,
  githubToken: string
): Promise<void> {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      event: review.event,
      body: review.body,
      comments: review.comments || [],
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create GitHub PR review: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  return response.json();
}

/**
 * 添加 GitHub PR Comment（普通评论，不是 review）
 */
export async function addGitHubPRComment(
  owner: string,
  repo: string,
  pullNumber: number,
  body: string,
  githubToken: string
): Promise<void> {
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${pullNumber}/comments`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      body,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to add GitHub PR comment: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  return response.json();
}

