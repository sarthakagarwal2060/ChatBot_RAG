import React from 'react';

export function UploadOverlay() {
  return (
    <div className="overlay">
      <div className="modal">
        <h3>Processing...</h3>
        <p>Your document is being indexed.</p>
      </div>
    </div>
  );
}
