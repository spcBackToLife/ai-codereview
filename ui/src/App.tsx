import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './App.css';
import ReviewView from './components/ReviewView';
import Loading from './components/Loading';
import ErrorMessage from './components/ErrorMessage';

// 主题管理
function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return { theme, toggleTheme };
}

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

export interface ReviewComment {
  filePath: string;
  line: number;
  endLine: number;  // 必需：单行评论时等于 line，多行评论时是结束行号
  severity: 'error' | 'warning' | 'info';
  message: string;
  ruleId: string;        // 规则ID（必需）
  ruleName: string;      // 规则名称（必需）
  ruleLevel: string;     // 规则级别（必需）：强卡控/建议/优化
  ruleDesc: string;      // 规则描述（必需）
  suggestion?: string;
  tags?: string[];
}

export interface ReviewResult {
  comments: ReviewComment[];
  summary: string;
  startTime?: string;  // ISO 8601 格式的开始时间
  endTime?: string;    // ISO 8601 格式的结束时间
  duration?: number;   // 耗时（毫秒）
}

export interface ReviewData {
  baseBranch: string;
  diff: FileDiff[];
  review: ReviewResult;
  timestamp: string;
}

// localStorage 工具函数
const STORAGE_KEY = 'code-review-data';
const MAX_STORED_REVIEWS = 10;

interface StoredReview {
  filePath: string;
  timestamp: string;
  data: ReviewData;
}

function saveReviewToLocalStorage(data: ReviewData): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    let reviews: StoredReview[] = stored ? JSON.parse(stored) : [];
    
    // 使用 timestamp 作为唯一标识
    const reviewId = data.timestamp;
    
    // 移除已存在的相同 timestamp 的记录
    reviews = reviews.filter(r => r.timestamp !== reviewId);
    
    // 添加新记录到开头
    reviews.unshift({
      filePath: '', // 不再使用 filePath 作为标识
      timestamp: reviewId,
      data,
    });
    
    // 只保留最新的 MAX_STORED_REVIEWS 条
    if (reviews.length > MAX_STORED_REVIEWS) {
      reviews = reviews.slice(0, MAX_STORED_REVIEWS);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
    console.log(`Saved review to localStorage (${reviews.length}/${MAX_STORED_REVIEWS} reviews stored)`);
  } catch (error) {
    console.warn('Failed to save review to localStorage:', error);
  }
}

function loadReviewFromLocalStorage(): ReviewData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    const reviews: StoredReview[] = JSON.parse(stored);
    
    // 返回最新的记录
    if (reviews.length > 0) {
      console.log(`Loaded review from localStorage (${reviews.length} reviews available)`);
      return reviews[0].data;
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to load review from localStorage:', error);
    return null;
  }
}

const App: React.FC = () => {
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReviewData = async (): Promise<void> => {
      try {
        // 首先尝试从 localStorage 加载最新的数据
        const cachedData = loadReviewFromLocalStorage();
        if (cachedData) {
          console.log('Loaded review data from localStorage');
          // 确保所有评论都有必需的字段（兼容旧数据）
          const normalizedData = {
            ...cachedData,
            review: {
              ...cachedData.review,
              comments: cachedData.review.comments.map((comment: any) => ({
                ...comment,
                endLine: comment.endLine !== undefined ? comment.endLine : comment.line,
                ruleId: comment.ruleId || 'unknown',
                ruleName: comment.ruleName || '未知规则',
                ruleLevel: comment.ruleLevel || '建议',
                ruleDesc: comment.ruleDesc || '规则信息缺失',
              })),
            },
          };
          setReviewData(normalizedData);
          setLoading(false);
          
          // 后台尝试从 API 更新数据（如果服务器还在运行）
          try {
            // 从 URL 参数获取文件路径（如果有）
            const urlParams = new URLSearchParams(window.location.search);
            const filePath = urlParams.get('file');
            const apiUrl = filePath ? `/api/review?file=${encodeURIComponent(filePath)}` : '/api/review';
            
            const response = await axios.get<ReviewData>(apiUrl);
            const data = response.data;
            
            // 验证数据完整性
            if (data && data.review && Array.isArray(data.review.comments)) {
              // 确保所有评论都有必需的字段
              const normalizedData = {
                ...data,
                review: {
                  ...data.review,
                  comments: data.review.comments.map((comment: any) => ({
                    ...comment,
                    endLine: comment.endLine !== undefined ? comment.endLine : comment.line,
                    ruleId: comment.ruleId || 'unknown',
                    ruleName: comment.ruleName || '未知规则',
                    ruleLevel: comment.ruleLevel || '建议',
                    ruleDesc: comment.ruleDesc || '规则信息缺失',
                  })),
                },
              };
              // 如果 API 返回成功，更新缓存
              saveReviewToLocalStorage(normalizedData);
              setReviewData(normalizedData);
              console.log('Updated review data from API');
            }
          } catch (apiError) {
            // API 失败不影响，使用缓存数据
            console.log('API not available, using cached data');
          }
          return;
        }
        
        // 如果 localStorage 没有，从 API 加载
        const urlParams = new URLSearchParams(window.location.search);
        const filePath = urlParams.get('file');
        const apiUrl = filePath ? `/api/review?file=${encodeURIComponent(filePath)}` : '/api/review';
        console.log('Fetching review data from API:', apiUrl);
        const response = await axios.get<ReviewData>(apiUrl);
        const data = response.data;
        
        // 验证数据完整性
        if (!data || !data.review || !Array.isArray(data.review.comments)) {
          throw new Error('Invalid review data format');
        }
        
        // 确保所有评论都有必需的字段
        const normalizedData = {
          ...data,
          review: {
            ...data.review,
            comments: data.review.comments.map((comment: any) => ({
              ...comment,
              endLine: comment.endLine !== undefined ? comment.endLine : comment.line,
              ruleId: comment.ruleId || 'unknown',
              ruleName: comment.ruleName || '未知规则',
              ruleLevel: comment.ruleLevel || '建议',
              ruleDesc: comment.ruleDesc || '规则信息缺失',
            })),
          },
        };
        
        console.log('Review data loaded:', {
          commentsCount: normalizedData.review.comments.length,
          filesCount: normalizedData.diff.length,
        });
        
        // 保存到 localStorage（使用 timestamp 作为唯一标识）
        saveReviewToLocalStorage(normalizedData);
        
        setReviewData(normalizedData);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load review data:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load review data';
        setError(errorMessage);
        setLoading(false);
      }
    };

    fetchReviewData();
  }, []);

  const { theme, toggleTheme } = useTheme();

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  if (!reviewData) {
    return <div className="app">No review data available</div>;
  }

  return (
    <div className="app">
      <ReviewView data={reviewData} onThemeToggle={toggleTheme} theme={theme} />
    </div>
  );
};

export default App;

