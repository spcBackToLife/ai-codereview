import React, { useState, useMemo } from 'react';
import { FileDiff, ReviewComment } from '../App';
import './FileTree.css';

interface FileTreeProps {
  files: FileDiff[];
  comments: ReviewComment[];
  selectedFile: string | null;
  onFileSelect: (filePath: string) => void;
}

const FileTree: React.FC<FileTreeProps> = ({ files, comments, selectedFile, onFileSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');

  // 过滤文件
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) {
      return files;
    }
    const query = searchQuery.toLowerCase();
    return files.filter((file) => file.filePath.toLowerCase().includes(query));
  }, [files, searchQuery]);

  // 构建文件树结构
  const fileTree = useMemo(() => {
    const tree: Record<string, any> = {};
    
    filteredFiles.forEach((file) => {
      const parts = file.filePath.split('/');
      let current = tree;
      
      parts.forEach((part, index) => {
        if (!current[part]) {
          current[part] = {
            name: part,
            path: parts.slice(0, index + 1).join('/'),
            isFile: index === parts.length - 1,
            file: index === parts.length - 1 ? file : null,
            children: {},
          };
        }
        if (index < parts.length - 1) {
          current = current[part].children;
        }
      });
    });
    
    return tree;
  }, [filteredFiles]);

  // 获取文件的评论统计
  const getFileStats = (filePath: string) => {
    const fileComments = comments.filter((c) => c.filePath === filePath);
    return {
      total: fileComments.length,
      errors: fileComments.filter((c) => c.severity === 'error').length,
      warnings: fileComments.filter((c) => c.severity === 'warning').length,
      info: fileComments.filter((c) => c.severity === 'info').length,
    };
  };

  // 渲染树节点
  const renderNode = (node: any, level: number = 0): React.ReactNode => {
    const isSelected = node.isFile && node.file?.filePath === selectedFile;
    const stats = node.isFile && node.file ? getFileStats(node.file.filePath) : null;
    const hasErrors = stats && stats.errors > 0;

    return (
      <div key={node.path} className="file-tree-node">
        <div
          className={`file-tree-item ${isSelected ? 'active' : ''} ${hasErrors ? 'has-errors' : ''}`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => {
            if (node.isFile && node.file) {
              onFileSelect(node.file.filePath);
            }
          }}
        >
          <span className="file-tree-icon">
            {node.isFile ? '📄' : '📁'}
          </span>
          <span className="file-tree-name">{node.name}</span>
          {stats && (
            <span className="file-tree-badges">
              {stats.errors > 0 && (
                <span className="file-badge file-badge-error">{stats.errors}</span>
              )}
              {stats.warnings > 0 && (
                <span className="file-badge file-badge-warning">{stats.warnings}</span>
              )}
              {stats.info > 0 && (
                <span className="file-badge file-badge-info">{stats.info}</span>
              )}
            </span>
          )}
        </div>
        {Object.keys(node.children).length > 0 && (
          <div className="file-tree-children">
            {Object.values(node.children).map((child: any) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="file-tree">
      <div className="file-tree-search">
        <input
          type="text"
          placeholder="搜索文件..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="file-tree-search-input"
        />
      </div>
      <div className="file-tree-content">
        {Object.values(fileTree).map((node: any) => renderNode(node))}
        {filteredFiles.length === 0 && (
          <div className="file-tree-empty">未找到匹配的文件</div>
        )}
      </div>
    </div>
  );
};

export default FileTree;


