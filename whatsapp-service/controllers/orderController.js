const { sendOrderMessage } = require('../services/whatsappClient');

/**
 * Handle order confirmation message sending
 * POST /send/order
 */
async function handleOrder(req, res) {
    try {
        const { name, phone, orderId, items, total } = req.body;

        // Validate input
        if (!name || !phone || !orderId || !items || !total) {
            return res.status(400).json({
                success: false,
                error: 'All fields are required: name, phone, orderId, items, total'
            });
        }

        // Validate items array
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Items must be a non-empty array'
            });
        }

        // Send order confirmation message
        const result = await sendOrderMessage(name, phone, orderId, items, total);

        res.json({
            success: true,
            message: 'Order confirmation sent successfully',
            data: result
        });

    } catch (error) {
        console.error('❌ Error in order controller:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send order confirmation'
        });
    }
}

module.exports = { handleOrder };
