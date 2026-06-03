import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json({ limit: '10mb' }));

  const DATA_FILE = path.join(process.cwd(), 'database.json');

  // Helper to read data
  const readData = () => {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(fileContent);
      }
    } catch (e) {
      console.error('Error reading database file:', e);
    }
    return null;
  };

  // Helper to write data
  const writeData = (data: any) => {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (e) {
      console.error('Error writing database file:', e);
      return false;
    }
  };

  // API endpoints for state synchronization
  app.get('/api/data', (req, res) => {
    const data = readData();
    res.json(data || {});
  });

  app.post('/api/save', (req, res) => {
    const { orders, expenses, transactions, logs, logoConfig } = req.body;
    const success = writeData({ orders, expenses, transactions, logs, logoConfig });
    res.json({ success });
  });

  // Serve Vite in development, static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
