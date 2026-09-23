import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AccessToken } from 'livekit-server-sdk';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3001;

app.get('/api/token', async (req, res) => {
  const roomName = req.query.room || 'sara-room';
  const participantName = req.query.username || 'Masum';

  if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
    return res.status(500).json({ error: "LiveKit credentials not found" });
  }

  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity: participantName,
    }
  );

  at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true, canPublishData: true });
  
  const token = await at.toJwt();
  res.json({ token });
});

app.listen(port, () => {
  console.log(`Token API server listening on port ${port}`);
});
