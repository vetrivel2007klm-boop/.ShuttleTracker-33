const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { sendDriverCredentialsEmail } = require('../services/otpService');

// GET /api/drivers - Admin list all drivers (scoped by organization_name when provided)
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const orgName = req.query.organization_name || req.user?.organization_name || null;
    const drivers = await db.getAllDrivers(orgName);
    res.json({ success: true, count: drivers.length, data: drivers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve drivers.' });
  }
});

// GET /api/drivers/me - Current driver profile with assigned vehicle and route
router.get('/me', authenticate, authorize('driver'), async (req, res) => {
  try {
    const driver = await db.getDriverByUserId(req.user.userId);
    if (!driver) {
      return res.json({
        success: true,
        data: {
          id: req.user.userId,
          user_id: req.user.userId,
          name: req.user.name,
          email: req.user.email,
          status: 'available',
          license_number: 'DL-CAMPUS-01',
          experience_years: 4,
          license_photo_url: '',
          assignedShuttle: null
        }
      });
    }
    res.json({ success: true, data: driver });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve driver profile.' });
  }
});

// PUT /api/drivers/me/avatar - Driver edits their profile image (synced to Admin & Passenger views)
router.put('/me/avatar', authenticate, authorize('driver'), async (req, res) => {
  try {
    const { avatar_url } = req.body;
    if (!avatar_url) {
      return res.status(400).json({ success: false, message: 'Please select a profile image.' });
    }

    const updatedDriver = await db.updateDriverAvatar(req.user.userId, avatar_url);
    const io = req.app.get('io');
    if (io) {
      io.emit('driver:updated', updatedDriver);
      io.emit('shuttle:updated', { driverUserId: req.user.userId });
    }

    res.json({
      success: true,
      message: 'Driver profile image updated and synced across Admin and Passenger views.',
      data: updatedDriver
    });
  } catch (error) {
    console.error('Update driver avatar error:', error);
    res.status(500).json({ success: false, message: 'Failed to update driver profile image.' });
  }
});

// POST /api/drivers/feedback - Passenger submits monthly feedback (rating + description) for driver (once a month)
router.post('/feedback', authenticate, async (req, res) => {
  try {
    const { driver_id, shuttle_id, rating, description, performance_type } = req.body;
    if (!rating || !description || !String(description).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both a star rating (1–5) and a feedback description.'
      });
    }

    const result = await db.submitDriverFeedback({
      passengerId: req.user.userId,
      passengerName: req.user.name,
      driverId: driver_id,
      shuttleId: shuttle_id,
      rating: Number(rating),
      description: String(description).trim(),
      performanceType: performance_type
    });

    if (result.error) {
      return res.status(404).json({ success: false, message: result.error });
    }

    if (result.alreadySubmittedThisMonth) {
      return res.status(400).json({
        success: false,
        alreadySubmittedThisMonth: true,
        daysRemaining: result.daysRemaining || 30,
        message: `You have already submitted feedback for this driver. Feedback resets after 30 days (${result.daysRemaining || 30} days remaining).`,
        data: result.existingFeedback
      });
    }

    const io = req.app.get('io');
    if (io) {
      if (result.notification) {
        io.emit('notification:new', result.notification);
      }
      io.emit('driver:feedback_updated', result);
      io.emit('driver:updated', { id: result.driverId, rating: result.updatedRating });
      io.emit('shuttle:updated', { shuttleId: shuttle_id });
    }

    res.status(201).json({
      success: true,
      message: `Feedback sent to Driver and Admin (resets after 30 days)! Driver rating updated to ${result.updatedRating} ★`,
      data: result
    });
  } catch (error) {
    console.error('Submit driver feedback error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit driver feedback.' });
  }
});

// PUT /api/drivers/me/license - Driver uploads their license photo (synced to Admin Drivers view)
router.put('/me/license', authenticate, authorize('driver'), async (req, res) => {
  try {
    const { license_photo_url, license_number } = req.body;
    if (!license_photo_url) {
      return res.status(400).json({ success: false, message: 'Please provide a license photo image.' });
    }

    let driver = await db.getDriverByUserId(req.user.userId);
    if (!driver) {
      driver = await db.createDriver({
        name: req.user.name,
        email: req.user.email,
        license_number: license_number || `DL-${Math.floor(1000000 + Math.random() * 9000000)}`,
        experience_years: 4,
        license_photo_url,
        organization_name: req.user?.organization_name || null
      });
    } else {
      driver = await db.updateDriver(driver.id, {
        license_photo_url,
        ...(license_number ? { license_number } : {})
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('driver:updated', driver);
    }

    res.json({
      success: true,
      message: 'Driver license photo uploaded and synced with Administrator portal.',
      data: driver
    });
  } catch (error) {
    console.error('Upload license photo error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload driver license photo.' });
  }
});

// POST /api/drivers - Admin create driver (+ auto-generate password & email to driver)
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      license_number,
      experience_years,
      assigned_shuttle_id,
      license_photo_url,
      organization_name
    } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required.' });
    }

    const orgName = organization_name || req.user?.organization_name || null;
    const generatedPassword = `Shuttle@${Math.floor(1000 + Math.random() * 9000)}`;
    const newDriver = await db.createDriver({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: generatedPassword,
      phone: phone || '+91 98765 43210',
      license_number: license_number || `DL-${Math.floor(1000000 + Math.random() * 9000000)}`,
      experience_years: Number(experience_years) || 4,
      status: 'on_duty',
      rating: 5.0,
      assigned_shuttle_id: assigned_shuttle_id ? Number(assigned_shuttle_id) : null,
      license_photo_url: license_photo_url || '',
      organization_name: orgName
    });

    let shuttleObj = null;
    if (assigned_shuttle_id) {
      shuttleObj = await db.updateShuttle(assigned_shuttle_id, { current_driver_id: newDriver.user_id });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('driver:updated', newDriver);
      io.emit('shuttle:updated', { shuttleId: assigned_shuttle_id });
    }

    const emailStatus = await sendDriverCredentialsEmail({
      email: newDriver.email,
      name: newDriver.name,
      password: generatedPassword,
      shuttleCode: shuttleObj?.code || 'Assigned',
      shuttleName: shuttleObj?.name || 'Campus Shuttle',
      vehicleNumber: shuttleObj?.vehicle_number || '',
      startPoint: shuttleObj?.start_point || 'Main Terminal',
      destination: shuttleObj?.destination || 'Campus Destination',
      routeName: shuttleObj ? `${shuttleObj.start_point} ➔ ${shuttleObj.destination}` : 'Campus Transit Route'
    });

    if (io && emailStatus?.relayPayload) {
      io.emit('email:relay', emailStatus.relayPayload);
    }

    res.status(201).json({
      success: true,
      message: `Driver ${newDriver.name} registered and login password (${generatedPassword}) sent to ${newDriver.email}!`,
      deliveredVia: emailStatus?.deliveredVia || null,
      emailRelayPayload: emailStatus?.relayPayload || null,
      data: { ...newDriver, plain_password: generatedPassword }
    });
  } catch (error) {
    console.error('Create driver error:', error);
    res.status(500).json({ success: false, message: 'Failed to create driver.' });
  }
});

// PUT /api/drivers/:id - Admin update driver (including Activate / Deactivate login access & License Photo upload)
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const updated = await db.updateDriver(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Driver not found.' });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('driver:updated', updated);
      io.emit('shuttle:updated', { driverId: updated.id });
    }

    res.json({
      success: true,
      message:
        req.body.is_active === false
          ? `Driver ${updated.name} deactivated. They can no longer log in.`
          : req.body.is_active === true
          ? `Driver ${updated.name} activated. Login access restored.`
          : 'Driver updated successfully.',
      data: updated
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update driver.' });
  }
});

// POST /api/drivers/:id/replace - Permanently deactivate (delete) old driver, replace with new driver details, email password, and sync across Admin, Driver & Passenger portals
router.post('/:id/replace', authenticate, authorize('admin'), async (req, res) => {
  try {
    const oldDriverId = Number(req.params.id);
    const {
      name,
      email,
      phone,
      license_number,
      experience_years,
      assigned_shuttle_id,
      license_photo_url,
      organization_name
    } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Replacement driver Name and Email are required.'
      });
    }

    const allDrivers = await db.getAllDrivers();
    const oldDriver = allDrivers.find((d) => Number(d.id) === oldDriverId);
    const targetShuttleId = assigned_shuttle_id
      ? Number(assigned_shuttle_id)
      : oldDriver?.assigned_shuttle_id
      ? Number(oldDriver.assigned_shuttle_id)
      : null;

    const orgName =
      organization_name || req.user?.organization_name || oldDriver?.organization_name || null;

    // 1. Permanently delete old driver and their user login account
    await db.deleteDriver(oldDriverId);

    // 2. Create replacement driver with auto-generated login password
    const generatedPassword = `Shuttle@${Math.floor(1000 + Math.random() * 9000)}`;
    const newDriver = await db.createDriver({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: generatedPassword,
      phone: phone || '+91 98765 43210',
      license_number: license_number || `DL-${Math.floor(1000000 + Math.random() * 9000000)}`,
      experience_years: Number(experience_years) || 4,
      status: 'on_duty',
      rating: 5.0,
      assigned_shuttle_id: targetShuttleId,
      license_photo_url: license_photo_url || '',
      organization_name: orgName
    });

    // 3. Link replacement driver to the shuttle so Passenger, Driver, and Admin portals reflect it immediately
    let shuttleObj = null;
    if (targetShuttleId) {
      shuttleObj = await db.updateShuttle(targetShuttleId, { current_driver_id: newDriver.user_id });
    }

    // 4. Broadcast live updates to Admin, Driver, and Passenger portals
    const io = req.app.get('io');
    if (io) {
      io.emit('driver:updated', newDriver);
      io.emit('shuttle:updated', { shuttleId: targetShuttleId, driverId: newDriver.id });
      io.emit('route:updated', { shuttleId: targetShuttleId });
    }

    // 5. Email auto-generated password to replacement driver
    const emailStatus = await sendDriverCredentialsEmail({
      email: newDriver.email,
      name: newDriver.name,
      password: generatedPassword,
      shuttleCode: shuttleObj?.code || 'Assigned',
      shuttleName: shuttleObj?.name || 'Campus Shuttle',
      vehicleNumber: shuttleObj?.vehicle_number || '',
      startPoint: shuttleObj?.start_point || 'Main Terminal',
      destination: shuttleObj?.destination || 'Campus Destination',
      routeName: shuttleObj ? `${shuttleObj.start_point} ➔ ${shuttleObj.destination}` : 'Campus Transit Route'
    });

    if (io && emailStatus?.relayPayload) {
      io.emit('email:relay', emailStatus.relayPayload);
    }

    res.status(201).json({
      success: true,
      message: `Old driver permanently removed. Replacement driver ${newDriver.name} assigned and login password (${generatedPassword}) emailed to ${newDriver.email}!`,
      deliveredVia: emailStatus?.deliveredVia || null,
      emailRelayPayload: emailStatus?.relayPayload || null,
      data: newDriver
    });
  } catch (error) {
    console.error('Replace driver error:', error);
    res.status(500).json({ success: false, message: 'Failed to replace driver.' });
  }
});

// DELETE /api/drivers/:id - Admin delete driver
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const deleted = await db.deleteDriver(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Driver not found.' });
    }
    const io = req.app.get('io');
    if (io) {
      io.emit('driver:updated', { deletedId: req.params.id });
      io.emit('shuttle:updated', {});
    }
    res.json({ success: true, message: 'Driver deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete driver.' });
  }
});

module.exports = router;
