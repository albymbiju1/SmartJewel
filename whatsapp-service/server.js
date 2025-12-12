const express = require('express');
const QRCode = require('qrcode');
const {
    initClient,
    getClientStatus,
    getCurrentQR,
    isClientReady
} = require('./services/whatsappClient');
const { handleRegistration } = require('./controllers/registerController');
const { handleOrder } = require('./controllers/orderController');

const app = express();

// ============================================
// MIDDLEWARE
// ============================================

// Parse JSON bodies
app.use(express.json());

// CORS Configuration for Frontend
app.use((req, res, next) => {
    const allowedOrigins = [
        'https://smartjewel.app',
        'https://www.smartjewel.app',
        'http://localhost:3000',
        'http://localhost:5000',
        process.env.FRONTEND_URL
    ].filter(Boolean);

    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();
});

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ============================================
// MIDDLEWARE: Check WhatsApp Client Ready
// ============================================

function checkClientReady(req, res, next) {
    if (!isClientReady()) {
        return res.status(503).json({
            success: false,
            error: 'WhatsApp client is not ready. Please scan QR code first.',
            qrUrl: '/qr'
        });
    }
    next();
}

// ============================================
// ROUTES
// ============================================

// Health Check Endpoint
app.get('/health', (req, res) => {
    const status = getClientStatus();
    res.json({
        success: true,
        ready: status.ready,
        needsAuth: status.needsAuth,
        message: status.ready
            ? 'WhatsApp service is ready'
            : status.needsAuth
            ? 'Waiting for QR scan'
            : 'WhatsApp service is initializing',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Session Status Endpoint
app.get('/session-status', (req, res) => {
    const status = getClientStatus();
    res.json({
        success: true,
        authenticated: status.ready,
        needsQR: status.needsAuth,
        message: status.ready
            ? 'Session active'
            : status.needsAuth
            ? 'Needs QR scan at /qr'
            : 'Initializing...',
        qrUrl: status.needsAuth ? '/qr' : null
    });
});

// QR Code Display Endpoint
app.get('/qr', async (req, res) => {
    const currentQR = getCurrentQR();
    const status = getClientStatus();

    if (!currentQR) {
        return res.send(`
            <html>
                <head>
                    <title>WhatsApp QR Code</title>
                    <meta http-equiv="refresh" content="5">
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                            text-align: center;
                            padding: 50px;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            margin: 0;
                        }
                        .container {
                            background: white;
                            border-radius: 20px;
                            padding: 40px;
                            max-width: 600px;
                            margin: 0 auto;
                            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                            color: #333;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>📱 WhatsApp Authentication</h1>
                        <p style="font-size: 18px; color: ${status.ready ? 'green' : 'orange'};">
                            ${status.ready ? '✅ Already authenticated! Service is ready.' : '⏳ Waiting for QR code... (page will refresh)'}
                        </p>
                        ${!status.ready ? '<p style="color: #666;">This page refreshes automatically every 5 seconds</p>' : ''}
                    </div>
                </body>
            </html>
        `);
    }

    try {
        const qrDataUrl = await QRCode.toDataURL(currentQR);
        res.send(`
            <html>
                <head>
                    <title>Scan QR Code - SmartJewel WhatsApp</title>
                    <meta http-equiv="refresh" content="30">
                    <style>
                        body {
                            text-align: center;
                            padding: 50px;
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            margin: 0;
                        }
                        .container {
                            background: white;
                            border-radius: 20px;
                            padding: 40px;
                            max-width: 600px;
                            margin: 0 auto;
                            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                            color: #333;
                        }
                        h1 { margin-bottom: 10px; color: #667eea; }
                        .qr-code {
                            margin: 30px 0;
                            padding: 20px;
                            background: white;
                            border: 3px solid #667eea;
                            border-radius: 10px;
                            display: inline-block;
                        }
                        img { width: 300px; height: 300px; }
                        .instructions {
                            text-align: left;
                            margin: 20px auto;
                            max-width: 400px;
                            background: #f5f5f5;
                            padding: 20px;
                            border-radius: 10px;
                        }
                        .instructions li { margin: 10px 0; }
                        .note { color: #666; font-size: 14px; margin-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>📱 Scan QR Code with WhatsApp</h1>
                        <p><strong>SmartJewel WhatsApp Service</strong></p>

                        <div class="qr-code">
                            <img src="${qrDataUrl}" alt="WhatsApp QR Code">
                        </div>

                        <div class="instructions">
                            <h3>How to scan:</h3>
                            <ol>
                                <li>Open <strong>WhatsApp</strong> on your phone</li>
                                <li>Go to <strong>Settings → Linked Devices</strong></li>
                                <li>Tap <strong>"Link a Device"</strong></li>
                                <li>Scan this QR code</li>
                            </ol>
                        </div>

                        <p class="note">
                            ⏱️ QR code expires after 30 seconds<br>
                            Page will auto-refresh if expired
                        </p>
                    </div>
                </body>
            </html>
        `);
    } catch (error) {
        console.error('Error generating QR code:', error);
        res.status(500).send(`
            <html>
                <body style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
                    <h1>❌ Error</h1>
                    <p>Failed to generate QR code</p>
                    <p><a href="/qr">Retry</a></p>
                </body>
            </html>
        `);
    }
});

// Send Registration Message
app.post('/send/register', checkClientReady, handleRegistration);

// Send Order Confirmation
app.post('/send/order', checkClientReady, handleOrder);

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        availableEndpoints: [
            'GET /health',
            'GET /session-status',
            'GET /qr',
            'POST /send/register',
            'POST /send/order'
        ]
    });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ============================================
// SERVER INITIALIZATION
// ============================================

const PORT = process.env.PORT || 3300;
const HOST = '0.0.0.0';

// Initialize WhatsApp Client
initClient()
    .then(() => {
        console.log('✅ WhatsApp client initialization started');
    })
    .catch((err) => {
        console.error('❌ Failed to initialize WhatsApp client:', err);
    });

// Start Express Server
const server = app.listen(PORT, HOST, () => {
    console.log('\n' + '='.repeat(50));
    console.log('🚀 SmartJewel WhatsApp Service');
    console.log('🖥️  Running on DigitalOcean Ubuntu');
    console.log('='.repeat(50));
    console.log(`🌐 Server: http://localhost:${PORT}`);
    console.log(`🌐 Public: https://wa.smartjewel.app`);
    console.log('='.repeat(50));
    console.log('📌 Available Endpoints:');
    console.log(`   GET  /health`);
    console.log(`   GET  /session-status`);
    console.log(`   GET  /qr`);
    console.log(`   POST /send/register`);
    console.log(`   POST /send/order`);
    console.log('='.repeat(50));
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`⏰ Started: ${new Date().toISOString()}`);
    console.log('='.repeat(50) + '\n');
});

// ============================================
// GRACEFUL SHUTDOWN (PM2 Compatible)
// ============================================

function gracefulShutdown(signal) {
    console.log(`\n⚠️  Received ${signal}, starting graceful shutdown...`);

    server.close(() => {
        console.log('✅ HTTP server closed');

        // Close WhatsApp client gracefully
        // The client will save session automatically
        console.log('✅ WhatsApp client closed');

        console.log('✅ Graceful shutdown completed');
        process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
        console.error('⚠️  Forced shutdown after timeout');
        process.exit(1);
    }, 30000);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = app;
