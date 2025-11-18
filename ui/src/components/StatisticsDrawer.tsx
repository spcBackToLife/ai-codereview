import React, { useState } from 'react';
import { ReviewData } from '../App';
import './StatisticsDrawer.css';

interface StatisticsDrawerProps {
  data: ReviewData;
  isOpen: boolean;
  onClose: () => void;
  onCommentClick: (comment: ReviewData['review']['comments'][0]) => void;
  onSeverityFilter: (severity: 'error' | 'warning' | 'info' | null) => void;
}

const StatisticsDrawer: React.FC<StatisticsDrawerProps> = ({
  data,
  isOpen,
  onClose,
  onCommentClick,
  onSeverityFilter,
}) => {
  const [ruleViewMode, setRuleViewMode] = useState<'table' | 'grid'>('table');
  
  if (!isOpen) return null;

  const stats = {
    totalComments: data.review.comments.length,
    errors: data.review.comments.filter((c) => c.severity === 'error').length,
    warnings: data.review.comments.filter((c) => c.severity === 'warning').length,
    info: data.review.comments.filter((c) => c.severity === 'info').length,
  };

  const errorPercentage = stats.totalComments > 0 
    ? ((stats.errors / stats.totalComments) * 100).toFixed(1) 
    : '0';
  const warningPercentage = stats.totalComments > 0 
    ? ((stats.warnings / stats.totalComments) * 100).toFixed(1) 
    : '0';
  const infoPercentage = stats.totalComments > 0 
    ? ((stats.info / stats.totalComments) * 100).toFixed(1) 
    : '0';

  // 按规则ID分组统计
  const ruleStats = new Map<string, {
    ruleId: string;
    ruleName: string;
    ruleLevel: string;
    count: number;
    severity: 'error' | 'warning' | 'info';
  }>();

  data.review.comments.forEach((comment) => {
    const key = comment.ruleId;
    if (!ruleStats.has(key)) {
      ruleStats.set(key, {
        ruleId: comment.ruleId,
        ruleName: comment.ruleName,
        ruleLevel: comment.ruleLevel,
        count: 0,
        severity: comment.severity,
      });
    }
    const stat = ruleStats.get(key)!;
    stat.count++;
  });

  const ruleStatsArray = Array.from(ruleStats.values())
    .sort((a, b) => {
      // 先按严重程度排序
      const severityOrder = { error: 0, warning: 1, info: 2 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      // 再按数量排序
      return b.count - a.count;
    });

  // 按文件分组统计
  const fileStats = new Map<string, {
    filePath: string;
    errors: number;
    warnings: number;
    info: number;
    total: number;
  }>();

  data.review.comments.forEach((comment) => {
    if (!fileStats.has(comment.filePath)) {
      fileStats.set(comment.filePath, {
        filePath: comment.filePath,
        errors: 0,
        warnings: 0,
        info: 0,
        total: 0,
      });
    }
    const stat = fileStats.get(comment.filePath)!;
    stat[comment.severity]++;
    stat.total++;
  });

  const fileStatsArray = Array.from(fileStats.values())
    .sort((a, b) => b.total - a.total);

  return (
    <>
      <div className="statistics-drawer-overlay" onClick={onClose} />
      <div className="statistics-drawer">
        <div className="statistics-drawer-header">
          <h2>问题分析</h2>
          <button className="statistics-drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="statistics-drawer-content">
          {/* 问题类型占比和规则统计 - 并排显示 */}
          <section className="statistics-section charts-row">
            {/* 问题类型占比 */}
            <div className="chart-container">
              <h3>问题类型占比</h3>
              <div className="severity-chart-container">
                {/* 饼图 */}
                <div className="severity-pie-chart">
                  <svg viewBox="0 0 200 200" className="pie-chart-svg">
                    {(() => {
                      let currentAngle = -90;
                      const radius = 70;
                      const centerX = 100;
                      const centerY = 100;
                      const segments = [];
                      
                      if (stats.errors > 0) {
                        const angle = (stats.errors / stats.totalComments) * 360;
                        segments.push(
                          <path
                            key="error"
                            d={`M ${centerX} ${centerY} L ${centerX + radius * Math.cos((currentAngle * Math.PI) / 180)} ${centerY + radius * Math.sin((currentAngle * Math.PI) / 180)} A ${radius} ${radius} 0 ${angle > 180 ? 1 : 0} 1 ${centerX + radius * Math.cos(((currentAngle + angle) * Math.PI) / 180)} ${centerY + radius * Math.sin(((currentAngle + angle) * Math.PI) / 180)} Z`}
                            fill="var(--error-color)"
                            className="pie-segment pie-segment-error"
                            onClick={() => onSeverityFilter('error')}
                          />
                        );
                        currentAngle += angle;
                      }
                      
                      if (stats.warnings > 0) {
                        const angle = (stats.warnings / stats.totalComments) * 360;
                        segments.push(
                          <path
                            key="warning"
                            d={`M ${centerX} ${centerY} L ${centerX + radius * Math.cos((currentAngle * Math.PI) / 180)} ${centerY + radius * Math.sin((currentAngle * Math.PI) / 180)} A ${radius} ${radius} 0 ${angle > 180 ? 1 : 0} 1 ${centerX + radius * Math.cos(((currentAngle + angle) * Math.PI) / 180)} ${centerY + radius * Math.sin(((currentAngle + angle) * Math.PI) / 180)} Z`}
                            fill="var(--warning-color)"
                            className="pie-segment pie-segment-warning"
                            onClick={() => onSeverityFilter('warning')}
                          />
                        );
                        currentAngle += angle;
                      }
                      
                      if (stats.info > 0) {
                        const angle = (stats.info / stats.totalComments) * 360;
                        segments.push(
                          <path
                            key="info"
                            d={`M ${centerX} ${centerY} L ${centerX + radius * Math.cos((currentAngle * Math.PI) / 180)} ${centerY + radius * Math.sin((currentAngle * Math.PI) / 180)} A ${radius} ${radius} 0 ${angle > 180 ? 1 : 0} 1 ${centerX + radius * Math.cos(((currentAngle + angle) * Math.PI) / 180)} ${centerY + radius * Math.sin(((currentAngle + angle) * Math.PI) / 180)} Z`}
                            fill="var(--info-color)"
                            className="pie-segment pie-segment-info"
                            onClick={() => onSeverityFilter('info')}
                          />
                        );
                      }
                      
                      return segments;
                    })()}
                    <circle cx="100" cy="100" r="40" fill="var(--bg-primary)" />
                    <text x="100" y="95" textAnchor="middle" className="pie-chart-center-text">
                      {stats.totalComments}
                    </text>
                    <text x="100" y="110" textAnchor="middle" className="pie-chart-center-label">
                      总计
                    </text>
                  </svg>
                </div>
                
                {/* 图例 */}
                <div className="severity-legend">
                  <div 
                    className="legend-item legend-error"
                    onClick={() => onSeverityFilter('error')}
                  >
                    <div className="legend-color" style={{ background: 'var(--error-color)' }} />
                    <span className="legend-label">错误</span>
                    <span className="legend-value">{stats.errors}</span>
                    <span className="legend-percentage">({errorPercentage}%)</span>
                  </div>
                  <div 
                    className="legend-item legend-warning"
                    onClick={() => onSeverityFilter('warning')}
                  >
                    <div className="legend-color" style={{ background: 'var(--warning-color)' }} />
                    <span className="legend-label">警告</span>
                    <span className="legend-value">{stats.warnings}</span>
                    <span className="legend-percentage">({warningPercentage}%)</span>
                  </div>
                  <div 
                    className="legend-item legend-info"
                    onClick={() => onSeverityFilter('info')}
                  >
                    <div className="legend-color" style={{ background: 'var(--info-color)' }} />
                    <span className="legend-label">建议</span>
                    <span className="legend-value">{stats.info}</span>
                    <span className="legend-percentage">({infoPercentage}%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 规则统计 - 图表始终显示 */}
            <div className="chart-container">
              <h3>规则统计</h3>
              <div className="rule-chart-container">
                <div className="rule-pie-chart">
                  <svg viewBox="0 0 200 200" className="pie-chart-svg">
                    {(() => {
                      const totalRuleCount = ruleStatsArray.reduce((sum, rule) => sum + rule.count, 0);
                      if (totalRuleCount === 0) return null;
                      
                      let currentAngle = -90;
                      const radius = 70;
                      const centerX = 100;
                      const centerY = 100;
                      const segments = [];
                      const colors = [
                        '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
                        '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
                        '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef'
                      ];
                      
                      ruleStatsArray.slice(0, 10).forEach((rule, index) => {
                        const angle = (rule.count / totalRuleCount) * 360;
                        const color = colors[index % colors.length];
                        segments.push(
                          <path
                            key={rule.ruleId}
                            d={`M ${centerX} ${centerY} L ${centerX + radius * Math.cos((currentAngle * Math.PI) / 180)} ${centerY + radius * Math.sin((currentAngle * Math.PI) / 180)} A ${radius} ${radius} 0 ${angle > 180 ? 1 : 0} 1 ${centerX + radius * Math.cos(((currentAngle + angle) * Math.PI) / 180)} ${centerY + radius * Math.sin(((currentAngle + angle) * Math.PI) / 180)} Z`}
                            fill={color}
                            className="pie-segment"
                          />
                        );
                        currentAngle += angle;
                      });
                      
                      return segments;
                    })()}
                    <circle cx="100" cy="100" r="40" fill="var(--bg-primary)" />
                    <text x="100" y="95" textAnchor="middle" className="pie-chart-center-text">
                      {ruleStatsArray.length}
                    </text>
                    <text x="100" y="110" textAnchor="middle" className="pie-chart-center-label">
                      规则数
                    </text>
                  </svg>
                </div>
                
                {/* 规则图例 */}
                <div className="rule-legend">
                  {ruleStatsArray.slice(0, 10).map((rule, index) => {
                    const colors = [
                      '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
                      '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
                      '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef'
                    ];
                    const color = colors[index % colors.length];
                    const percentage = ruleStatsArray.reduce((sum, r) => sum + r.count, 0) > 0
                      ? ((rule.count / ruleStatsArray.reduce((sum, r) => sum + r.count, 0)) * 100).toFixed(1)
                      : '0';
                    
                    return (
                      <div key={rule.ruleId} className="rule-legend-item">
                        <div className="legend-color" style={{ background: color }} />
                        <div className="rule-legend-content">
                          <div className="rule-legend-name">{rule.ruleName}</div>
                          <div className="rule-legend-meta">
                            <code className="rule-legend-id">{rule.ruleId}</code>
                            <span className="rule-legend-count">{rule.count}</span>
                            <span className="rule-legend-percentage">({percentage}%)</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* 规则详情 - 独立切换 */}
          <section className="statistics-section">
            <div className="section-header-with-toggle">
              <h3>规则详情</h3>
              <div className="view-toggle">
                <button
                  className={`toggle-btn ${ruleViewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setRuleViewMode('table')}
                  title="表格视图"
                >
                  ☰
                </button>
                <button
                  className={`toggle-btn ${ruleViewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setRuleViewMode('grid')}
                  title="卡片视图"
                >
                  ⊞
                </button>
              </div>
            </div>
            
              {ruleViewMode === 'table' ? (
                <div className="rule-stats-table">
                  <table>
                    <thead>
                      <tr>
                        <th>规则ID</th>
                        <th>规则名称</th>
                        <th>级别</th>
                        <th>问题数量</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ruleStatsArray.map((rule) => (
                        <tr key={rule.ruleId}>
                          <td><code>{rule.ruleId}</code></td>
                          <td>{rule.ruleName}</td>
                          <td>
                            <span className={`rule-level-badge rule-level-${rule.severity}`}>
                              {rule.ruleLevel}
                            </span>
                          </td>
                          <td>
                            <span className={`rule-count rule-count-${rule.severity}`}>
                              {rule.count}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rule-stats-grid">
                  {ruleStatsArray.map((rule) => (
                    <div key={rule.ruleId} className="rule-stat-card">
                      <div className="rule-card-header">
                        <code className="rule-card-id">{rule.ruleId}</code>
                        <span className={`rule-card-count rule-count-${rule.severity}`}>
                          {rule.count}
                        </span>
                      </div>
                      <div className="rule-card-name">{rule.ruleName}</div>
                      <div className="rule-card-footer">
                        <span className={`rule-level-badge rule-level-${rule.severity}`}>
                          {rule.ruleLevel}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </section>

          {/* 文件统计 */}
          <section className="statistics-section">
            <h3>文件统计</h3>
            <div className="file-stats-list">
              {fileStatsArray.slice(0, 10).map((file) => (
                <div key={file.filePath} className="file-stat-item">
                  <div className="file-stat-path">{file.filePath}</div>
                  <div className="file-stat-badges">
                    {file.errors > 0 && (
                      <span className="file-stat-badge file-stat-error">
                        {file.errors} 错误
                      </span>
                    )}
                    {file.warnings > 0 && (
                      <span className="file-stat-badge file-stat-warning">
                        {file.warnings} 警告
                      </span>
                    )}
                    {file.info > 0 && (
                      <span className="file-stat-badge file-stat-info">
                        {file.info} 建议
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

export default StatisticsDrawer;

