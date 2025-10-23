import React, { useMemo } from 'react';

export default function DetectionOverview({ data = [] }) {
  // Group detections by class name and count occurrences
  const detectionSummary = useMemo(() => {
    const summary = {};
    
    if (!data) return [];

    // Group by class_name and count
    data.forEach(detection => {
      const className = detection.class_name;
      if (!summary[className]) {
        summary[className] = {
          cls: className,
          count: 0,
          confidence: []
        };
      }
      summary[className].count++;
      summary[className].confidence.push(detection.confidence);
    });

    // Convert to array and sort by count
    return Object.values(summary).sort((a, b) => b.count - a.count);
  }, [data]);

  return (
    <div>
      <div className="detection-title-row">
        <div style={{fontWeight: 700}}>Detection Overview</div>
        <button 
          className="btn-small export-btn"
          onClick={() => {
            // Add export logic here
            console.log('Exporting data:', detectionSummary);
          }}
        >
          <i className="pi pi-download" style={{marginRight: 8}}></i>
          Export CSV
        </button>
      </div>

      <div className="detection-table">
        <div className="detection-row header">
          <div>Class</div>
          <div>Count</div>
          <div>Avg Confidence</div>
        </div>

        {detectionSummary.map((row, idx) => (
          <div className="detection-row" key={idx}>
            <div>{row.cls}</div>
            <div>{row.count}</div>
            <div>
              {(row.confidence.reduce((a, b) => a + b, 0) / row.confidence.length * 100).toFixed(1)}%
            </div>
          </div>
        ))}

        {detectionSummary.length === 0 && (
          <div className="detection-row empty">
            <div colSpan="3" style={{textAlign: 'center', color: '#666'}}>
              No detections available
            </div>
          </div>
        )}
      </div>
    </div>
  );
}