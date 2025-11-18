import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { readFile } from 'fs/promises';
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ReviewData } from '../utils/storage.js';
import open from 'open';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let reviewData: ReviewData | null = null;
let uiProcess: ReturnType<typeof spawn> | null = null;

/**
 * 检查是否有构建后的 UI
 */
function hasBuiltUI(): boolean {
  // 优先检查打包后的位置（dist/ui/dist），如果没有则检查开发位置（../../ui/dist）
  const builtUIDir = join(__dirname, '../ui/dist');
  const devUIDir = join(__dirname, '../../ui/dist');
  return existsSync(builtUIDir) || existsSync(devUIDir);
}

/**
 * 启动前端 UI 开发服务器（仅在开发模式下调用）
 */
function startUIServer(app: Express, uiPort: number): Promise<void> {
  return new Promise((resolve, reject) => {
    // 开发模式：启动 Vite 开发服务器
  const uiDir = join(__dirname, '../../ui');
  const isWindows = process.platform === 'win32';
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';

  uiProcess = spawn(npmCmd, ['run', 'dev'], {
    cwd: uiDir,
      stdio: 'ignore', // 不显示日志
    shell: false,
  });

  uiProcess.on('error', (error) => {
      reject(new Error(`Failed to start UI server: ${error.message}`));
    });

    // 等待服务器启动（通过检查端口或等待一段时间）
    setTimeout(() => {
      resolve();
    }, 2000);
  });
}

/**
 * 启动审查结果服务器
 */
export async function startServer(dataPath: string): Promise<number> {
  // 加载审查数据
  const data = await readFile(dataPath, 'utf-8');
  reviewData = JSON.parse(data) as ReviewData;

  const app: Express = express();
  const apiPort = 3001;
  const uiPort = 3000;

  app.use(cors());
  app.use(express.json());

  // 检查是否有构建后的 UI
  const uiDir = (() => {
    const builtUIDir = join(__dirname, '../ui/dist');
    const devUIDir = join(__dirname, '../../ui/dist');
    return existsSync(builtUIDir) ? builtUIDir : (existsSync(devUIDir) ? devUIDir : null);
  })();

  // 提供审查数据 API（必须在静态文件之前注册，确保 API 路由优先匹配）
  app.get('/api/review', (req: Request, res: Response) => {
    // 支持通过查询参数指定文件路径
    const filePath = req.query.file as string | undefined;
    
    if (filePath) {
      // 解码文件路径
      const decodedPath = decodeURIComponent(filePath);
      console.log('Loading review file:', decodedPath);
      
      // 如果指定了文件路径，从文件系统读取
      readFile(decodedPath, 'utf-8')
        .then((data) => {
          const parsedData: ReviewData = JSON.parse(data);
          
          // 验证数据完整性
          const review = parsedData.review as { comments?: unknown[] };
          const diff = parsedData.diff as unknown[] | undefined;
          
          if (!review || !Array.isArray(review.comments)) {
            console.warn('Invalid review data format in file:', decodedPath);
            return res.status(500).json({ error: 'Invalid review data format' });
          }
          
          console.log('Review data loaded from file:', {
            commentsCount: review.comments.length,
            filesCount: diff?.length || 0,
          });
          
          res.json(parsedData);
        })
        .catch((error) => {
          console.error('Failed to load review file:', error);
          res.status(404).json({ error: `Failed to load review file: ${error.message}` });
        });
    } else if (!reviewData) {
      return res.status(404).json({ error: 'Review data not found' });
    } else {
      res.json(reviewData);
    }
  });

  // 健康检查
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // 如果使用构建后的 UI，注册静态文件和 SPA 路由
  if (uiDir) {
    // 静态文件服务（在 API 路由之后，但 Express 会优先匹配已注册的路由）
    app.use(express.static(uiDir));
    
    // SPA 路由：所有非 API 请求都返回 index.html（必须在最后注册）
    app.get('*', (req: Request, res: Response) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(join(uiDir, 'index.html'));
      }
    });
  }

  return new Promise(async (resolve, reject) => {
    try {
      // 如果使用构建后的 UI，静态文件已经注册，不需要启动开发服务器
      if (!uiDir) {
        // 开发模式：启动 Vite 开发服务器
        await startUIServer(app, uiPort);
      }
    } catch (error) {
      reject(error);
      return;
    }

    // 启动 API 服务器（如果使用构建后的 UI，API 和 UI 在同一个端口）
    const serverPort = hasBuiltUI() ? uiPort : apiPort;
    const server = app.listen(serverPort, async () => {
      try {
        // 等待服务器启动后打开浏览器
      setTimeout(() => {
          // 将文件路径编码到 URL 中
          const encodedPath = encodeURIComponent(dataPath);
          open(`http://localhost:${uiPort}?file=${encodedPath}`).catch(() => {
          // 忽略打开浏览器的错误
        });
        }, 500);
      
      resolve(uiPort);
      } catch (error) {
        reject(error);
      }
    });

    // 优雅关闭
    const cleanup = (): void => {
      if (uiProcess) {
        uiProcess.kill();
      }
      server.close(() => {
        process.exit(0);
      });
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  });
}

