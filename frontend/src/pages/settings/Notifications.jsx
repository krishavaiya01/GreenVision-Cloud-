import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  LinearProgress,
  Button,
} from "@mui/material";
import DashboardLayout from "../../components/common/layout/DashboardLayout";
import { notificationApi } from "../../services/api/notificationApi";
import { toast } from "react-hot-toast";

const defaultPrefs = {
  emailEnabled: true,
  frequency: "daily", // 'daily' | 'weekly' | 'off'
  dailyDigestHour: 9, // 0-23
};

export default function Notifications() {
  const [prefs, setPrefs] = useState(defaultPrefs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const hours = useMemo(
    () => Array.from({ length: 24 }, (_, h) => ({ value: h, label: `${String(h).padStart(2, "0")}:00` })),
    []
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await notificationApi.getPrefs();
        // resp shape: { success, data }
        const data = resp?.data || {};
        if (mounted) setPrefs({ ...defaultPrefs, ...data });
      } catch (e) {
        console.error(e);
        toast.error("Failed to load notification preferences");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function optimisticUpdate(partial) {
    const prev = prefs;
    const next = { ...prefs, ...partial };
    setPrefs(next);
    setSaving(true);
    try {
      const resp = await notificationApi.updatePrefs(partial);
      const server = resp?.data || next;
      setPrefs({ ...defaultPrefs, ...server });
      toast.success("Preferences saved");
    } catch (e) {
      console.error(e);
      setPrefs(prev); // revert
      toast.error(e?.response?.data?.message || "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }

  const handleEmailToggle = (e) => optimisticUpdate({ emailEnabled: e.target.checked });
  const handleFrequency = (_e, value) => {
    if (!value) return; // ignore deselect
    optimisticUpdate({ frequency: value });
  };
  const handleHour = (e) => optimisticUpdate({ dailyDigestHour: Number(e.target.value) });

  return (
    <DashboardLayout title="Notification Preferences">
      <Box display="flex" flexDirection="column" gap={3}>
        {loading && <LinearProgress />}

        <Paper sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
            <Box>
              <Typography variant="h6">Email Reports</Typography>
              <Typography variant="body2" color="text.secondary">
                Receive sustainability reports and alerts via email according to your schedule.
              </Typography>
            </Box>
            <FormControlLabel
              control={<Switch checked={!!prefs.emailEnabled} onChange={handleEmailToggle} />}
              label={prefs.emailEnabled ? "Enabled" : "Disabled"}
            />
          </Stack>
          {saving && <LinearProgress sx={{ mt: 2 }} />}
        </Paper>

        <Paper sx={{ p: 3, opacity: prefs.emailEnabled ? 1 : 0.6, pointerEvents: prefs.emailEnabled ? "auto" : "none" }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Frequency
          </Typography>
          <ToggleButtonGroup
            color="primary"
            exclusive
            value={prefs.frequency}
            onChange={handleFrequency}
            aria-label="email frequency"
            sx={{ mb: 2 }}
          >
            <ToggleButton value="daily">Daily</ToggleButton>
            <ToggleButton value="weekly">Weekly</ToggleButton>
            <ToggleButton value="off">Off</ToggleButton>
          </ToggleButtonGroup>

          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Preferred Send Time
          </Typography>
          <Select
            value={Number(prefs.dailyDigestHour)}
            onChange={handleHour}
            sx={{ width: 200 }}
            aria-label="daily digest hour"
          >
            {hours.map((h) => (
              <MenuItem key={h.value} value={h.value}>
                {h.label}
              </MenuItem>
            ))}
          </Select>

          <Box mt={2}>
            <Typography variant="body2" color="text.secondary">
              Daily reports are sent on your chosen hour if frequency is Daily. Weekly reports are sent on your chosen hour according to the weekly schedule.
            </Typography>
          </Box>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              onClick={async () => {
                setLoading(true);
                try {
                  const resp = await notificationApi.getPrefs();
                  const data = resp?.data || {};
                  setPrefs({ ...defaultPrefs, ...data });
                  toast.success("Preferences reloaded");
                } catch (e) {
                  console.error(e);
                  toast.error("Failed to reload preferences");
                } finally {
                  setLoading(false);
                }
              }}
            >
              Reload
            </Button>
          </Stack>
        </Paper>
      </Box>
    </DashboardLayout>
  );
}
