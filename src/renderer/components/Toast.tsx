import React from 'react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastProps {
  messages: ToastMessage[];
}

const Toast: React.FC<ToastProps> = ({ messages }) => {
  if (messages.length === 0) return null;

  return (
    <div className="toast-container">
      {messages.map(msg => (
        <div key={msg.id} className={`toast toast-${msg.type}`}>
          <span>
            {msg.type === 'success' && '✅'}
            {msg.type === 'error' && '❌'}
            {msg.type === 'info' && 'ℹ️'}
          </span>
          <span>{msg.message}</span>
        </div>
      ))}
    </div>
  );
};

export default Toast;
