#!/usr/bin/env node

import { chmod, cp, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const cliPath = join(__dirname, '../dist/cli.js');
const rulesSrcDir = join(__dirname, '../src/review/rules');
const rulesDestDir = join(__dirname, '../dist/review/rules');
const uiSrcDir = join(__dirname, '../ui');
const uiDistSrcDir = join(__dirname, '../ui/dist');
const uiDistDestDir = join(__dirname, '../dist/ui/dist');

try {
  // 确保 CLI 文件可执行
  await chmod(cliPath, 0o755);
  console.log('✓ CLI file is now executable');
  
  // 复制规则文件到构建输出目录
  if (existsSync(rulesSrcDir)) {
    if (!existsSync(rulesDestDir)) {
      await mkdir(rulesDestDir, { recursive: true });
    }
    
    const { readdir } = await import('fs/promises');
    const files = await readdir(rulesSrcDir);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        await cp(
          join(rulesSrcDir, file),
          join(rulesDestDir, file)
        );
      }
    }
    
    console.log('✓ Rule files copied to dist');
  }

  // 构建 UI（如果还没有构建）
  if (existsSync(uiSrcDir)) {
    console.log('Building UI...');
    try {
      execSync('pnpm run build:ui', { 
        cwd: join(__dirname, '..'),
        stdio: 'inherit'
      });
      console.log('✓ UI built successfully');
    } catch (error) {
      console.warn('Warning: Failed to build UI:', error instanceof Error ? error.message : String(error));
    }
  }

  // 复制 UI 构建产物到 dist 目录
  if (existsSync(uiDistSrcDir)) {
    if (!existsSync(uiDistDestDir)) {
      await mkdir(uiDistDestDir, { recursive: true });
    }
    
    // 使用 cp -r 复制整个目录
    const isWindows = process.platform === 'win32';
    
    if (isWindows) {
      execSync(`xcopy /E /I /Y "${uiDistSrcDir}" "${uiDistDestDir}"`, { stdio: 'inherit' });
    } else {
      execSync(`cp -r "${uiDistSrcDir}/." "${uiDistDestDir}/"`, { stdio: 'inherit' });
    }
    
    console.log('✓ UI dist files copied to dist/ui/dist');
  }
} catch (error) {
  console.warn('Warning:', error instanceof Error ? error.message : String(error));
}

