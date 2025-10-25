import React, { useState, useEffect } from 'react';
import axios from 'axios';

import UploadSection from './components/UploadSection';
import ProcessPipeline from './components/ProcessPipeline';
import InferenceResult from './components/InferenceResult';
import SummaryPanel from './components/SummaryPanel';
import DetectionOverview from './components/DetectionOverview';

// 🧠 Backend URL
const BACKEND = "http://127.0.0.1:8000";

export default function App() {
  const [activeStep, setActiveStep] = useState(0);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryMetrics, setSummaryMetrics] = useState(null);
  const [detectionData, setDetectionData] = useState(null);
  const [status, setStatus] = useState("");

  // 🧹 Reset backend storage when app starts
  useEffect(() => {
    const resetServer = async () => {
      try {
        await axios.get(`${BACKEND}/reset`);
        console.log("🧹 Server storage reset");
      } catch (err) {
        console.warn("⚠️ Failed to reset server storage", err);
      }
    };
    resetServer();
  }, []);

  // 🚀 Upload Handler (entire pipeline)
  const handleUploadComplete = async (fileInfo) => {
    try {
      if (fileInfo.status !== "Complete") {
        console.error("❌ Upload failed:", fileInfo.error);
        setStatus("❌ Upload failed");
        return;
      }

      console.log("✅ Step 1: Upload complete.");
      setActiveStep(1);
      setStatus("✅ File uploaded");

      // Step 2: Preprocessing
      setActiveStep(2);
      setStatus("🧠 Preprocessing...");
      await axios.get(`${BACKEND}/preprocess`);
      console.log("✅ Step 2: Preprocessing complete.");

      // Step 3: Load YOLO model
      setActiveStep(3);
      setStatus("📦 Loading model...");
      await axios.get(`${BACKEND}/load_model`);
      console.log("✅ Step 3: Model loaded.");

      // Step 4: Run inference
      setActiveStep(4);
      setStatus("🚀 Running inference...");
      await axios.get(`${BACKEND}/inference`);
      console.log("✅ Step 4: Inference complete.");

      // Step 5: Fetch results
      setActiveStep(5);
      setStatus("📊 Fetching results...");
      const resultsRes = await axios.get(`${BACKEND}/results`);
      const data = resultsRes.data;
      console.log("✅ Step 5: Results fetched.");

      // 🧩 Extract and store response data
      setSummaryData(data);
      setSummaryMetrics(data.summary || {});
      setDetectionData(data.detections || []);
      setStatus("✅ Inference complete. Results ready.");

    } catch (error) {
      console.error("⚠️ Pipeline error:", error);
      setStatus("❌ Pipeline failed. Check backend logs.");
    }
  };

  return (
    <div className="app-shell">
      {/* Header */}
      <div className="header">
        <div className="header-left">
          <div className="brand">
            <div className="logo">
              <img
                src="src/img/dps_logo.png"
                alt="DPS Kuwait"
                className="logo"
              />
            </div>
            <div>
              <div style={{ fontSize: 14, color: "#666" }}>DPS</div>
              <div style={{ fontSize: 18 }}>Electrical Symbols Detector</div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      {status && (
        <div
          style={{
            textAlign: "center",
            color: status.startsWith("❌") ? "red" : "#2f80ed",
            fontWeight: 500,
            marginTop: 10,
          }}
        >
          {status}
        </div>
      )}

      {/* Top Grid */}
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
