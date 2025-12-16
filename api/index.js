const express = require('express');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'YouTube API Service',
    endpoints: {
      youtube: 'POST /youtube',
      status: 'GET /status'
    }
  });
});

// Status endpoint
app.get('/status', (req, res) => {
  res.json({
    status: 'OK',
    service: 'YouTube API',
    timestamp: new Date().toISOString()
  });
});

// Import YouTube API
const youtubeRouter = require('./youtube');
app.use('/youtube', youtubeRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: err.message
  });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
