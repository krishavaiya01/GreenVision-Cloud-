import React, { useEffect, useState } from "react";
import { cloudApi } from "../../../services/api/cloudApi";
import { Typography, CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from "@mui/material";

export default function AwsResources() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await cloudApi.getCloudProviderData();
        setData(res);
      } catch (e) {
        setError(e?.message || "Failed to load AWS data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <CircularProgress />;
  if (error) return <Typography color="error">{error}</Typography>;

  const aws = data?.data?.aws || data?.aws || [];

  return (
    <>
      <Typography variant="h5" gutterBottom>AWS Resources</Typography>
      {Array.isArray(aws) && aws.length > 0 ? (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Instance ID</TableCell>
                <TableCell>State</TableCell>
                <TableCell>Public IP</TableCell>
                <TableCell>Private IP</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Launched</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {aws.flatMap(r => r.Instances || []).map((i) => (
                <TableRow key={i.InstanceId}>
                  <TableCell>{i.InstanceId}</TableCell>
                  <TableCell>{i.State?.Name}</TableCell>
                  <TableCell>{i.PublicIpAddress || "-"}</TableCell>
                  <TableCell>{i.PrivateIpAddress || "-"}</TableCell>
                  <TableCell>{i.InstanceType}</TableCell>
                  <TableCell>{i.LaunchTime ? new Date(i.LaunchTime).toLocaleString() : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography>No AWS instances found.</Typography>
      )}
    </>
  );
}
