#!/usr/bin/env node

import { Command } from 'commander';
import { getBranches, selectBranch } from './git/branchSelector.js';
import { getDiff } from './git/diff.js';
import { reviewCode } from './review/agent.js';
import { startServer } from './server/index.js';
import { saveReviewResult, saveCommentsToFile, saveDiffToFile } from './utils/storage.js';
import { setLanguage, t, formatDate, formatDuration, type Language } from './utils/i18n.js';
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
  .name('code-review')
  .description('AI-powered code review tool using DeepSeek')
  .version('1.0.0')
  .argument('[baseBranch]', 'Base branch to compare against (default: master)')
  .option('-r, --rules <files...>', 'Additional rule JSON files to load')
  .option('-p, --pwd <directory>', 'Working directory (default: current directory)', process.cwd())
  .option('--env <file>', 'Path to .env file (default: .env)', '.env')
  .option('--no-server', 'Do not start review report server, save results to JSON files instead')
  .option('-o, --output <directory>', 'Output directory for JSON files (comments and diff). If --no-server is used without this option, defaults to .code-review in current directory')
  .option('--max-retries <number>', 'Maximum number of continuation attempts for incomplete JSON responses (default: 10)', '10')
  .option('--lang <language>', 'Language: en or zh-CN (default: en)', 'en')
  .action(async (baseBranch?: string) => {
    const options = program.opts<{ 
      rules?: string[]; 
      pwd?: string; 
      env?: string;
      server?: boolean; // commander.js 会自动处理 --no-server，将其设置为 false
      output?: string;
      maxRetries?: number;
      lang?: string;
    }>();
    
    // Set language
    const lang = (options.lang === 'zh-CN' ? 'zh-CN' : 'en') as Language;
    setLanguage(lang);
    try {
      // 加载 .env 文件
      const workDir = path.resolve(options.pwd || process.cwd());
      
      // 首先尝试从项目根目录（code-review-tool）加载 .env
      const projectRoot = path.resolve(__dirname, '..');
      const projectEnvPath = path.resolve(projectRoot, '.env');
      
      // 然后尝试从工作目录加载
      const workEnvPath = path.resolve(workDir, options.env || '.env');
      
      let envLoaded = false;
      
      // 优先从项目根目录加载
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
      
      // 如果工作目录的 .env 文件存在且与项目根目录不同，也加载它（会覆盖项目根目录的值）
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
      } else if (!envLoaded && options.env && options.env !== '.env') {
        // 如果用户明确指定了 --env 但文件不存在，给出警告
        console.warn(chalk.yellow(`⚠️  Warning: Environment file not found: ${workEnvPath}`));
      } else if (!envLoaded) {
        // 如果都没有找到，给出提示
        console.log(chalk.gray(`📄 No .env file found in project root (${projectRoot}) or work directory (${workDir})`));
      }
      
      // 验证并解析工作目录
      if (!existsSync(workDir)) {
        console.error(chalk.red(`❌ Error: Directory does not exist: ${workDir}`));
        process.exit(1);
      }

      console.log(chalk.blue('🔍 Starting code review...\n'));
      if (workDir !== process.cwd()) {
        console.log(chalk.gray(`📁 Working directory: ${workDir}\n`));
      }

      // 如果没有提供分支，让用户选择
      let targetBranch = baseBranch || '';
      if (!baseBranch) {
        const branches = await getBranches(workDir);
        const selected = await selectBranch(branches);
        if (selected) {
          targetBranch = selected;
        }
      }

      console.log(chalk.gray(`${t('cli.comparing')} ${targetBranch}\n`));

      // 获取 Git diff
      console.log(chalk.blue(`📝 ${t('cli.analyzing')}`));
      const diff = await getDiff(targetBranch, workDir);
      
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
      
      const maxRetries = options?.maxRetries !== undefined ? options.maxRetries : 10;
      if (isNaN(maxRetries) || maxRetries < 0) {
        console.warn(chalk.yellow(`⚠️  ${t('cli.invalidMaxRetries')}`));
      }
      const validMaxRetries = (isNaN(maxRetries) || maxRetries < 0) ? 10 : maxRetries;
      
      let reviewResult;
      let reviewSuccess = false;
      try {
        reviewResult = await reviewCode(diff, additionalRuleFiles, validMaxRetries);
        reviewSuccess = true;
      } catch (error) {
        console.error(chalk.red(`❌ ${t('cli.reviewFailed')}`), error instanceof Error ? error.message : String(error));
        // 即使失败，也尝试保存部分结果（如果有的话）
        if (error && typeof error === 'object' && 'partialResult' in error) {
          reviewResult = (error as { partialResult: typeof reviewResult }).partialResult;
        }
        throw error; // 重新抛出错误，让外层 catch 处理
      }
      
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

      const shouldStartServer = options.server !== false && reviewSuccess;
      const shouldOutputJson = options.output !== undefined || !shouldStartServer;
      
      // 如果需要输出 JSON 文件
      if (shouldOutputJson) {
        // 确定输出目录
        const outputDir = options.output 
          ? path.resolve(workDir, options.output)
          : path.resolve(workDir, '.code-review');
        
        // 确保输出目录存在
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
      
      // 如果需要启动服务器
      if (shouldStartServer) {
        // 启动服务器模式：保存完整结果并启动服务器
      const resultPath = await saveReviewResult({
        baseBranch: targetBranch,
        diff,
        review: reviewResult,
        timestamp: new Date().toISOString(),
      });

        console.log(chalk.green(`✓ Review result saved to:`));
        console.log(chalk.gray(`   ${resultPath}\n`));

      // 启动服务器
        console.log(chalk.blue(`🚀 ${t('cli.startingServer')}`));
      const port = await startServer(resultPath);
      const url = `http://localhost:${port}`;
      
        console.log(chalk.green(`✓ ${t('cli.serverStarted')}\n`));
        console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        console.log(chalk.cyan.bold(`📖 Review Report: ${url}`));
        console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
      }

    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : String(error));
      // 失败时不启动服务器
      console.log(chalk.gray(`\n⚠️  ${t('cli.reviewFailedNoServer')}`));
      process.exit(1);
    }
  });

program.parse();

