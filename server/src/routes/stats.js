const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, optionalAuthenticate, authorize } = require('../middleware/auth');

// GET /api/stats/organizations - List all registered organizations & their ID format availability
router.get('/organizations', async (req, res) => {
  try {
    const organizations = await db.getAllOrganizations();
    res.json({ success: true, count: organizations.length, data: organizations });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve organizations.' });
  }
});

// GET /api/stats/dashboard - Dashboard metrics (scoped by organization_name when provided)
router.get('/dashboard', authenticate, authorize('admin'), async (req, res) => {
  try {
    const orgName = req.query.organization_name || req.user?.organization_name || null;
    const stats = await db.getDashboardStats(orgName);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve dashboard metrics.' });
  }
});

// GET /api/stats/schedules - Schedules list (with cumulative monthly/yearly driver points, ordered so first-added is last)
router.get('/schedules', optionalAuthenticate, async (req, res) => {
  try {
    const orgName = req.query.organization_name || req.user?.organization_name || null;
    const schedules = await db.getAllSchedules(orgName);
    res.json({ success: true, count: schedules.length, data: schedules });

    // Non-blocking background schedule monitor (throttled to once every 15s)
    setImmediate(async () => {
      try {
        const newNotifs = await db.checkScheduledTripsNotStarted();
        const io = req.app.get('io');
        if (io && Array.isArray(newNotifs) && newNotifs.length > 0) {
          newNotifs.forEach((n) => {
            io.emit('notification:new', n);
            if (n.emailRelayPayload) {
              io.emit('email:relay', n.emailRelayPayload);
            }
          });
        }
      } catch (_) {}
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve schedules.' });
  }
});

// POST /api/stats/schedules - Create a new schedule slot, notify driver in Driver Login & email driver
router.post('/schedules', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { shuttle_id, route_id, route_name, departure_time, arrival_time, days, organization_name } = req.body;
    if (!departure_time) {
      return res.status(400).json({ success: false, message: 'Departure time is required.' });
    }
    const orgName = organization_name || req.user?.organization_name || null;
    const created = await db.createSchedule({
      shuttle_id,
      route_id,
      route_name,
      departure_time,
      arrival_time,
      days,
      organization_name: orgName
    });
    const io = req.app.get('io');
    if (io) {
      const schedules = await db.getAllSchedules(orgName);
      io.emit('schedule:updated', { schedules });
      io.emit('driver:schedule_assigned', {
        schedule: created,
        shuttleId: created.shuttle_id,
        shuttleCode: created.shuttleCode,
        driverName: created.driverName,
        driverEmail: created.driverEmail,
        driverUserId: created.driverUserId,
        departureTime: created.departure_time,
        arrivalTime: created.arrival_time,
        days: created.days,
        startPoint: created.startPoint,
        destination: created.destination,
        notification: created.driverNotification,
        message: `Your schedule time (${created.departure_time} – ${created.arrival_time}) is set for Bus ${created.shuttleCode}. Please be ready to ride safely!`
      });
      io.emit('driver:updated', { shuttleId: created.shuttle_id });
      if (created.emailRelayPayload && created.emailDeliveredVia === 'cloud_verified') {
        io.emit('email:relay', created.emailRelayPayload);
      }
      const notifications = await db.getNotifications(null, orgName);
      if (notifications.length > 0 && notifications[0]?.title?.includes('Driver Not Started Trip')) {
        io.emit('notification:new', notifications[0]);
      }
    }
    res.status(201).json({
      success: true,
      message: `Schedule slot created (${created.departure_time} – ${created.arrival_time}). Driver ${created.driverName || ''} notified in Driver Login & via Email ("Ready to ride safely!").`,
      deliveredVia: created.emailDeliveredVia,
      emailRelayPayload: created.emailRelayPayload,
      data: created
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create schedule.' });
  }
});

// DELETE /api/stats/schedules/:id - Admin delete a scheduled route slot
router.delete('/schedules/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const deleted = await db.deleteSchedule(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Scheduled route not found.' });
    }
    const orgName = req.query.organization_name || req.user?.organization_name || null;
    const schedules = await db.getAllSchedules(orgName);
    const io = req.app.get('io');
    if (io) {
      io.emit('schedule:updated', { schedules, deletedId: Number(req.params.id) });
    }
    res.json({
      success: true,
      message: 'Scheduled route deleted successfully.',
      data: schedules
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete schedule.' });
  }
});

// POST /api/stats/schedules/:id/arrival-exceeded - Notify Admin when driver exceeds arrival time & calculate cumulative points
router.post('/schedules/:id/arrival-exceeded', authenticate, async (req, res) => {
  try {
    const result = await db.markScheduleArrivalExceeded(req.params.id, req.body.reason);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Schedule not found.' });
    }
    const io = req.app.get('io');
    if (io) {
      io.emit('schedule:updated', result);
      if (result.notification) {
        io.emit('notification:new', result.notification);
      }
    }
    res.json({
      success: true,
      message: 'Admin notification sent for exceeded arrival time and cumulative driver points updated.',
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to send arrival time exceeded alert.' });
  }
});

// GET /api/stats/settings - Retrieve system settings (for specific organization_name or active admin)
router.get('/settings', optionalAuthenticate, async (req, res) => {
  try {
    const orgName = req.query.organization_name || req.user?.organization_name || null;
    const settings = await db.getSettings(orgName);
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve system settings.' });
  }
});

// PUT /api/stats/settings - Admin update system settings (Organization Name, Sample Passenger ID Card Format, Admin Profile, Speed Limit, Delay Threshold)
router.put('/settings', authenticate, authorize('admin'), async (req, res) => {
  try {
    const payload = { ...req.body };
    const resolvedOrg =
      payload.organization_name ||
      req.user?.organization_name ||
      'Sathyabama Institute of Science and Technology';

    // If Admin uploaded a Sample / Format ID Card for passengers, extract format text & keywords via OCR
    if (payload.sample_id_card_url && String(payload.sample_id_card_url).startsWith('data:image/')) {
      let sampleOcrText = '';
      try {
        const formBody = new URLSearchParams();
        formBody.append('apikey', process.env.OCR_SPACE_API_KEY || 'helloworld');
        formBody.append('base64Image', payload.sample_id_card_url);
        formBody.append('language', 'eng');
        formBody.append('isOverlayRequired', 'false');
        formBody.append('OCREngine', '2');

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5500);
        const ocrRes = await fetch('https://api.ocr.space/parse/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formBody.toString(),
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (ocrRes.ok) {
          const ocrJson = await ocrRes.json();
          if (ocrJson?.ParsedResults?.length > 0) {
            sampleOcrText = (ocrJson.ParsedResults[0].ParsedText || '').trim();
          }
        }
      } catch (_) {}

      const orgStr = String(resolvedOrg).toLowerCase();
      const rawTokens = `${sampleOcrText.toLowerCase()} ${orgStr}`
        .split(/[\s,._\-:/()]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3);
      const uniqueKeywords = Array.from(new Set(rawTokens)).slice(0, 25);

      payload.sample_id_ocr_text = sampleOcrText;
      payload.sample_id_format_keywords = uniqueKeywords;
    } else if (payload.sample_id_card_url === '') {
      payload.sample_id_ocr_text = '';
      payload.sample_id_format_keywords = [];
    }

    if (req.user?.userId && (payload.admin_profile_name || payload.admin_avatar_url || payload.organization_name)) {
      await db.updateUserProfile(req.user.userId, {
        name: payload.admin_profile_name,
        avatar_url: payload.admin_avatar_url,
        organization_name: payload.organization_name
      });
    }

    const updated = await db.updateSettings(payload, resolvedOrg);
    const io = req.app.get('io');
    if (io) {
      io.emit('settings:updated', updated);
    }

    res.json({
      success: true,
      message: `Admin Profile & Settings saved for "${updated.organization_name}". Passenger signup now enforces Organization "${updated.organization_name}"${
        updated.sample_id_card_url ? ' and matches your uploaded Sample Passenger ID Card format.' : '.'
      }`,
      data: updated
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to update system settings.' });
  }
});

module.exports = router;

