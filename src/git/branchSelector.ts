import simpleGit, { SimpleGit } from 'simple-git';
import inquirer from 'inquirer';
// @ts-expect-error - inquirer-search-list doesn't have type definitions
import SearchList from 'inquirer-search-list';

export interface BranchInfo {
  name: string;
  isRemote: boolean;
  isCurrent: boolean;
}

/**
 * 获取所有远程分支列表
 */
export async function getBranches(cwd?: string): Promise<BranchInfo[]> {
  const git: SimpleGit = cwd ? simpleGit({ baseDir: cwd }) : simpleGit();
  
  try {
    // 检查是否是 Git 仓库
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      throw new Error(cwd ? `Not a git repository: ${cwd}` : 'Not a Git repository. Please run this command in a Git repository.');
    }
    
    // 获取当前分支
    let currentBranch: string;
    try {
      currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
    } catch (error) {
      // 如果获取当前分支失败（可能是空仓库），使用 'HEAD' 作为默认值
      currentBranch = 'HEAD';
    }
    
    // 获取远程分支
    const remoteBranches = await git.branch(['-r']);
    const branches: BranchInfo[] = [];
    
    // 解析远程分支
    for (const branch of remoteBranches.all) {
      if (branch.includes('HEAD')) continue;
      
      const branchName = branch.replace(/^origin\//, '');
      branches.push({
        name: branchName,
        isRemote: true,
        isCurrent: branchName === currentBranch,
      });
    }
    
    // 如果没有远程分支，尝试获取本地分支
    if (branches.length === 0) {
      const localBranches = await git.branchLocal();
      for (const branch of localBranches.all) {
        branches.push({
          name: branch,
          isRemote: false,
          isCurrent: branch === currentBranch,
        });
      }
    }
    
    // 确保 master 分支存在
    const hasMaster = branches.some(b => b.name === 'master');
    if (!hasMaster) {
      const hasMain = branches.some(b => b.name === 'main');
      if (hasMain) {
        // 如果只有 main，添加它
        branches.unshift({
          name: 'main',
          isRemote: true,
          isCurrent: false,
        });
      }
    }
    
    return branches.sort((a, b) => {
      // 当前分支排在最前面
      if (a.isCurrent) return -1;
      if (b.isCurrent) return 1;
      // master/main 排在前面
      if (a.name === 'master' || a.name === 'main') return -1;
      if (b.name === 'master' || b.name === 'main') return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    throw new Error(`Failed to get branches: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 让用户选择分支（支持搜索）
 */
export async function selectBranch(branches: BranchInfo[]): Promise<string | null> {
  if (branches.length === 0) {
    throw new Error('No branches found');
  }

  // 注册 search-list prompt
  inquirer.registerPrompt('search-list', SearchList);

  // 如果有 master 分支，默认选择它
  const defaultBranch = branches.find(b => b.name === 'master' || b.name === 'main')?.name || branches[0].name;

  const { branch } = await inquirer.prompt<{ branch: string }>([
    {
      type: 'search-list',
      name: 'branch',
      message: 'Select base branch to compare:',
      default: defaultBranch,
      choices: branches.map(b => ({
        name: `${b.name}${b.isCurrent ? ' (current)' : ''}${b.isRemote ? ' [remote]' : ''}`,
        value: b.name,
      })),
      pageSize: 20,
    },
  ]);

  return branch || null;
}

