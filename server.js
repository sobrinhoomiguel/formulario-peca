// server.js - Backend Node.js para Railway
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/img', express.static('public/img'));

// Configuração correta do PostgreSQL no Railway
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }   // SEM CONDICIONAL, Railway exige SSL sempre
});

// Criar tabelas se não existirem
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS votes (
        id SERIAL PRIMARY KEY,
        movie VARCHAR(50) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vote_counts (
        movie VARCHAR(50) PRIMARY KEY,
        count INTEGER DEFAULT 0
      );
    `);

    const movies = ['Moana', 'Encanto', 'Enrolados'];
    for (const movie of movies) {
      await pool.query(
        `INSERT INTO vote_counts (movie, count)
         VALUES ($1, 0)
         ON CONFLICT (movie) DO NOTHING`,
        [movie]
      );
    }

    console.log('✅ Banco de dados inicializado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
  }
}

// Registrar voto
app.post('/api/vote', async (req, res) => {
  const { movie } = req.body;
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  if (!movie || !['Moana', 'Encanto', 'Enrolados'].includes(movie)) {
    return res.status(400).json({ error: 'Filme inválido' });
  }

  try {
    await pool.query(
      'INSERT INTO votes (movie, ip_address) VALUES ($1, $2)',
      [movie, ipAddress]
    );

    await pool.query(
      'UPDATE vote_counts SET count = count + 1 WHERE movie = $1',
      [movie]
    );

    res.json({ success: true, message: 'Voto registrado com sucesso!' });
  } catch (error) {
    console.error('Erro ao registrar voto:', error);
    res.status(500).json({ error: 'Erro ao registrar voto' });
  }
});

// Resultados
app.get('/api/results', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT movie, count FROM vote_counts ORDER BY count DESC'
    );

    const totalResult = await pool.query('SELECT COUNT(*) as total FROM votes');
    const total = parseInt(totalResult.rows[0].total);

    const results = result.rows.map(row => ({
      movie: row.movie,
      count: parseInt(row.count),
      percentage: total > 0 ? ((row.count / total) * 100).toFixed(1) : 0
    }));

    res.json({ results, total });
  } catch (error) {
    console.error('Erro ao buscar resultados:', error);
    res.status(500).json({ error: 'Erro ao buscar resultados' });
  }
});

// Últimos votos
app.get('/api/recent-votes', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT movie, timestamp FROM votes ORDER BY timestamp DESC LIMIT 50'
    );

    res.json({ votes: result.rows });
  } catch (error) {
    console.error('Erro ao buscar votos recentes:', error);
    res.status(500).json({ error: 'Erro ao buscar votos recentes' });
  }
});

// Reset seguro
app.post('/api/reset', async (req, res) => {
  const { adminPassword } = req.body;

  // AGORA CORRETO! (só aceita a senha do .env)
  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Senha incorreta' });
  }

  try {
    await pool.query('DELETE FROM votes');
    await pool.query('UPDATE vote_counts SET count = 0');

    res.json({ success: true, message: 'Votos resetados com sucesso!' });
  } catch (error) {
    console.error('Erro ao resetar votos:', error);
    res.status(500).json({ error: 'Erro ao resetar votos' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Home
app.get('/', (req, res) => {
  res.send(`
    <h1>🎭 Sistema de Votação SEICE 2026</h1>
    <p><a href="/vote.html">Página de Votação</a></p>
    <p><a href="/admin.html">Painel Admin</a></p>
  `);
});

// Start server
async function startServer() {
  await initDatabase();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
  });
}

startServer();