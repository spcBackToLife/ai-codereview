import React, { useState, useMemo, useEffect } from 'react';
import { ReviewData } from '../App';
import FileDiffView from './FileDiffView';
import FileTree from './FileTree';
import StatisticsDrawer from './StatisticsDrawer';
import './ReviewView.css';

interface ReviewViewProps {
  data: ReviewData;
  onThemeToggle?: () => void;
  theme?: 'dark' | 'light';
}

/**
 * 格式化耗时（毫秒转可读格式）
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

const ReviewView: React.FC<ReviewViewProps> = ({ data, onThemeToggle, theme }) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(
    data.diff.length > 0 ? data.diff[0].filePath : null
  );
  const [highlightedLine, setHighlightedLine] = useState<number | undefined>();
  const [isStatisticsOpen, setIsStatisticsOpen] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<'error' | 'warning' | 'info' | null>(null);
  const [commentFileFilter, setCommentFileFilter] = useState<string>('all');

  // 当左侧选择文件时，同步更新右侧的文件筛选器
  useEffect(() => {
    if (selectedFile) {
      // 如果当前筛选器是 'all' 或者没有严重程度筛选，则自动切换到当前文件
      // 这样可以确保左侧选择文件时，右侧自动显示该文件的评论
      setCommentFileFilter(selectedFile);
    }
  }, [selectedFile]);

  const selectedFileDiff = data.diff.find((f) => f.filePath === selectedFile);
  
  // 根据筛选条件获取评论列表
  const displayedComments = useMemo(() => {
    let comments = data.review.comments;
    
    // 如果设置了严重程度筛选
    if (severityFilter) {
      comments = comments.filter((c) => c.severity === severityFilter);
      // 设置了严重程度筛选时，根据文件筛选器决定显示范围
      if (commentFileFilter !== 'all') {
        comments = comments.filter((c) => c.filePath === commentFileFilter);
      }
      // 如果文件筛选是 'all'，显示所有符合严重程度的评论（不限制文件）
    } else {
      // 没有设置严重程度筛选时，根据文件筛选器决定显示范围
      if (commentFileFilter !== 'all') {
        comments = comments.filter((c) => c.filePath === commentFileFilter);
      } else {
        // 如果文件筛选也是 'all'，显示当前选中文件的评论
        if (selectedFile) {
          comments = comments.filter((c) => c.filePath === selectedFile);
        }
      }
    }
    
    return comments.sort((a, b) => {
      // 按照严重程度排序：error > warning > info
      const severityOrder = { error: 0, warning: 1, info: 2 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) {
        return severityDiff;
      }
      // 相同严重程度，按行号排序
      return a.line - b.line;
    });
  }, [data.review.comments, severityFilter, commentFileFilter, selectedFile]);

  // 获取所有有评论的文件列表（用于下拉框）
  const filesWithComments = useMemo(() => {
    const fileSet = new Set<string>();
    let comments = data.review.comments;
    
    if (severityFilter) {
      comments = comments.filter((c) => c.severity === severityFilter);
    }
    
    comments.forEach((c) => fileSet.add(c.filePath));
    return Array.from(fileSet).sort();
  }, [data.review.comments, severityFilter]);
  
  const fileComments = data.review.comments
    .filter((c) => c.filePath === selectedFile)
    .sort((a, b) => {
      // 按照严重程度排序：error > warning > info
      const severityOrder = { error: 0, warning: 1, info: 2 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) {
        return severityDiff;
      }
      // 相同严重程度，按行号排序
      return a.line - b.line;
    });

  const handleCommentClick = (comment: typeof data.review.comments[0]) => {
    // 切换到对应文件
    if (comment.filePath !== selectedFile) {
      setSelectedFile(comment.filePath);
    }
    // 高亮对应行（使用 endLine）
    const targetLine = comment.endLine;
    setHighlightedLine(targetLine);
    // 3秒后取消高亮
    setTimeout(() => setHighlightedLine(undefined), 3000);
  };

  const handleSeverityFilter = (severity: 'error' | 'warning' | 'info' | null) => {
    setSeverityFilter(severity);
    setCommentFileFilter('all');
    setIsStatisticsOpen(false);
  };

  const handleStatCardClick = (severity: 'error' | 'warning' | 'info') => {
    setSeverityFilter(severity);
    setCommentFileFilter('all');
  };

  const stats = {
    totalComments: data.review.comments.length,
    errors: data.review.comments.filter((c) => c.severity === 'error').length,
    warnings: data.review.comments.filter((c) => c.severity === 'warning').length,
    info: data.review.comments.filter((c) => c.severity === 'info').length,
    filesChanged: data.diff.length,
  };

  return (
    <div className="review-view">
      {/* 顶部统计栏 */}
      <header className="review-header">
        <div className="review-header-content">
          <div className="review-header-left">
            <h1 className="review-title">Code Review</h1>
        <div className="review-meta">
              <span className="meta-item">
                <span className="meta-label">Branch:</span>
                <span className="meta-value">{data.baseBranch}</span>
              </span>
              <span className="meta-divider">•</span>
              <span className="meta-item">
                <span className="meta-label">Time:</span>
                <span className="meta-value">{new Date(data.timestamp).toLocaleString()}</span>
              </span>
              {data.review.startTime && data.review.endTime && (
                <>
                  <span className="meta-divider">•</span>
                  <span className="meta-item">
                    <span className="meta-label">Duration:</span>
                    <span className="meta-value">
                      {data.review.duration 
                        ? formatDuration(data.review.duration)
                        : 'N/A'}
                    </span>
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="review-header-right">
            <button 
              className="statistics-button"
              onClick={() => setIsStatisticsOpen(true)}
            >
              📊 统计
            </button>
            {onThemeToggle && (
              <button className="theme-toggle" onClick={onThemeToggle}>
                {theme === 'dark' ? '☀️' : '🌙'} {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
            )}
            <div className="review-stats">
              <div 
                className="stat-card stat-card-error"
                onClick={() => handleStatCardClick('error')}
                style={{ cursor: 'pointer' }}
              >
                <div className="stat-value">{stats.errors}</div>
                <div className="stat-label">Errors</div>
              </div>
              <div 
                className="stat-card stat-card-warning"
                onClick={() => handleStatCardClick('warning')}
                style={{ cursor: 'pointer' }}
              >
                <div className="stat-value">{stats.warnings}</div>
                <div className="stat-label">Warnings</div>
              </div>
              <div 
                className="stat-card stat-card-info"
                onClick={() => handleStatCardClick('info')}
                style={{ cursor: 'pointer' }}
              >
                <div className="stat-value">{stats.info}</div>
                <div className="stat-label">Info</div>
              </div>
              <div className="stat-card stat-card-total">
                <div className="stat-value">{stats.totalComments}</div>
                <div className="stat-label">Total</div>
              </div>
              <div className="stat-card stat-card-files">
                <div className="stat-value">{stats.filesChanged}</div>
                <div className="stat-label">Files</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="review-content">
        {/* 左侧：文件树 */}
        <aside className="review-sidebar-left">
          <FileTree
            files={data.diff}
            comments={data.review.comments}
            selectedFile={selectedFile}
            onFileSelect={setSelectedFile}
          />
        </aside>

        {/* 中间：代码区域 */}
        <main className="review-main">
          {selectedFileDiff ? (
            <FileDiffView
              fileDiff={selectedFileDiff}
              comments={fileComments}
              highlightedLine={highlightedLine}
            />
          ) : (
            <div className="no-file-selected">
              Select a file to view changes
            </div>
          )}
        </main>

        {/* 右侧：评论列表 */}
        <aside className="review-sidebar-right">
          <div className="comment-list">
            <div className="comment-list-header">
              <h3>Comments</h3>
              <span className="comment-count-badge">{displayedComments.length}</span>
            </div>
            <div className="comment-list-filters">
              {severityFilter && (
                <div className="filter-badge">
                  {severityFilter === 'error' ? '错误' : severityFilter === 'warning' ? '警告' : '建议'}
                  <button 
                    className="filter-remove"
                    onClick={() => {
                      setSeverityFilter(null);
                      if (selectedFile) {
                        setCommentFileFilter(selectedFile);
                      } else {
                        setCommentFileFilter('all');
                      }
                    }}
                  >×</button>
                </div>
              )}
              {filesWithComments.length > 0 && (
                <select
                  className="comment-file-filter"
                  value={commentFileFilter}
                  onChange={(e) => setCommentFileFilter(e.target.value)}
                >
                  <option value="all">全部文件</option>
                  {filesWithComments.map((filePath) => (
                    <option key={filePath} value={filePath}>
                      {filePath.split('/').pop()}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="comment-list-content">
              {displayedComments.length === 0 ? (
                <div className="comment-list-empty">
                  <div className="empty-icon">💬</div>
                  <div className="empty-text">
                    {severityFilter || commentFileFilter !== 'all' 
                      ? '没有符合条件的评论' 
                      : 'No comments for this file'}
                  </div>
                </div>
              ) : (
                displayedComments.map((comment, idx) => {
                  const commentFileName = comment.filePath.split('/').pop() || comment.filePath;
                  const severityConfig = {
                    error: { icon: '●', color: 'var(--error-color)', bg: 'var(--error-bg)' },
                    warning: { icon: '●', color: 'var(--warning-color)', bg: 'var(--warning-bg)' },
                    info: { icon: '●', color: 'var(--info-color)', bg: 'var(--info-bg)' },
                  }[comment.severity];

                  const tagLabels: Record<string, string> = {
                    typescript: 'TS',
                    react: 'React',
                    'code-design': '设计',
                  };

                  const lineRange = comment.endLine !== comment.line
                    ? `${comment.line}-${comment.endLine}`
                    : `${comment.line}`;

                  return (
                    <div
                      key={idx}
                      className={`comment-item comment-severity-${comment.severity}`}
                      onClick={() => handleCommentClick(comment)}
                    >
                      <div className="comment-item-inner">
                        <div className="comment-header">
                          <div className="comment-header-left">
                            <div className="comment-severity-badge" style={{ 
                              color: severityConfig.color,
                              background: severityConfig.bg 
                            }}>
                              <span className="severity-icon">{severityConfig.icon}</span>
                              <span className="severity-text">{comment.severity.toUpperCase()}</span>
                            </div>
                            {comment.ruleId && (
                              <span className="comment-rule-id" title={`${comment.ruleName} (${comment.ruleLevel})`}>
                                {comment.ruleId}
                              </span>
                            )}
                            <span className="comment-line-badge">Line {lineRange}</span>
                          </div>
                          {(severityFilter || commentFileFilter !== 'all') && (
                            <div className="comment-file-name" title={comment.filePath}>
                              📄 {commentFileName}
                            </div>
                          )}
                        </div>
                        
                        {comment.ruleName && (
                          <div className="comment-rule-info">
                            <span className="comment-rule-name">{comment.ruleName}</span>
                            <span className="comment-rule-level">{comment.ruleLevel}</span>
                          </div>
                        )}
                        
                        {comment.ruleDesc && (
                          <div className="comment-rule-desc">{comment.ruleDesc}</div>
                        )}
                        
                        <div className="comment-message">{comment.message}</div>
                        
                        {comment.suggestion && (
                          <div className="comment-suggestion">
                            <strong>建议：</strong>{comment.suggestion}
                          </div>
                        )}
                        
                        {comment.tags && comment.tags.length > 0 && (
                          <div className="comment-tags">
                            {comment.tags.map((tag, tagIdx) => (
                              <span key={tagIdx} className="comment-tag">
                                {tagLabels[tag] || tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>
      </div>
      
      {/* 统计抽屉 */}
      <StatisticsDrawer
        data={data}
        isOpen={isStatisticsOpen}
        onClose={() => setIsStatisticsOpen(false)}
        onCommentClick={handleCommentClick}
        onSeverityFilter={handleSeverityFilter}
      />
    </div>
  );
};

export default ReviewView;

