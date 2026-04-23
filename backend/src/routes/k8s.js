import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getClusterInventory, listClusters, connectCluster, getProviderPods } from '../services/k8s-service.js';

const router = express.Router();
router.use(protect());

// GET /api/k8s/clusters
router.get('/clusters', async (req, res) => {
  try {
    const clusters = await listClusters(req.user.id);
    res.json({ success: true, data: clusters });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to list clusters', error: e.message });
  }
});

// GET /api/k8s/:provider/inventory
router.get('/:provider/inventory', async (req, res) => {
  try {
    const provider = String(req.params.provider || '').toLowerCase();
    if (!['aws','azure','gcp'].includes(provider)) {
      return res.status(400).json({ success: false, message: 'Invalid provider' });
    }
    const inventory = await getClusterInventory(req.user.id, provider);
    res.json({ success: true, data: inventory });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to get inventory', error: e.message });
  }
});

export default router;

// POST /api/k8s/connect
router.post('/connect', async (req, res) => {
  try {
    const { provider, name, kubeconfig } = req.body || {};
    if (!provider || !name || !kubeconfig) return res.status(400).json({ success:false, message:'provider, name, kubeconfig required' });
    const cluster = await connectCluster(req.user.id, { provider: String(provider).toLowerCase(), name, kubeconfigContent: kubeconfig });
    res.json({ success: true, data: cluster });
  } catch (e) {
    res.status(500).json({ success:false, message:'Failed to connect cluster', error: e.message });
  }
});

// GET /api/k8s/:provider/pods
router.get('/:provider/pods', async (req, res) => {
  try {
    const provider = String(req.params.provider || '').toLowerCase();
    if (!['aws','azure','gcp'].includes(provider)) {
      return res.status(400).json({ success: false, message: 'Invalid provider' });
    }
    const pods = await getProviderPods(req.user.id, provider);
    res.json({ success: true, data: pods });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to list pods', error: e.message });
  }
});
