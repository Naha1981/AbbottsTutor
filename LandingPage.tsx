/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

import React from 'react';

interface LandingPageProps {
  onStartApp: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStartApp }) => {
  return (
    <div className="landing-page-container">
      <header className="landing-header">
        <div className="landing-logo">
          <span className="material-symbols-outlined logo-icon">school</span>
          AbbottsTutor
        </div>
        <button onClick={onStartApp} className="landing-button primary">
          Get Started <span className="material-symbols-outlined arrow-icon">arrow_forward</span>
        </button>
      </header>

      <main>
        <section className="hero-section">
          <div className="powered-by-tag">Powered by AI - Designed for Students</div>
          <h1>Transform Learning with AbbottsTutor</h1>
          <p className="hero-subtitle">
            Turn YouTube videos into interactive apps, get instant homework help, and transcribe lectures with our revolutionary AI learning assistant designed specifically for high school students.
          </p>
          <button onClick={onStartApp} className="landing-button primary hero-button">
            Start Learning Now <span className="material-symbols-outlined arrow-icon">arrow_forward</span>
          </button>
        </section>

        <section className="modes-section">
          <h2>Three Powerful Learning Modes</h2>
          <p className="section-subtitle">Choose the perfect tool for your learning style and academic needs</p>
          <div className="modes-grid">
            <div className="mode-card">
              <span className="material-symbols-outlined mode-icon video-icon">ondemand_video</span>
              <h3>Video to App</h3>
              <p>Transform YouTube videos into interactive learning applications</p>
              <ul>
                <li>AI-generated interactive apps from any YouTube video</li>
                <li>Key concept extraction with detailed explanations</li>
                <li>Practice questions tailored to the content</li>
              </ul>
            </div>
            <div className="mode-card">
              <span className="material-symbols-outlined mode-icon homework-icon">menu_book</span>
              <h3>Homework Assist</h3>
              <p>Get instant help with CAPS curriculum homework questions</p>
              <ul>
                <li>Subject-specific assistance for South African curriculum</li>
                <li>Step-by-step solution explanations</li>
                <li>Covers Physics, Math, Life Sciences, History & Geography</li>
              </ul>
            </div>
            <div className="mode-card">
              <span className="material-symbols-outlined mode-icon record-icon">mic</span>
              <h3>Record Lecture</h3>
              <p>Convert spoken lectures into searchable text transcripts</p>
              <ul>
                <li>Real-time voice-to-text transcription</li>
                <li>Perfect for note-taking and review</li>
                <li>AI-powered accuracy and formatting</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="why-choose-section">
          <h2>Why Choose AbbottsTutor?</h2>
          <p className="section-subtitle">Experience the future of personalized education</p>
          <div className="features-grid">
            <div className="feature-item">
              <span className="material-symbols-outlined feature-icon instant-icon">bolt</span>
              <h3>Instant Results</h3>
              <p>Get immediate help and explanations when you need them most</p>
            </div>
            <div className="feature-item">
              <span className="material-symbols-outlined feature-icon curriculum-icon">verified_user</span>
              <h3>Curriculum Aligned</h3>
              <p>Specifically designed for South African CAPS curriculum requirements</p>
            </div>
            <div className="feature-item">
              <span className="material-symbols-outlined feature-icon ai-icon">emoji_objects</span>
              <h3>AI-Powered</h3>
              <p>Advanced Google Gemini AI ensures accurate and helpful responses</p>
            </div>
            <div className="feature-item">
              <span className="material-symbols-outlined feature-icon student-icon">groups</span>
              <h3>Student-Focused</h3>
              <p>Built by educators, for students, with accessibility in mind</p>
            </div>
          </div>
        </section>

        <section className="cta-section">
          <h2>Ready to Transform Your Learning?</h2>
          <p>Join thousands of students who are already using AbbottsTutor to excel in their studies</p>
          <button onClick={onStartApp} className="landing-button primary cta-button">
            Get Started Now <span className="material-symbols-outlined arrow-icon">arrow_forward</span>
          </button>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-logo footer-logo">
          <span className="material-symbols-outlined logo-icon">school</span>
          AbbottsTutor
        </div>
        <p>Empowering students with AI-driven educational tools.</p>
        <p className="attribution-footer">Created by Thabiso Naha • Designed for Abbotts High School</p>
      </footer>

      <style>{`
        /* Ensure this style block is within the LandingPage component */
        .landing-page-container {
          background-color: #0A192F; /* Dark Navy Blue */
          color: #CCD6F6; /* Light blueish grey text */
          font-family: 'Google Sans Flex', sans-serif;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .landing-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem 3rem;
          border-bottom: 1px solid #1E2D4B; /* Slightly lighter navy for border */
        }

        .landing-logo {
          display: flex;
          align-items: center;
          font-family: 'Audiowide', cursive;
          font-size: 1.5rem;
          color: #FFFFFF;
        }
        .landing-logo .logo-icon {
          margin-right: 0.5rem;
          font-size: 2rem;
          color: #63B3E6; /* Match app's primary accent for icon consistency */
        }

        .landing-button {
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.3s ease, transform 0.2s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-size: 0.9rem;
          text-decoration: none; /* For potential <a> tag usage */
        }
        .landing-button.primary {
          background-color: #2563EB; /* Bright Blue */
          color: #FFFFFF;
          border: none;
        }
        .landing-button.primary:hover {
          background-color: #1D4ED8; /* Darker Bright Blue */
          transform: translateY(-2px);
        }
        .landing-button .arrow-icon {
          font-size: 1.2rem;
        }

        main {
          flex-grow: 1;
        }
        
        section {
          padding: 4rem 3rem;
          text-align: center;
        }
        
        .hero-section {
          padding-top: 5rem; /* More padding for hero */
          padding-bottom: 5rem;
        }
        .powered-by-tag {
          display: inline-block;
          background-color: rgba(37, 99, 235, 0.2); /* Transparent Bright Blue */
          color: #60A5FA; /* Lighter Bright Blue */
          padding: 0.3rem 0.8rem;
          border-radius: 1rem;
          font-size: 0.8rem;
          font-weight: 500;
          margin-bottom: 1rem;
          border: 1px solid #2563EB;
        }
        .hero-section h1 {
          font-size: 3.5rem;
          font-weight: 700;
          color: #FFFFFF;
          margin-bottom: 1.5rem;
          line-height: 1.2;
        }
        .hero-subtitle {
          font-size: 1.1rem;
          max-width: 600px;
          margin: 0 auto 2.5rem auto;
          line-height: 1.6;
          color: #A8B2D1; /* Lighter text color */
        }
        .hero-button {
          padding: 1rem 2rem;
          font-size: 1rem;
        }

        section h2 {
          font-size: 2.5rem;
          font-weight: 600;
          color: #FFFFFF;
          margin-bottom: 1rem;
        }
        .section-subtitle {
          font-size: 1rem;
          color: #A8B2D1;
          margin-bottom: 3rem;
          max-width: 500px;
          margin-left: auto;
          margin-right: auto;
        }

        .modes-grid, .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 2rem;
          margin-top: 3rem;
        }
        .mode-card, .feature-item {
          background-color: #1E2D4B; /* Slightly Lighter Navy */
          padding: 2rem;
          border-radius: 8px;
          text-align: left;
          border: 1px solid #303C55;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .mode-card:hover, .feature-item:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.2);
        }

        .mode-card h3, .feature-item h3 {
          font-size: 1.5rem;
          color: #FFFFFF;
          margin-bottom: 0.75rem;
        }
        .mode-card p, .feature-item p {
          font-size: 0.95rem;
          line-height: 1.6;
          color: #CCD6F6;
        }
        .mode-card ul {
          list-style: none;
          padding: 0;
          margin-top: 1rem;
        }
        .mode-card ul li {
          font-size: 0.9rem;
          color: #A8B2D1;
          margin-bottom: 0.5rem;
          position: relative;
          padding-left: 1.2rem;
        }
        .mode-card ul li::before {
          content: '✓';
          position: absolute;
          left: 0;
          color: #2563EB; /* Bright Blue checkmark */
        }
        .mode-icon, .feature-icon {
          font-size: 2.5rem;
          padding: 0.8rem;
          border-radius: 50%;
          margin-bottom: 1rem;
          display: inline-block;
        }
        .mode-icon.video-icon { background-color: rgba(37, 99, 235, 0.2); color: #60A5FA; } /* Blue */
        .mode-icon.homework-icon { background-color: rgba(16, 185, 129, 0.2); color: #34D399; } /* Green */
        .mode-icon.record-icon { background-color: rgba(139, 92, 246, 0.2); color: #A78BFA; } /* Purple */

        .feature-icon.instant-icon { background-color: rgba(37, 99, 235, 0.2); color: #60A5FA; } /* Blue */
        .feature-icon.curriculum-icon { background-color: rgba(16, 185, 129, 0.2); color: #34D399; } /* Green */
        .feature-icon.ai-icon { background-color: rgba(139, 92, 246, 0.2); color: #A78BFA; } /* Purple */
        .feature-icon.student-icon { background-color: rgba(249, 115, 22, 0.2); color: #FDBA74; } /* Orange */
        
        .cta-section {
          background-color: #1E2D4B; /* Slightly Lighter Navy for contrast */
        }
        .cta-section h2 {
            margin-bottom: 0.75rem;
        }
        .cta-section p {
            margin-bottom: 2rem;
            color: #A8B2D1;
        }
        .cta-button {
            padding: 1rem 2.5rem;
            font-size: 1.1rem;
        }

        .landing-footer {
          text-align: center;
          padding: 2.5rem 3rem;
          border-top: 1px solid #1E2D4B;
          font-size: 0.9rem;
        }
        .landing-footer .landing-logo {
          justify-content: center;
          margin-bottom: 0.5rem;
          font-size: 1.3rem;
        }
        .landing-footer p {
          margin-bottom: 0.3rem;
          color: #A8B2D1;
        }
        .landing-footer .attribution-footer {
          font-size: 0.8rem;
          color: #8892B0; /* More subtle color */
        }

        @media (max-width: 768px) {
          .landing-header {
            padding: 1rem 1.5rem;
            flex-direction: column;
            gap: 1rem;
          }
          section {
            padding: 2.5rem 1.5rem;
          }
          .hero-section h1 {
            font-size: 2.5rem;
          }
          .hero-subtitle {
            font-size: 1rem;
          }
          section h2 {
            font-size: 2rem;
          }
          .modes-grid, .features-grid {
            grid-template-columns: 1fr; /* Stack on mobile */
          }
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
