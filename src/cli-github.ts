#!/usr/bin/env node

import { Command } from 'commander';
import { getDiff } from './git/diff.js';
import { reviewCode } from './review/agent.js';
import { saveCommentsToFile, saveDiffToFile } from './utils/storage.js';
import {
  convertToGitHubComments,
  generatePRReviewBody,
  createGitHubPRReview,
  addGitHubPRComment,
} from './utils/github.js';
import { setLanguage, t, type Language } from './utils/i18n.js';
import chalk from 'chalk';
import path from 'path';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const program = new Command();

program
  .name('code-review-github')
  .description('AI-powered code review tool for GitHub PRs')
  .version('1.0.0')
  .option('-r, --rules <files...>', 'Additional rule JSON files to load')
  .option('-p, --pwd <directory>', 'Working directory (default: current directory)', process.cwd())
  .option('--env <file>', 'Path to .env file (default: .env)', '.env')
  .option('--max-retries <number>', 'Maximum number of continuation attempts for incomplete JSON responses (default: 10)', '10')
  .option('--github-token <token>', 'GitHub token for PR comments (or set GITHUB_TOKEN env var)')
  .option('--github-owner <owner>', 'GitHub repository owner (or set GITHUB_REPOSITORY_OWNER env var)')
  .option('--github-repo <repo>', 'GitHub repository name (or set GITHUB_REPOSITORY_NAME env var)')
  .option('--github-pr <number>', 'GitHub PR number (or set GITHUB_PR_NUMBER env var)')
  .option('--review-event <event>', 'GitHub review event: COMMENT, APPROVE, or REQUEST_CHANGES (default: COMMENT)', 'COMMENT')
  .option('-o, --output <directory>', 'Output directory for JSON files (default: .code-review in current directory)')
  .option('--lang <language>', 'Language: en or zh-CN (default: en)', 'en')
  .action(async () => {
    const options = program.opts<{
      rules?: string[];
      pwd?: string;
      env?: string;
      maxRetries?: string;
      githubToken?: string;
      githubOwner?: string;
      githubRepo?: string;
      githubPr?: string;
      reviewEvent?: string;
      output?: string;
      lang?: string;
    }>();
    
    // Set language
    const lang = (options.lang === 'zh-CN' ? 'zh-CN' : 'en') as Language;
    setLanguage(lang);

    try {
      // 加载 .env 文件
      const workDir = path.resolve(options.pwd || process.cwd());
      const projectRoot = path.resolve(__dirname, '..');
      const projectEnvPath = path.resolve(projectRoot, '.env');
      const workEnvPath = path.resolve(workDir, options.env || '.env');

      let envLoaded = false;

      if (existsSync(projectEnvPath)) {
        console.log(chalk.gray(`📄 Loading environment variables from: ${projectEnvPath}`));
        const result = config({ path: projectEnvPath, override: true });
        if (result.error) {
          console.warn(chalk.yellow(`⚠️  Warning: Failed to load .env file: ${result.error.message}`));
        } else {
          const loadedCount = Object.keys(result.parsed || {}).length;
          console.log(chalk.gray(`   ✓ Loaded ${loadedCount} environment variable(s) from project root`));
          envLoaded = true;
        }
      }

      if (existsSync(workEnvPath) && workEnvPath !== projectEnvPath) {
        console.log(chalk.gray(`📄 Loading environment variables from: ${workEnvPath}`));
        const result = config({ path: workEnvPath, override: true });
        if (result.error) {
          console.warn(chalk.yellow(`⚠️  Warning: Failed to load .env file: ${result.error.message}`));
        } else {
          const loadedCount = Object.keys(result.parsed || {}).length;
          console.log(chalk.gray(`   ✓ Loaded ${loadedCount} environment variable(s) from work directory`));
          envLoaded = true;
        }
      }

      // 获取 GitHub 配置
      const githubToken = options.githubToken || process.env.GITHUB_TOKEN;
      const githubOwner = options.githubOwner || process.env.GITHUB_REPOSITORY_OWNER;
      const githubRepo = options.githubRepo || process.env.GITHUB_REPOSITORY_NAME;
      const githubPr = options.githubPr || process.env.GITHUB_PR_NUMBER;

      if (!githubToken) {
        throw new Error('GitHub token is required. Set --github-token or GITHUB_TOKEN environment variable.');
      }

      if (!githubOwner || !githubRepo || !githubPr) {
        throw new Error('GitHub repository information is required. Set --github-owner, --github-repo, --github-pr or corresponding environment variables.');
      }

      const prNumber = parseInt(githubPr, 10);
      if (isNaN(prNumber)) {
        throw new Error(`Invalid PR number: ${githubPr}`);
      }

      const reviewEvent = (options.reviewEvent?.toUpperCase() || 'COMMENT') as 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES';
      if (!['COMMENT', 'APPROVE', 'REQUEST_CHANGES'].includes(reviewEvent)) {
        throw new Error(`Invalid review event: ${reviewEvent}. Must be COMMENT, APPROVE, or REQUEST_CHANGES.`);
      }

      console.log(chalk.blue(`${t('github.starting')}\n`));
      console.log(chalk.gray(`${t('github.workingDir')} ${workDir}\n`));
      console.log(chalk.gray(`${t('github.github')} ${githubOwner}/${githubRepo}#${prNumber}\n`));

      // 获取 Git diff（对比 PR 的 base 分支）
      // 在 GitHub Actions 中，可以通过环境变量 GITHUB_BASE_REF 获取 base 分支
      // 格式通常是 'main' 或 'master'，需要加上 'origin/' 前缀
      const baseRef = process.env.GITHUB_BASE_REF || 'main';
      const baseBranch = baseRef.startsWith('origin/') ? baseRef : `origin/${baseRef}`;
      console.log(chalk.blue(`📝 ${t('cli.analyzing')}`));
      console.log(chalk.gray(`   ${t('github.comparingBranch')} ${baseBranch}`));
      const diff = await getDiff(baseBranch, workDir);

      if (!diff || diff.length === 0) {
        console.log(chalk.yellow(`⚠️  ${t('cli.noChanges')}`));
        process.exit(0);
      }

      console.log(chalk.green(`✓ ${t('cli.foundFiles', { count: diff.length })}\n`));

      // 进行代码审查
      console.log(chalk.blue(`🤖 ${t('cli.runningReview')}`));
      const additionalRuleFiles = options?.rules || [];
      if (additionalRuleFiles.length > 0) {
        console.log(chalk.gray(`   ${t('cli.loadingRules', { count: additionalRuleFiles.length })}`));
      }

      const maxRetries = options?.maxRetries !== undefined ? parseInt(options.maxRetries, 10) : 10;
      const validMaxRetries = (isNaN(maxRetries) || maxRetries < 0) ? 10 : maxRetries;

      const reviewResult = await reviewCode(diff, additionalRuleFiles, validMaxRetries);

      // 统计评论数量
      const errorCount = reviewResult.comments.filter(c => c.severity === 'error').length;
      const warningCount = reviewResult.comments.filter(c => c.severity === 'warning').length;
      const infoCount = reviewResult.comments.filter(c => c.severity === 'info').length;

      console.log(chalk.green(`✓ ${t('cli.reviewCompleted')}\n`));
      console.log(chalk.gray(`   ${t('cli.statistics')}`));
      console.log(chalk.gray(`   - ${t('cli.totalComments', { count: reviewResult.comments.length })}`));
      if (errorCount > 0) {
        console.log(chalk.red(`   - ${t('cli.errors', { count: errorCount })}`));
      }
      if (warningCount > 0) {
        console.log(chalk.yellow(`   - ${t('cli.warnings', { count: warningCount })}`));
      }
      if (infoCount > 0) {
        console.log(chalk.blue(`   - ${t('cli.info', { count: infoCount })}`));
      }
      console.log('');

      // 保存 JSON 文件（如果指定了输出目录）
      if (options.output) {
        const outputDir = path.resolve(workDir, options.output);
        if (!existsSync(outputDir)) {
          await mkdir(outputDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const commentsPath = await saveCommentsToFile(reviewResult.comments, outputDir, timestamp);
        const diffPath = await saveDiffToFile(diff, outputDir, timestamp);

        console.log(chalk.green(`✓ ${t('cli.resultsSaved')}`));
        console.log(chalk.gray(`   ${t('cli.comments')} ${commentsPath}`));
        console.log(chalk.gray(`   ${t('cli.diff')} ${diffPath}\n`));
      }

      // 转换为 GitHub PR Review 格式
      console.log(chalk.blue(`📤 ${t('github.preparingReview')}`));
      const githubComments = convertToGitHubComments(reviewResult.comments, diff);
      const reviewBody = generatePRReviewBody(
        reviewResult.comments,
        reviewResult.summary,
        reviewResult.startTime,
        reviewResult.endTime,
        reviewResult.duration
      );

      // 确定 review event
      let finalReviewEvent: 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES' = reviewEvent;
      if (reviewEvent === 'COMMENT') {
        // 如果有错误，自动设置为 REQUEST_CHANGES
        if (errorCount > 0) {
          finalReviewEvent = 'REQUEST_CHANGES';
          console.log(chalk.yellow(`⚠️  ${t('github.foundErrors', { count: errorCount })}`));
        }
      }

      // 创建 GitHub PR Review
      console.log(chalk.blue(`🚀 ${t('github.creatingReview', { event: finalReviewEvent })}`));
      await createGitHubPRReview(
        githubOwner,
        githubRepo,
        prNumber,
        {
          event: finalReviewEvent,
          body: reviewBody,
          comments: githubComments,
        },
        githubToken
      );

      console.log(chalk.green(`✓ ${t('github.reviewCreated')}\n`));
      console.log(chalk.cyan(`🔗 ${t('github.viewPR')} https://github.com/${githubOwner}/${githubRepo}/pull/${prNumber}\n`));

    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse();

