// aws-test.js
import { CloudWatchClient, ListMetricsCommand } from '@aws-sdk/client-cloudwatch';
import dotenv from 'dotenv';

dotenv.config();

console.log('🔍 Testing AWS credentials...');
console.log('Access Key:', process.env.AWS_ACCESS_KEY_ID ? 'Found ✅' : 'Missing ❌');
console.log('Secret Key:', process.env.AWS_SECRET_ACCESS_KEY ? 'Found ✅' : 'Missing ❌');
console.log('Region:', process.env.AWS_REGION || 'Missing ❌');

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.log('\n❌ Please create .env file with your AWS credentials:');
  console.log('AWS_ACCESS_KEY_ID=your_real_access_key');
  console.log('AWS_SECRET_ACCESS_KEY=your_real_secret_key');
  console.log('AWS_REGION=us-east-1');
  process.exit(1);
}

const cloudWatchClient = new CloudWatchClient({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.AWS_REGION,
});

console.log('\n🚀 Testing AWS CloudWatch connection...');

async function testCloudWatchConnection() {
  try {
    const command = new ListMetricsCommand({ Namespace: 'AWS/EC2' });
    const response = await cloudWatchClient.send(command);
    console.log('\n✅ AWS CloudWatch connection successful!');
    console.log(`📊 Found ${response.Metrics?.length || 0} metrics in your AWS account`);
    console.log('\n🎉 Ready to integrate with GreenVision Cloud!');
  } catch (err) {
    console.error('\n❌ AWS Connection Failed:', err.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check your AWS credentials are correct');
    console.log('2. Ensure your IAM user has CloudWatchReadOnlyAccess policy');
    console.log('3. Verify your region is correct');
  }
}

testCloudWatchConnection();
