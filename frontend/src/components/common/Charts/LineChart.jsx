// src/components/common/Charts/LineChart.jsx
import React from "react";
import { Line } from "react-chartjs-2";
// Chart.js should be globally registered in your main project if not done here
export default function LineChart({ data, options, height = 300 }) {
  return <Line data={data} options={options} height={height} />;
}
