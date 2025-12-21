const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  
  // Find user
  const User = mongoose.model('User', new mongoose.Schema({
    id: String,
    email: String,
    points: Number
  }));
  
  const user = await User.findOne({ email: 'dataliendoanh@gmail.com' });
  if (!user) {
    console.log('User not found');
    process.exit(1);
  }
  
  console.log('Found user:', user.id, user.email, 'current points:', user.points);
  
  // Set account points to 1000 but legitimate to 0 (invalid!)
  await User.updateOne({ id: user.id }, { $set: { points: 1000 } });
  
  // Set legitimate points to 0
  const LegitimatePoints = mongoose.model('LegitimatePoints', new mongoose.Schema({
    userId: String,
    totalLegitimatePoints: Number,
    totalPointsUsed: Number
  }));
  
  await LegitimatePoints.updateOne(
    { userId: user.id },
    { $set: { totalLegitimatePoints: 0, totalPointsUsed: 0 } },
    { upsert: true }
  );
  
  console.log('Set user points: Account=1000, Legitimate=0 (INVALID)');
  console.log('User ID:', user.id);
  
  await mongoose.disconnect();
}

run().catch(console.error);
