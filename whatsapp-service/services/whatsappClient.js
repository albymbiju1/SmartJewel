const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

let client;
let isReady = false;
let currentQR = null;
let initializationPromise = null;

/**
 * Initialize WhatsApp Client for DigitalOcean Ubuntu Server
 * Optimized for production environment with auto-reconnect
 */
function initClient() {
    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = new Promise((resolve, reject) => {
        console.log('🚀 Initializing WhatsApp client for DigitalOcean Ubuntu...');

        client = new Client({
            authStrategy: new LocalAuth({
                clientId: 'smartjewel',
                dataPath: './.wwebjs_auth'
            }),
            puppeteer: {
                headless: true,
                // Use system Chromium on Ubuntu (installed via apt)
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-software-rasterizer',
                    '--disable-extensions',
                    '--disable-background-networking',
                    '--disable-default-apps',
                    '--disable-sync',
                    '--disable-translate',
                    '--hide-scrollbars',
                    '--metrics-recording-only',
                    '--mute-audio',
                    '--no-first-run',
                    '--safebrowsing-disable-auto-update',
                    '--ignore-certificate-errors',
                    '--ignore-ssl-errors',
                    '--ignore-certificate-errors-spki-list'
                ],
                timeout: 60000
            }
        });

        // QR Code Generation
        client.on('qr', (qr) => {
            currentQR = qr;
            console.log('\n📱 QR Code generated! Visit /qr endpoint to scan\n');
            qrcode.generate(qr, { small: true });
            console.log('\n⏳ Waiting for QR scan...\n');
        });

        // Client Ready
        client.on('ready', () => {
            currentQR = null;
            isReady = true;
            console.log('✅ WhatsApp client is ready and authenticated!');
            resolve(client);
        });

        // Authentication Success
        client.on('authenticated', () => {
            console.log('✅ WhatsApp authenticated successfully!');
        });

        // Authentication Failure - Auto Recovery
        client.on('auth_failure', (msg) => {
            console.error('❌ Authentication failed:', msg);
            currentQR = null;
            isReady = false;

            console.log('⚠️ Attempting to reinitialize client in 10 seconds...');
            setTimeout(() => {
                try {
                    initializationPromise = null;
                    initClient();
                } catch (err) {
                    console.error('Failed to reinitialize after auth failure:', err);
                }
            }, 10000);
        });

        // Disconnection Handler - Auto Reconnect
        client.on('disconnected', (reason) => {
            console.log('❌ WhatsApp disconnected:', reason);
            currentQR = null;
            isReady = false;

            console.log('⚠️ Attempting to reconnect in 15 seconds...');
            setTimeout(() => {
                try {
                    initializationPromise = null;
                    initClient();
                } catch (err) {
                    console.error('Failed to reconnect after disconnection:', err);
                }
            }, 15000);
        });

        // Connection State Changes
        client.on('change_state', (state) => {
            console.log('🔄 Connection state changed:', state);
        });

        // Loading Screen Progress
        client.on('loading_screen', (percent, message) => {
            console.log(`⏳ Loading: ${percent}% - ${message}`);
        });

        // Initialize the client
        client.initialize().catch((err) => {
            console.error('❌ Failed to initialize WhatsApp client:', err);
            initializationPromise = null;
            reject(err);
        });
    });

    return initializationPromise;
}

/**
 * Helper function to format phone numbers to WhatsApp format
 * Assumes Indian phone numbers (+91)
 */
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

/**
 * Send registration confirmation message
 */
async function sendRegistrationMessage(name, phone) {
    if (!isReady || !client) {
        throw new Error('WhatsApp client is not ready');
    }

    const formattedNumber = formatPhoneNumber(phone);

    const message = `🎉 *Welcome to SmartJewel!*\n\nHi *${name}*,\n\nThank you for registering with us!\n\nYour account has been created successfully. You can now browse our exclusive collection of jewelry and make purchases.\n\n✨ Happy Shopping!\n\n_SmartJewel Team_`;

    console.log(`📤 Sending registration message to ${formattedNumber}...`);

    await client.sendMessage(formattedNumber, message);

    console.log(`✅ Registration message sent to ${name} (${phone})`);

    return {
        success: true,
        name,
        phone: formattedNumber
    };
}

/**
 * Send order confirmation message
 */
async function sendOrderMessage(name, phone, orderId, items, total) {
    if (!isReady || !client) {
        throw new Error('WhatsApp client is not ready');
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

    console.log(`📤 Sending order confirmation to ${formattedNumber}...`);

    await client.sendMessage(formattedNumber, message);

    console.log(`✅ Order confirmation sent to ${name} (${phone})`);

    return {
        success: true,
        name,
        phone: formattedNumber,
        orderId
    };
}

/**
 * Get current client status
 */
function getClientStatus() {
    return {
        ready: isReady,
        needsAuth: currentQR !== null,
        qr: currentQR
    };
}

/**
 * Get the current QR code
 */
function getCurrentQR() {
    return currentQR;
}

/**
 * Check if client is ready
 */
function isClientReady() {
    return isReady;
}

module.exports = {
    initClient,
    sendRegistrationMessage,
    sendOrderMessage,
    getClientStatus,
    getCurrentQR,
    isClientReady
};
