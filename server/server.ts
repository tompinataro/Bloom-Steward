import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

const port = Number(process.env.PORT) || 5100;
app.listen(port, () => {
  console.log(`Listening on port: ${port}`);
});
