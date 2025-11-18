import React from 'react';
import { ReviewComment } from '../App';
import './CommentMarker.css';

interface CommentMarkerProps {
  comment: ReviewComment;
}

const CommentMarker: React.FC<CommentMarkerProps> = ({ comment }) => {
  const severityClass = `comment-severity-${comment.severity}`;

  const tagLabels: Record<string, string> = {
    typescript: 'TS',
    react: 'React',
    'code-design': '设计',
  };

  const lineRange = comment.endLine !== comment.line
    ? `${comment.line}-${comment.endLine}`
    : `${comment.line}`;

  const severityConfig = {
    error: { color: 'var(--error-color)', bg: 'var(--error-bg)' },
    warning: { color: 'var(--warning-color)', bg: 'var(--warning-bg)' },
    info: { color: 'var(--info-color)', bg: 'var(--info-bg)' },
  }[comment.severity];

  return (
    <div className={`comment-marker ${severityClass}`}>
      <div className="comment-marker-inner">
      <div className="comment-header">
          <div className="comment-header-left">
            <div className="comment-severity-badge" style={{ 
              color: severityConfig.color,
              background: severityConfig.bg 
            }}>
              <span className="severity-icon">●</span>
              <span className="severity-text">{comment.severity.toUpperCase()}</span>
            </div>
        {comment.ruleId && (
              <span className="comment-rule-id" title={`${comment.ruleName} (${comment.ruleLevel})`}>
                {comment.ruleId}
              </span>
        )}
            <span className="comment-line-badge">Line {lineRange}</span>
          </div>
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
            {comment.tags.map((tag, idx) => (
              <span key={idx} className="comment-tag" title={tag}>
                {tagLabels[tag] || tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentMarker;

