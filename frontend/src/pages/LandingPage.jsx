import React, { useState } from "react";
import App from "../App";

export default function LandingPage() {
  const [showMainApp, setShowMainApp] = useState(false);

  if (showMainApp) {
    return <App />;
  }

  return (
    <div className="landing-page">
      {/* Header */}
      <nav className="nav-header">
        <div className="nav-brand">
          <img src="src\img\dps_logo.png" alt="DPS Kuwait" className="logo" />
          <span><h5>Electric Symbols Detector</h5></span>
        </div>
        <button className="get-started-btn" onClick={() => setShowMainApp(true)}>
          Get Started
        </button>
      </nav>

      {/* Hero Section */}
      <div className="hero-section">
        <h1>
          Streamline Your <span className="text-red">Hiring Process</span>
        </h1>
        <p className="hero-desc">
          AI-powered resume screening for DPS Kuwait. Automatically analyze, score, and
          rank candidates to find the perfect fit for your team faster than ever before.
        </p>
        <button className="get-started-btn" onClick={() => setShowMainApp(true)}>
          Start Screening Resumes →
        </button>
      </div>

      {/* Features Grid */}
      <div className="features-grid">
        <div className="feature-card">
          <div className="feature-icon blue">
            {/* <i className="pi pi-file"></i> */}
            <img src="src\img\analysis.png" alt="DPS Kuwait" className="logo" />

          </div>
          <h3>Smart Resume Analysis</h3>
          <p>Upload job descriptions and let our AI analyze resumes against your specific requirements with detailed scoring and recommendations.</p>
        </div>
        
        <div className="feature-card">
          <div className="feature-icon green">
            {/* <i className="pi pi-users"></i> */}
          <img src="src\img\manage.png" alt="DPS Kuwait" className="logo" />

          </div>
          <h3>Candidate Management</h3>
          <p>Organize and track candidates through different stages of your hiring process with comprehensive candidate profiles and notes.</p>
        </div>

        <div className="feature-card">
          <div className="feature-icon purple">
            {/* <i className="pi pi-chart-bar"></i> */}
          <img src="src\img\insights.png" alt="DPS Kuwait" className="logo" />
          </div>
          <h3>Analytics & Insights</h3>
          <p>Get detailed analytics on your hiring process, track performance metrics and optimize your recruitment strategy with data-driven insights.</p>
        </div>
      </div>

      {/* CTA Section */}
      <div className="cta-section">
        <h2>Ready to Transform Your Hiring?</h2>
        <p>Join DPS Kuwait's HR team in revolutionizing the way we find and hire top talent.</p>
        <button className="get-started-now-btn" onClick={() => setShowMainApp(true)}>
          Get Started Now
        </button>
      </div>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <img src="src\img\dps_logo.png" alt="DPS Kuwait" className="footer-logo" />
          <span>DPS Kuwait</span>
        </div>
        <div className="footer-text">
          Digital Processing Systems Kuwait - HR Resume Screener
        </div>
      </footer>
    </div>
  );
}