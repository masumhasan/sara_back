import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AccessToken } from 'livekit-server-sdk';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3001;

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>SARA API - Health Status</title>
      <style>
        :root {
          --bg-color: #0f172a;
          --glass-bg: rgba(30, 41, 59, 0.7);
          --glass-border: rgba(255, 255, 255, 0.1);
          --text-primary: #f8fafc;
          --text-secondary: #94a3b8;
          --accent: #38bdf8;
          --success: #10b981;
        }
        
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        body {
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          background-color: var(--bg-color);
          background-image: 
            radial-gradient(at 0% 0%, rgba(56, 189, 248, 0.15) 0px, transparent 50%),
            radial-gradient(at 100% 100%, rgba(139, 92, 246, 0.15) 0px, transparent 50%);
          color: var(--text-primary);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }

        .container {
          background: var(--glass-bg);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid var(--glass-border);
          border-radius: 24px;
          padding: 3rem;
          width: 100%;
          max-width: 600px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          animation: float 6s ease-in-out infinite;
        }

        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }

        .header {
          text-align: center;
          margin-bottom: 2.5rem;
        }

        h1 {
          font-size: 2.5rem;
          font-weight: 800;
          background: linear-gradient(to right, #38bdf8, #818cf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 0.5rem;
          letter-spacing: -0.025em;
        }

        .subtitle {
          color: var(--text-secondary);
          font-size: 1.1rem;
        }

        .status-card {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid var(--glass-border);
          border-radius: 16px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .status-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .status-info h3 {
          font-size: 1.25rem;
          margin-bottom: 0.25rem;
        }

        .status-info p {
          color: var(--text-secondary);
          font-size: 0.875rem;
        }

        .pulse-indicator {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-weight: 600;
          color: var(--success);
          background: rgba(16, 185, 129, 0.1);
          padding: 0.5rem 1rem;
          border-radius: 9999px;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }

        .pulse-dot {
          width: 10px;
          height: 10px;
          background-color: var(--success);
          border-radius: 50%;
          box-shadow: 0 0 10px var(--success);
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }

        .endpoints {
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid var(--glass-border);
        }
        
        .endpoints h4 {
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-size: 0.75rem;
          margin-bottom: 1rem;
        }

        .endpoint-code {
          background: rgba(0,0,0,0.3);
          padding: 1rem;
          border-radius: 8px;
          font-family: monospace;
          color: var(--accent);
          font-size: 0.9rem;
          border: 1px solid rgba(255,255,255,0.05);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>SARA Backend Core</h1>
          <p class="subtitle">Next-Generation Voice AI Orchestration</p>
        </div>
        
        <div class="status-card">
          <div class="status-info">
            <h3>API System Status</h3>
            <p>All core services and routes are operational</p>
          </div>
          <div class="pulse-indicator">
            <div class="pulse-dot"></div>
            Online
          </div>
        </div>

        <div class="endpoints">
          <h4>Available Endpoints</h4>
          <div class="endpoint-code">
            GET /api/token?room=[room]&username=[user]
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
});

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

export default app;
