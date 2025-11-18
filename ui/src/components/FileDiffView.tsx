import React, { useRef, useEffect } from 'react';
import { FileDiff, ReviewComment } from '../App';
import CommentMarker from './CommentMarker';
import './FileDiffView.css';

interface FileDiffViewProps {
  fileDiff: FileDiff;
  comments: ReviewComment[];
  highlightedLine?: number;
}

const FileDiffView: React.FC<FileDiffViewProps> = ({ 
  fileDiff, 
  comments, 
  highlightedLine 
}) => {
  const lineRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());

  // 计算文件的最大行号
  const maxLineNumber = React.useMemo(() => {
    let max = 0;
    fileDiff.hunks.forEach(hunk => {
      hunk.lines.forEach(line => {
        if (line.newLineNumber && line.newLineNumber > max) {
          max = line.newLineNumber;
        }
        if (line.oldLineNumber && line.oldLineNumber > max) {
          max = line.oldLineNumber;
        }
      });
    });
    return max;
  }, [fileDiff]);

  // 调试：打印评论和文件信息
  useEffect(() => {
    if (comments.length > 0) {
      console.log('FileDiffView - Comments:', comments);
      console.log('FileDiffView - FilePath:', fileDiff.filePath);
      console.log('FileDiffView - MaxLineNumber:', maxLineNumber);
      console.log('FileDiffView - First hunk lines:', fileDiff.hunks[0]?.lines.slice(0, 5));
    }
  }, [comments, fileDiff, maxLineNumber]);

  // 滚动到高亮行
  useEffect(() => {
    if (highlightedLine !== undefined) {
      const lineElement = lineRefs.current.get(highlightedLine);
      if (lineElement) {
        setTimeout(() => {
          lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
  }, [highlightedLine]);

  // 检查评论是否匹配某一行（用于高亮，支持范围匹配）
  const getCommentsForLineHighlight = (
    newLineNumber?: number,
    oldLineNumber?: number
  ): ReviewComment[] => {
    return comments.filter((comment) => {
      // 优先使用 newLineNumber 匹配（对于新增和修改的行）
      const targetLine = newLineNumber || oldLineNumber || 0;
      
      if (targetLine === 0) {
        return false;
      }
      
      // 精确匹配
      if (comment.line === targetLine) {
        return true;
      }
      
      // 范围匹配（如果评论有 endLine）
      if (comment.endLine && targetLine >= comment.line && targetLine <= comment.endLine) {
        return true;
      }
      
      // 如果没有 newLineNumber，尝试匹配 oldLineNumber（对于删除的行）
      if (!newLineNumber && oldLineNumber && comment.line === oldLineNumber) {
        return true;
      }
      
      return false;
    });
  };

  // 检查评论是否应该在此行显示内容（评论显示在 endLine 行的下一行，如果是最后一行则显示在 endLine 行）
  const getCommentsToDisplay = (
    newLineNumber?: number,
    oldLineNumber?: number
  ): ReviewComment[] => {
    // 优先使用 newLineNumber 匹配（对于新增和修改的行）
    const targetLine = newLineNumber || oldLineNumber || 0;
    
    if (targetLine === 0) {
      return [];
    }
    
    return comments.filter((comment) => {
      // 评论显示在 endLine 行的下一行（即 endLine + 1）
      // 如果 endLine 未定义，使用 line
      const displayLine = comment.endLine !== undefined ? comment.endLine : comment.line;
      
      // 如果 endLine 是文件最后一行，评论显示在 endLine 行
      // 否则，评论显示在 endLine + 1 行
      if (displayLine >= maxLineNumber) {
        // 最后一行，显示在 endLine 行
        return targetLine === displayLine;
      } else {
        // 不是最后一行，显示在 endLine + 1 行
        return targetLine === displayLine;
      }
    });
  };

  // 判断是否需要显示 old-line 列（只有修改和删除的文件才需要）
  const showOldLineColumn = fileDiff.status === 'modified' || fileDiff.status === 'deleted' || 
    fileDiff.hunks.some(hunk => hunk.lines.some(line => line.type === 'deletion' || (line.type === 'context' && line.oldLineNumber)));

  const renderLine = (
    line: { type: string; content: string; oldLineNumber?: number; newLineNumber?: number },
    lineIndex: number
  ): React.ReactNode => {
    // 优先使用 newLineNumber（对于新增和修改的行），否则使用 oldLineNumber（对于删除的行）
    const lineNumber = line.newLineNumber || line.oldLineNumber || 0;
    
    // 获取用于高亮的评论（范围内的所有行都高亮）
    const highlightComments = getCommentsForLineHighlight(line.newLineNumber, line.oldLineNumber);
    const shouldHighlight = highlightComments.length > 0;
    
    // 获取应该在此行显示的评论（只在 endLine 或单行评论处显示）
    const commentsToDisplay = getCommentsToDisplay(line.newLineNumber, line.oldLineNumber);
    const shouldDisplayComments = commentsToDisplay.length > 0;

    const isHighlighted = highlightedLine === lineNumber;
    
    return (
      <React.Fragment key={lineIndex}>
        <tr
          className={`diff-line ${line.type} ${shouldHighlight ? 'has-comments' : ''} ${isHighlighted ? 'highlighted' : ''}`}
          data-line-number={lineNumber}
          ref={(el) => {
            if (el && lineNumber > 0) {
              lineRefs.current.set(lineNumber, el);
            }
          }}
        >
          {showOldLineColumn && (
            <td className="line-number old-line">
              {line.type !== 'addition' && line.oldLineNumber ? line.oldLineNumber : ''}
            </td>
          )}
          <td className="line-number new-line">
            {line.type !== 'deletion' && line.newLineNumber ? line.newLineNumber : ''}
          </td>
          <td className="line-content">
            <span className="line-prefix">
              {line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' '}
            </span>
            <code className="line-code">{line.content}</code>
          </td>
        </tr>
        {shouldDisplayComments && (
          <tr className="comment-row">
            <td colSpan={showOldLineColumn ? 3 : 2} className="comment-cell">
              {commentsToDisplay.map((comment, idx) => (
                <CommentMarker key={idx} comment={comment} />
              ))}
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="file-diff-view">
      <div className="file-diff-header">
        <h2 className="file-name">{fileDiff.filePath}</h2>
        <div className="file-stats">
          <span className="stat-additions">+{fileDiff.additions}</span>
          <span className="stat-deletions">-{fileDiff.deletions}</span>
        </div>
      </div>

      <div className="file-diff-content">
        <table className="diff-table">
          <tbody>
            {fileDiff.hunks.map((hunk, hunkIndex) => (
              <React.Fragment key={hunkIndex}>
                <tr className="hunk-header">
                  <td colSpan={showOldLineColumn ? 3 : 2} className="hunk-info">
                    @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                  </td>
                </tr>
                {hunk.lines.map((line, lineIndex) =>
                  renderLine(line, hunkIndex * 1000 + lineIndex)
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FileDiffView;

