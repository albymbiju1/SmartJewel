const { sendRegistrationMessage } = require('../services/whatsappClient');

/**
 * Handle registration message sending
 * POST /send/register
 */
async function handleRegistration(req, res) {
    try {
        const { name, phone } = req.body;

        // Validate input
        if (!name || !phone) {
            return res.status(400).json({
                success: false,
                error: 'Name and phone are required'
            });
        }

        // Send registration message
        const result = await sendRegistrationMessage(name, phone);

        res.json({
            success: true,
            message: 'Registration message sent successfully',
            data: result
        });

    } catch (error) {
        console.error('❌ Error in registration controller:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send registration message'
        });
    }
}

module.exports = { handleRegistration };
