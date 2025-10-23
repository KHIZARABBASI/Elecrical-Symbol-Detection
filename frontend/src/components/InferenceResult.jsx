import React, { useEffect, useState, useMemo } from "react";

export default function InferenceResult({ data }) {
  const BACKEND = "http://127.0.0.1:8000";
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
      const pageData = data.pages.find(p => p.page === currentPage);
      if (pageData?.url) {
        const url = pageData.url.startsWith('/') 
          ? `${BACKEND}${pageData.url}`
          : `${BACKEND}/${pageData.url}`;
        setImageUrl(url);
        console.log('Image URL set:', url);
      }
    } else if (data?.preview) {
      const url = data.preview.startsWith('/') 
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
      const label = d.label || d.class_name || d.name || d.cls || "Unknown";
      const conf = typeof d.confidence === "number" ? d.confidence : (d.conf || 0);
      if (!map.has(label)) {
        map.set(label, { label, count: 0, confidences: [] });
      }
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

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  const handleZoomReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div>
      <div className="inference-header"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="radio-list" style={{ display: "flex", gap: 12 }}>
          {detectedItems.length > 0 ? (
            detectedItems.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 8,
                    background: colorMap[item.label] || colorMap["Unknown"],
                    display: "inline-block",
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
          <div className="small-muted">Page</div>
          <input
            type="number"
            min="1"
            max={totalPages}
            value={currentPage}
            onChange={(e) => setCurrentPage(Number(e.target.value))}
            style={{
              width: 64,
              padding: 6,
              border: "1px solid var(--border)",
              borderRadius: 4,
            }}
          />
          <div className="small-muted">of {totalPages}</div>
        </div>
      </div>

      <div className="zoom-controls" style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: 8,
        marginTop: 12
      }}>
        <button onClick={handleZoomOut} disabled={scale <= 0.5}>-</button>
        <button onClick={handleZoomReset}>{Math.round(scale * 100)}%</button>
        <button onClick={handleZoomIn} disabled={scale >= 3}>+</button>
      </div>

      <div
        className="preview-area"
        style={{
          position: 'relative',
          marginTop: 12,
          height: "500px",
          overflow: "hidden",
          border: "1px solid var(--border)",
          borderRadius: 6,
          backgroundColor: "#f8f9fa",
          cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {imageUrl ? (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <img
              src={imageUrl}
              alt={`Page ${currentPage}`}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                transition: isDragging ? "none" : "transform 0.2s",
              }}
              draggable={false}
              onError={(e) => {
                console.error('Image failed to load:', imageUrl);
                e.target.style.display = 'none';
              }}
            />
          </div>
        ) : (
          <div style={{
            padding: 40,
            textAlign: "center",
            color: "#666",
          }}>
            No preview available
          </div>
        )}
      </div>

      <div style={{ 
        display: "flex", 
        justifyContent: "center", 
        gap: 8, 
        marginTop: 12 
      }}>
        <button
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
        >
          Previous
        </button>
        <button
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}