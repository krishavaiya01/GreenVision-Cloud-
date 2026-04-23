import mongoose from 'mongoose';

const K8sClusterSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  provider: { type: String, enum: ['aws','azure','gcp'], required: true },
  name: { type: String, required: true },
  region: { type: String, default: 'us-east-1' },
  context: { type: String },
  namespace: { type: String, default: 'default' },
  kubeconfigPath: { type: String },
  accountId: { type: String },
  // For security, we do not store kubeconfig raw in this demo. Use a secret store in production.
  storedSecurely: { type: Boolean, default: false },
  connected: { type: Boolean, default: false },
  lastSeen: { type: Date },
  metadata: { type: Object, default: {} }
}, { timestamps: true, versionKey: false });

K8sClusterSchema.index({ userId: 1, provider: 1, name: 1 }, { unique: false });

export default mongoose.model('K8sCluster', K8sClusterSchema);
