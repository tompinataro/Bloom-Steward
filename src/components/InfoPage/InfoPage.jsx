import React from 'react';

// This is one of our simplest components
// It doesn't have local state
// It doesn't dispatch any redux actions or display any part of redux state
// or even care what the redux state is

function InfoPage() {
  return (
    <div className="container" role="main">
      <h1>Info</h1>
      <p>Welcome! Use the navigation to view your route, open a visit, and submit your checklist.</p>
    </div>
  );
}

export default InfoPage;
