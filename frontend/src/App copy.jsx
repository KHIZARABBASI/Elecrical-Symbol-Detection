import React, { useState, useEffect } from 'react';
import UploadSection from './components/UploadSection';
import ProcessPipeline from './components/ProcessPipeline';
import InferenceResult from './components/InferenceResult';
import SummaryPanel from './components/SummaryPanel';
import DetectionOverview from './components/DetectionOverview';
import axios from 'axios';

export default function App() {
  const [activeStep, setActiveStep] = useState(0);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryMetrics, setSummaryMetrics] = useState(null);
  const [detectionData, setDetectionData] = useState(null);

  // 🚀 Upload Handler
  const handleUploadComplete = async (fileInfo) => {
    try {
      if (fileInfo.status === "Complete") {
        // Step 1: Upload complete
        setActiveStep(1);
        console.log('✅ Step 1: Upload complete.');

        // Step 2: Processing
        setActiveStep(2);
        await axios.get('http://localhost:8000/Processings');
        console.log('✅ Step 2: Processing complete.');

        // Step 3: Load YOLO model
        setActiveStep(3);
        await axios.get('http://localhost:8000/load_model');
        console.log('✅ Step 3: Model loaded.');

        // Step 4: Get results
        setActiveStep(5);
        const resultsRes = await axios.get('http://localhost:8000/results');
        console.log('✅ Step 4: Results fetched.');

        // Extract and store response data
        const data = resultsRes.data;

        // Full result data (includes detections)
        setSummaryData(data);

        // Extract summary metrics manually (not nested under "summary")
        setSummaryMetrics(data.summary);

        // Extract detection details
        setDetectionData(data.detections);

        console.log('📊 Summary:', data);
      } else {
        console.error('❌ Upload failed:', fileInfo.error);
      }
    } catch (error) {
      console.error('⚠️ Pipeline error:', error);
    }
  };

  // 🧹 Reset backend storage when app starts
  useEffect(() => {
    const resetServer = async () => {
      try {
        await axios.get('http://127.0.0.1:8000/reset');
        console.log('🧹 Server storage reset');
      } catch (err) {
        console.warn('⚠️ Failed to reset server storage', err);
      }
    };
    resetServer();
  }, []);

  return (
    <div className="app-shell">
      {/* Header */}
      <div className="header">
        <div className="header-left">
          <div className="brand">
            <div className="logo">
              <i className="pi pi-sitemap" style={{ fontSize: 18, color: '#2f80ed' }}></i>
            </div>
            <div>
              <div style={{ fontSize: 14, color: '#666' }}>DPS</div>
              <div style={{ fontSize: 18 }}>Electrical Symbols Detector</div>
            </div>
          </div>
        </div>

        <div className="header-right">
          <i className="pi pi-cog" style={{ fontSize: 18, marginRight: 8 }}></i>
          <i className="pi pi-user" style={{ fontSize: 18 }}></i>
        </div>
      </div>

      {/* Main Grid */}
      <div className="main-grid" style={{ marginTop: 12 }}>
        <div className="card">
          <UploadSection onUploadComplete={handleUploadComplete} />
        </div>

        <div className="card">
          <ProcessPipeline activeStep={activeStep} />
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="bottom-grid">
        <div className="card">
          <InferenceResult data={summaryData} />
        </div>

        <div className="card right-col">
          <SummaryPanel summary={summaryMetrics} />
          <DetectionOverview data={detectionData} />
        </div>
      </div>

      <div className="footer-space" />
    </div>
  );
}
