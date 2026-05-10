import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { UploadOverlay } from './components/UploadOverlay';
import './App.css';

// Set default base URL for production/development
axios.defaults.baseURL = import.meta.env.BACKEND_URL || "http://localhost:3000";

function App() {
  const [documents, setDocuments] = useState([]);
  const [activeDocId, setActiveDocId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const handleUpload = async (file) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post('/api/upload', formData);
      const newDoc = res.data.document;
      setDocuments(prev => [...prev, newDoc]);
      handleSelectDocument(newDoc.id, [...documents, newDoc]);
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelectDocument = (docId, currentDocs = documents) => {
    setActiveDocId(docId);
    const doc = currentDocs.find(d => d.id === docId);
    
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `I've loaded **${doc.filename}** (${doc.chunkCount} chunks indexed). Ask me anything about this document!`,
        timestamp: new Date()
      }
    ]);
  };

  const handleSendMessage = async (query) => {
    if (!query.trim() || !activeDocId) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const res = await axios.post('/api/chat', {
        query,
        documentId: activeDocId
      });

      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.data.answer,
        sources: res.data.sources,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ Error: ${err.response?.data?.error || err.message}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="app-container">
      <Sidebar 
        documents={documents} 
        activeDocId={activeDocId} 
        onUpload={handleUpload} 
        onSelect={handleSelectDocument} 
      />
      
      <ChatArea 
        activeDoc={documents.find(d => d.id === activeDocId)} 
        messages={messages} 
        onSendMessage={handleSendMessage}
        isTyping={isTyping}
      />

      {isUploading && <UploadOverlay />}
    </div>
  );
}

export default App;
