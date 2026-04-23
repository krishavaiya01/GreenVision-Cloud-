// src/pages/dashboard/CloudMonitoring.jsx
import React from "react";
import { Tabs, Tab, Box } from "@mui/material";
import { useLocation, useNavigate, Outlet, Routes, Route } from "react-router-dom";
import DashboardLayout from "../../components/common/Layout/DashboardLayout";
import AwsResources from "./cloud-monitoring/AwsResources";
import AzureResources from "./cloud-monitoring/AzureResources";
import GcpResources from "./cloud-monitoring/GcpResources";

export default function CloudMonitoring() {
  const location = useLocation();
  const navigate = useNavigate();
  const current = location.pathname.split("/").pop();
  const value = ["aws", "azure", "gcp"].includes(current) ? current : "aws";
  const onChange = (_e, newVal) => { navigate(`/cloud-monitoring/${newVal}`); };
  return (
    <DashboardLayout>
      <Box sx={{ p: 2, maxWidth: 1500, margin: "0 auto" }}>
        <Tabs value={value} onChange={onChange} sx={{ mb: 2 }}>
          <Tab value="aws" label="AWS" />
          <Tab value="azure" label="Azure" />
          <Tab value="gcp" label="GCP" />
        </Tabs>
        <Routes>
          <Route path="aws" element={<AwsResources />} />
          <Route path="azure" element={<AzureResources />} />
          <Route path="gcp" element={<GcpResources />} />
        </Routes>
        <Outlet />
      </Box>
    </DashboardLayout>
  );
}
