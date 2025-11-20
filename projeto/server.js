// server.js - Backend Node.js para Railway
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Para servir arquivos estáticos

// Configuração do banco de dados PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
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

    // Inicializa contadores se não existirem
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

// Rota para registrar voto
app.post('/api/vote', async (req, res) => {
  const { movie } = req.body;
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  if (!movie || !['Moana', 'Encanto', 'Enrolados'].includes(movie)) {
    return res.status(400).json({ error: 'Filme inválido' });
  }

  try {
    // Registra o voto individual
    await pool.query(
      'INSERT INTO votes (movie, ip_address) VALUES ($1, $2)',
      [movie, ipAddress]
    );

    // Incrementa contador
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

// Rota para obter resultados
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
      percentage: total > 0 ? ((parseInt(row.count) / total) * 100).toFixed(1) : 0
    }));

    res.json({
      results,
      total
    });
  } catch (error) {
    console.error('Erro ao buscar resultados:', error);
    res.status(500).json({ error: 'Erro ao buscar resultados' });
  }
});

// Rota para obter últimos votos
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

// Rota para resetar votos (PROTEGIDA - adicione autenticação em produção)
app.post('/api/reset', async (req, res) => {
  const { adminPassword } = req.body;

  // TROQUE ESTA SENHA!
  if (adminPassword !== process.env.ADMIN_PASSWORD || 'seice2026admin') {
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

// Rota de health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rota raiz
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sistema de Votação SEICE 2026</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 50px auto;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .container {
          background: white;
          color: #333;
          padding: 40px;
          border-radius: 15px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        h1 { color: #667eea; margin-bottom: 30px; }
        .link-box {
          background: #f5f5f5;
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
        }
        a {
          color: #667eea;
          text-decoration: none;
          font-weight: bold;
          font-size: 1.1em;
        }
        a:hover { text-decoration: underline; }
        .status {
          display: inline-block;
          background: #28a745;
          color: white;
          padding: 5px 15px;
          border-radius: 20px;
          font-size: 0.9em;
          margin-bottom: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <span class="status">✅ Sistema Online</span>
        <h1>🎭 Sistema de Votação Musical SEICE 2026</h1>
        
        <div class="link-box">
          <h3>📱 Página de Votação</h3>
          <p>Use esta página para que as pessoas votem:</p>
          <a href="/vote.html" target="_blank">Abrir Página de Votação</a>
        </div>

        <div class="link-box">
          <h3>📊 Painel Administrativo</h3>
          <p>Visualize os resultados em tempo real:</p>
          <a href="/admin.html" target="_blank">Abrir Painel Admin</a>
        </div>

        <div class="link-box">
          <h3>🔗 API Endpoints</h3>
          <ul style="line-height: 2;">
            <li><code>POST /api/vote</code> - Registrar voto</li>
            <li><code>GET /api/results</code> - Ver resultados</li>
            <li><code>GET /api/recent-votes</code> - Votos recentes</li>
            <li><code>POST /api/reset</code> - Resetar votos</li>
          </ul>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Inicializa o servidor
async function startServer() {
  await initDatabase();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    🚀 Servidor rodando na porta ${PORT}
    📊 Health check: http://localhost:${PORT}/health
    🗳️  Votação: http://localhost:${PORT}/vote.html
    👨‍💼 Admin: http://localhost:${PORT}/admin.html
    `);
  });
}

startServer();