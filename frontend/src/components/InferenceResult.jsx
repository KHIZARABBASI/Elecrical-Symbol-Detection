import React, { useEffect, useState, useMemo } from "react";

export default function InferenceResult({ data }) {
  const BACKEND = "http://127.0.0.1:8000"; // ✅ base URL only
  const [imageUrl, setImageUrl] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

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
    if (data?.pages?.length > 0) {
      setTotalPages(data.pages.length);
      const pageData = data.pages.find((p) => p.page === currentPage);
      if (pageData?.url) {
        const url = pageData.url.startsWith("/")
          ? `${BACKEND}${pageData.url}`
          : `${BACKEND}/${pageData.url}`;
        setImageUrl(url);
      }
    } else if (data?.preview) {
      const url = data.preview.startsWith("/")
        ? `${BACKEND}${data.preview}`
        : `${BACKEND}/${data.preview}`;
      setImageUrl(url);
      setTotalPages(1);
    }
  }, [data, currentPage]);

  const detectedItems = useMemo(() => {
    if (!data || !Array.isArray(data.detections)) return [];
    const map = new Map();
    data.detections.forEach((d) => {
      const label = d.class_name || "Unknown";
      const conf = d.confidence || 0;
      if (!map.has(label)) map.set(label, { label, count: 0, confidences: [] });
      const entry = map.get(label);
      entry.count++;
      entry.confidences.push(conf);
    });
    return Array.from(map.values()).map((e) => ({
      label: e.label,
      count: e.count,
      avgConfidence: e.confidences.reduce((a, b) => a + b, 0) / e.confidences.length,
    }));
  }, [data]);

  const handleZoomIn = () => setScale((p) => Math.min(p + 0.25, 3));
  const handleZoomOut = () => setScale((p) => Math.max(p - 0.25, 0.5));
  const handleZoomReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div>
      {/* ====== Header ====== */}
      <div
        className="inference-header"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <div style={{ display: "flex", gap: 12 }}>
          {detectedItems.length > 0 ? (
            detectedItems.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 8,
                    background: colorMap[item.label] || "#9CA3AF",
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div className="small-muted">{item.label}</div>
                  <div style={{ fontSize: 11, color: "#666" }}>
                    {item.count} • {(item.avgConfidence * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ color: "#666" }}>No detected items</div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>Page</span>
          <input
            type="number"
            min="1"
            max={totalPages}
            value={currentPage}
            onChange={(e) => setCurrentPage(Number(e.target.value))}
            style={{ width: 64, padding: 6 }}
          />
          <span>of {totalPages}</span>
        </div>
      </div>

      {/* ====== Zoom Controls ====== */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
        <button onClick={handleZoomOut}>-</button>
        <button onClick={handleZoomReset}>{Math.round(scale * 100)}%</button>
        <button onClick={handleZoomIn}>+</button>
      </div>

      {/* ====== Image Viewer ====== */}
      <div
        className="preview-area"
        style={{
          position: "relative",
          marginTop: 12,
          height: "500px",
          overflow: "hidden",
          border: "1px solid #ddd",
          borderRadius: 6,
          backgroundColor: "#f8f9fa",
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`Page ${currentPage}`}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              transform: `scale(${scale})`,
              transition: "transform 0.2s",
            }}
          />
        ) : (
          <div style={{ textAlign: "center", padding: 40 }}>No preview available</div>
        )}
      </div>

      {/* ====== Pagination ====== */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
        <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
          Previous
        </button>
        <button
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}
