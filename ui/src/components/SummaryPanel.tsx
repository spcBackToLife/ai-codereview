import React from 'react';
import './SummaryPanel.css';

interface SummaryPanelProps {
  summary: string;
  totalComments: number;
  filesChanged: number;
  commentsBySeverity: {
    error: number;
    warning: number;
    info: number;
  };
}

const SummaryPanel: React.FC<SummaryPanelProps> = ({
  summary,
  totalComments,
  filesChanged,
  commentsBySeverity,
}) => {
  return (
    <div className="summary-panel">
      <h3>Summary</h3>
      <div className="summary-stats">
        <div className="stat-item">
          <span className="stat-label">Files Changed</span>
          <span className="stat-value">{filesChanged}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Total Comments</span>
          <span className="stat-value">{totalComments}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label stat-error">Errors</span>
          <span className="stat-value stat-error">{commentsBySeverity.error}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label stat-warning">Warnings</span>
          <span className="stat-value stat-warning">{commentsBySeverity.warning}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label stat-info">Info</span>
          <span className="stat-value stat-info">{commentsBySeverity.info}</span>
        </div>
      </div>
      {summary && (
        <div className="summary-text">
          <h4>Review Summary</h4>
          <p>{summary}</p>
        </div>
      )}
    </div>
  );
};

export default SummaryPanel;

