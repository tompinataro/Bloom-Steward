import React from 'react';

// This is one of our simplest components
// It doesn't have local state,
// It doesn't dispatch any redux actions or display any part of redux state
// or even care what the redux state is'

function AboutPage() {
  return (
    <div className="container" role="main">
      <h1>About Bloom Steward</h1>
      <p>Bloom Steward helps field technicians complete daily plant maintenance routes quickly and accurately.</p>
      <p>Track today’s visits, check in/out, complete a simple checklist, and leave notes for the office.</p>
      <p>Questions? Contact support.</p>
    </div>
  );
}

export default AboutPage;
