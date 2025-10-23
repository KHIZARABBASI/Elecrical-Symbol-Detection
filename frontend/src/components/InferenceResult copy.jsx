// ...existing code...
import React, { useEffect, useState, useMemo } from "react";

export default function InferenceResult({ data }) {
  const BACKEND = "http://127.0.0.1:8000";
  const [imageUrl, setImageUrl] = useState(null);

  // color map — adjust hex values to match your inference picture exactly
  const colorMap = {
    "Cove Light": "#F59E0B",
    "Door": "#10B981",
    "Downlight": "#2F80ED",
    "Emergency Light Fitting": "#EF4444",
    "Fluorescent Light": "#A78BFA",
    "Socket Outlet": "#F97316",
    "Exit Sign": "#059669",
    "Unknown": "#9CA3AF",
  };

  useEffect(() => {
    if (data && data.preview) {
      setImageUrl(`${BACKEND}${data.preview}`);
    } else {
      setImageUrl(null);
    }
  }, [data]);

  const detectedItems = useMemo(() => {
    if (!data || !Array.isArray(data.detections)) return [];
    const map = new Map();
    data.detections.forEach((d) => {
      const label = d.label || d.class_name || d.name || d.cls || "Unknown";
      const conf = typeof d.confidence === "number" ? d.confidence : (d.conf || 0);
      if (!map.has(label)) map.set(label, { label, count: 0, confidences: [] });
      const entry = map.get(label);
      entry.count += 1;
      entry.confidences.push(conf);
    });
    return Array.from(map.values()).map((e) => ({
      label: e.label,
      count: e.count,
      avgConfidence:
        e.confidences.length > 0
          ? e.confidences.reduce((a, b) => a + b, 0) / e.confidences.length
          : 0,
    }));
  }, [data]);

  return (
    <div>
      <div
        className="inference-header"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <div className="radio-list" style={{ display: "flex", gap: 12 }}>
          {detectedItems.length > 0 ? (
            detectedItems.map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 8,
                    background: colorMap[r.label] || colorMap["Unknown"],
                    display: "inline-block",
                    boxShadow: "0 0 0 2px rgba(0,0,0,0.05)",
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div className="small-muted">{r.label}</div>
                  {/* <div style={{ fontSize: 11, color: "#666" }}>
                    {r.count} • {(r.avgConfidence * 100).toFixed(1)}%
                  </div> */}
                </div>
              </div>
            ))
          ) : (
            <div style={{ color: "#666" }}>No detected items</div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="small-muted">Page</div>
          <input
            type="number"
            min="1"
            max="24"
            defaultValue="1"
            style={{
              width: 64,
              padding: 6,
              border: "1px solid var(--border)",
              borderRadius: 4,
            }}
          />
          <div className="small-muted">of 24</div>
        </div>
      </div>

      <div
        className="preview-area"
        style={{
          marginTop: 12,
          height: "500px",
          overflow: "hidden",
          border: "1px solid var(--border)",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8f9fa",
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Inference output"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              width: "auto",
              height: "auto",
            }}
          />
        ) : (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: "#666",
            }}
          >
            No preview available
          </div>
        )}
      </div>
    </div>
  );
}
// ...existing code...