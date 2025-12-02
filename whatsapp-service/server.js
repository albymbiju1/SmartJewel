const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');

const app = express();
app.use(express.json());

let client;
let isReady = false;
let currentQR = null;

// Initialize WhatsApp Client
console.log('Initializing WhatsApp client...');
client = new Client({
    authStrategy: new LocalAuth({ clientId: 'smartjewel' }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// QR Code Generation
client.on('qr', (qr) => {
    currentQR = qr;
    console.log('\n📱 QR Code generated! Visit /qr endpoint to scan\n');
    qrcode.generate(qr, { small: true });
    console.log('\nWaiting for QR scan...\n');
});

// Client Ready
client.on('ready', () => {
    currentQR = null; // Clear QR after authentication
    isReady = true;
    console.log('✅ WhatsApp client is ready!');
});

// Authentication
client.on('authenticated', () => {
    console.log('✅ WhatsApp authenticated successfully!');
});

// Authentication Failure
client.on('auth_failure', (msg) => {
    console.error('❌ Authentication failed:', msg);
    currentQR = null;
    isReady = false;

    // Try to reinitialize after auth failure
    console.log('⚠️ Attempting to reinitialize client...');
    setTimeout(() => {
        try {
            client.initialize();
        } catch (err) {
            console.error('Failed to reinitialize:', err);
        }
    }, 5000);
});

// Disconnected
client.on('disconnected', (reason) => {
    console.log('❌ WhatsApp disconnected:', reason);
    console.log('Reason:', reason);
    currentQR = null;
    isReady = false;

    // Try to reconnect after disconnection
    console.log('⚠️ Attempting to reconnect...');
    setTimeout(() => {
        try {
            client.initialize();
        } catch (err) {
            console.error('Failed to reconnect:', err);
        }
    }, 10000);
});

// Initialize client
client.initialize();

// Helper function to format phone number
function formatPhoneNumber(phone) {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // If it's a 10-digit number, add 91 (India)
    if (cleaned.length === 10) {
        cleaned = '91' + cleaned;
    }

    // Return in WhatsApp format
    return cleaned + '@c.us';
}

// Middleware to check if client is ready
function checkClientReady(req, res, next) {
    if (!isReady) {
        return res.status(503).json({
            success: false,
            error: 'WhatsApp client is not ready. Please scan QR code first.'
        });
    }
    next();
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        ready: isReady,
        needsAuth: currentQR !== null,
        message: isReady ? 'WhatsApp service is ready' : currentQR ? 'Waiting for QR scan' : 'WhatsApp service is initializing'
    });
});

// Session status endpoint
app.get('/session-status', (req, res) => {
    res.json({
        success: true,
        authenticated: isReady,
        needsQR: currentQR !== null,
        message: isReady ? 'Session active' : currentQR ? 'Needs QR scan at /qr' : 'Initializing...',
        qrUrl: currentQR ? '/qr' : null
    });
});

// QR Code endpoint for production authentication
app.get('/qr', async (req, res) => {
    if (!currentQR) {
        return res.send(`
            <html>
                <head>
                    <title>WhatsApp QR Code</title>
                    <meta http-equiv="refresh" content="5">
                </head>
                <body style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
                    <h1>📱 WhatsApp Authentication</h1>
                    <p style="font-size: 18px; color: ${isReady ? 'green' : 'orange'};">
                        ${isReady ? '✅ Already authenticated! Service is ready.' : '⏳ Waiting for QR code... (page will refresh)'}
                    </p>
                    ${!isReady ? '<p style="color: #666;">This page refreshes automatically every 5 seconds</p>' : ''}
                </body>
            </html>
        `);
    }

    try {
        // Generate QR code as data URL
        const qrDataUrl = await QRCode.toDataURL(currentQR);
        res.send(`
            <html>
                <head>
                    <title>Scan QR Code - WhatsApp</title>
                    <meta http-equiv="refresh" content="30">
                    <style>
                        body {
                            text-align: center;
                            padding: 50px;
                            font-family: Arial, sans-serif;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
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
                        h1 { margin-bottom: 10px; }
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
                        <p>SmartJewel WhatsApp Service</p>

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
                <body style="text-align: center; padding: 50px;">
                    <h1>❌ Error</h1>
                    <p>Failed to generate QR code</p>
                    <p><a href="/qr">Retry</a></p>
                </body>
            </html>
        `);
    }
});

// POST /send/register - Send registration confirmation
app.post('/send/register', checkClientReady, async (req, res) => {
    try {
        const { name, phone } = req.body;

        if (!name || !phone) {
            return res.status(400).json({
                success: false,
                error: 'Name and phone are required'
            });
        }

        const formattedNumber = formatPhoneNumber(phone);

        const message = `🎉 *Welcome to SmartJewel!*\n\nHi *${name}*,\n\nThank you for registering with us!\n\nYour account has been created successfully. You can now browse our exclusive collection of jewelry and make purchases.\n\n✨ Happy Shopping!\n\n_SmartJewel Team_`;

        console.log(`Sending registration message to ${formattedNumber}...`);

        await client.sendMessage(formattedNumber, message);

        console.log(`✅ Registration message sent to ${name} (${phone})`);

        res.json({
            success: true,
            message: 'Registration message sent successfully',
            data: {
                name,
                phone: formattedNumber
            }
        });

    } catch (error) {
        console.error('Error sending registration message:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send message'
        });
    }
});

// POST /send/order - Send order confirmation
app.post('/send/order', checkClientReady, async (req, res) => {
    try {
        const { name, phone, orderId, items, total } = req.body;

        if (!name || !phone || !orderId || !items || !total) {
            return res.status(400).json({
                success: false,
                error: 'All fields are required: name, phone, orderId, items, total'
            });
        }

        const formattedNumber = formatPhoneNumber(phone);

        // Format items list
        let itemsList = '';
        items.forEach((item, index) => {
            itemsList += `${index + 1}. ${item.name} - ₹${item.price} x ${item.quantity}\n`;
        });

        const message = `💎 *SmartJewel Order Confirmation*\n\n` +
            `Hi *${name}*,\n\n` +
            `Your order has been placed successfully! 🎉\n\n` +
            `*Order ID:* ${orderId}\n\n` +
            `*Items Ordered:*\n${itemsList}\n` +
            `*Total Amount:* ₹${total}\n\n` +
            `We'll notify you once your order is ready for pickup/delivery.\n\n` +
            `Thank you for shopping with SmartJewel! ✨\n\n` +
            `_For any queries, reply to this message._`;

        console.log(`Sending order confirmation to ${formattedNumber}...`);

        await client.sendMessage(formattedNumber, message);

        console.log(`✅ Order confirmation sent to ${name} (${phone})`);

        res.json({
            success: true,
            message: 'Order confirmation sent successfully',
            data: {
                name,
                phone: formattedNumber,
                orderId
            }
        });

    } catch (error) {
        console.error('Error sending order message:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send message'
        });
    }
});

// Start server
const PORT = 3300;
app.listen(PORT, () => {
    console.log(`🚀 WhatsApp service running on http://localhost:${PORT}`);
    console.log('Endpoints:');
    console.log('  GET  /health');
    console.log('  POST /send/register');
    console.log('  POST /send/order');
});
