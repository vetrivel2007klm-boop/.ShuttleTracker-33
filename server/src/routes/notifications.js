const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/notifications - Get notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const notifs = await db.getNotifications(req.user.userId);
    res.json({ success: true, count: notifs.length, data: notifs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve notifications.' });
  }
});

// POST /api/notifications/broadcast - Admin broadcast alert
router.post('/broadcast', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { title, message, type = 'info', shuttle_id } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required.' });
    }

    const newNotif = await db.createNotification({
      title,
      message,
      type,
      shuttle_id: shuttle_id ? Number(shuttle_id) : null
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('notification:new', newNotif);
    }

    res.status(201).json({ success: true, message: 'Notification broadcasted successfully.', data: newNotif });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to broadcast notification.' });
  }
});

// PUT /api/notifications/:id/read - Mark one as read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const updated = await db.markNotificationRead(req.params.id);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to mark notification as read.' });
  }
});

// PUT /api/notifications/read-all - Mark all as read
router.put('/read-all', authenticate, async (req, res) => {
  try {
    await db.markAllNotificationsRead();
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to mark notifications.' });
  }
});

module.exports = router;
