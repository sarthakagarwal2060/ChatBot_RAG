import React from 'react';

export function Sidebar({ documents, activeDocId, onUpload, onSelect }) {
  const fileInputRef = React.useRef(null);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="logo">NotebookLM</h1>
      </div>

      <div className="upload-section">
        <button className="btn-primary" onClick={() => fileInputRef.current.click()}>
          + Upload Document
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={(e) => e.target.files[0] && onUpload(e.target.files[0])} 
          accept=".pdf,.txt" 
          hidden 
        />
      </div>

      <div className="doc-list">
        {documents.length === 0 ? (
          <p className="empty-text">No documents uploaded.</p>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              onClick={() => onSelect(doc.id)}
              className={`doc-item ${activeDocId === doc.id ? 'active' : ''}`}
            >
              <div className="doc-name">{doc.filename}</div>
              <div className="doc-meta">{doc.chunkCount} chunks</div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
