// 1. Load environment variables immediately
// We use the standard config() which looks for .env in the current folder
const dotenv = require('dotenv');
const dotenvResult = dotenv.config();

// 2. Debugging: Check if .env was found
if (dotenvResult.error) {
    console.error("❌ DOTENV ERROR: .env file not found!");
    console.error("   Make sure a file named '.env' is in the root folder next to server.js");
    // We don't exit here to allow hardcoded fallback if you chose that route, 
    // but for this setup, it will likely fail later if missing.
} else {
    console.log("✅ CONFIG LOADED: .env file found.");
}

// 3. Check specific variables
if (!process.env.DB_USER) {
    console.warn("⚠️ WARNING: DB_USER is undefined. Checking credentials...");
} else {
    console.log(`✅ CONNECTING AS: ${process.env.DB_USER}`);
}

const express = require('express');
const mysql = require('mysql2/promise'); 
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- DATABASE CONNECTION ---
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '', // Will use empty string if variable missing
    database: process.env.DB_NAME || 'eventrack'
};

// Create a connection pool
const pool = mysql.createPool(dbConfig);

// Test connection on startup to catch errors early
pool.getConnection()
    .then(connection => {
        console.log("✅ DATABASE CONNECTED SUCCESSFULLY");
        connection.release();
    })
    .catch(err => {
        console.error("❌ DATABASE CONNECTION FAILED");
        console.error("   Code:", err.code);
        console.error("   Message:", err.message);
        console.error("   Check your .env file password and database name.");
    });

// --- API ENDPOINTS ---

/**
 * [PUBLIC] Get all events
 */
app.get('/api/events', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                e.eid, e.ename, e.edate, e.etime, e.eprice, e.oid,
                v.vaddress, 
                et.event_type_name,
                (SELECT COUNT(*) FROM Registrations r WHERE r.EID = e.eid) AS registration_count
            FROM Events e
            LEFT JOIN Venues v ON e.vid = v.vid
            LEFT JOIN Event_Type et ON e.et_id = et.et_id
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

/**
 * [PUBLIC] User Registration
 */
app.post('/api/register', async (req, res) => {
    const { uname, email, username, password, user_role, uphone, uaddress, ustate, udob } = req.body;
    
    if (!uname || !email || !username || !password || !user_role) {
        return res.status(400).json({ error: 'Core fields are required' });
    }
    
    const dob = udob || null;
    const phone = uphone || null;
    const address = uaddress || null;
    const state = ustate || null;

    try {
        const [result] = await pool.query(
            'INSERT INTO User (uname, email, username, password, user_role, uphone, uaddress, ustate, udob) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [uname, email, username, password, user_role, phone, address, state, dob]
        );
        res.status(201).json({ message: 'User registered successfully!', userId: result.insertId });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

/**
 * [PUBLIC] User Login
 */
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await pool.query(
            'SELECT UID, uname, user_role FROM User WHERE username = ? AND password = ?',
            [username, password]
        );
        if (rows.length > 0) {
            const user = rows[0];
            res.json({ message: 'Login successful!', user: user });
        } else {
            res.status(401).json({ error: 'Invalid username or password' });
        }
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});


/**
 * [ORGANIZER] Create a new event
 */
app.post('/api/events', async (req, res) => {
    const { ename, edate, etime, vid, et_id, eprice, evolunteers_no, oid } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO Events (ename, edate, etime, vid, et_id, eprice, evolunteers_no, oid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [ename, edate, etime, vid, et_id, eprice, evolunteers_no, oid]
        );
        res.status(201).json({ message: 'Event created!', eventId: result.insertId });
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ error: 'Failed to create event' });
    }
});

/**
 * [AUDIENCE/VOLUNTEER] Register for an event
 */
app.post('/api/register-event', async (req, res) => {
    const { UID, EID, vRole } = req.body;
    try {
        const [existing] = await pool.query(
            'SELECT RegID FROM Registrations WHERE UID = ? AND EID = ?',
            [UID, EID]
        );
        if (existing.length > 0) {
            return res.status(409).json({ error: 'You are already registered for this event.' });
        }

        const [result] = await pool.query(
            'INSERT INTO Registrations (UID, EID, reg_date, vRole) VALUES (?, ?, CURDATE(), ?)',
            [UID, EID, vRole]
        );
        res.status(201).json({ message: 'Registered for event!', registrationId: result.insertId });
    } catch (error) {
        console.error('Error registering for event:', error);
        res.status(500).json({ error: 'Failed to register for event' });
    }
});

/**
 * [PUBLIC] Get all details for a single event
 */
app.get('/api/event/:id/details', async (req, res) => {
    const { id } = req.params;
    try {
        const eventDetailsPromise = pool.query(`
            SELECT 
                e.*, 
                v.*, 
                et.event_type_name,
                org.uname AS organizer_name,
                org.email AS organizer_email,
                org.uphone AS organizer_phone
            FROM Events e
            LEFT JOIN Venues v ON e.vid = v.vid
            LEFT JOIN Event_Type et ON e.et_id = et.et_id
            LEFT JOIN User org ON e.oid = org.UID
            WHERE e.eid = ?
        `, [id]);

        const schedulePromise = pool.query('SELECT ScID, sctimestamp, scaction FROM Schedule WHERE eid = ?', [id]);
        const sponsorsPromise = pool.query('SELECT SpID, SpName, SpEmail, SpContact, spcompanyname, sptype, spmoney FROM Sponsor WHERE eid = ?', [id]);
        const regCountPromise = pool.query('SELECT COUNT(*) AS registration_count FROM Registrations WHERE eid = ?', [id]);

        const [
            [eventRows],
            [scheduleRows],
            [sponsorRows],
            [countRows]
        ] = await Promise.all([eventDetailsPromise, schedulePromise, sponsorsPromise, regCountPromise]);

        if (eventRows.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        res.json({
            details: eventRows[0],
            schedule: scheduleRows,
            sponsors: sponsorRows,
            registration_count: countRows[0].registration_count
        });

    } catch (error) {
        console.error('Error fetching event details:', error);
        res.status(500).json({ error: 'Failed to fetch event details' });
    }
});

/**
 * [ORGANIZER] Update event details
 */
app.put('/api/event/:id', async (req, res) => {
    const { id } = req.params;
    const { ename, edate, etime, eprice, evolunteers_no, oid } = req.body;

    try {
        const [result] = await pool.query(
            'UPDATE Events SET ename = ?, edate = ?, etime = ?, eprice = ?, evolunteers_no = ? WHERE eid = ? AND oid = ?',
            [ename, edate, etime, eprice, evolunteers_no, id, oid]
        );

        if (result.affectedRows === 0) {
            return res.status(403).json({ error: 'Update failed: You might not be the owner or the event does not exist.' });
        }
        res.json({ message: 'Event updated successfully!' });

    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ error: 'Failed to update event' });
    }
});

/**
 * [ORGANIZER] Get audience list for an event
 */
app.post('/api/event/:id/audience', async (req, res) => {
    const { id } = req.params;
    const { uid } = req.body; 

    try {
        const [eventRows] = await pool.query('SELECT oid FROM Events WHERE eid = ?', [id]);
        if (eventRows.length === 0 || eventRows[0].oid !== uid) {
            return res.status(403).json({ error: 'Access denied: You are not the organizer of this event.' });
        }

        const [audienceRows] = await pool.query(`
            SELECT u.uname, u.email, u.uphone, r.reg_date, r.RegID
            FROM Registrations r
            JOIN User u ON r.UID = u.UID
            WHERE r.EID = ? AND r.vRole IS NULL
        `, [id]);

        res.json(audienceRows);

    } catch (error) {
        console.error('Error fetching audience:', error);
        res.status(500).json({ error: 'Failed to fetch audience' });
    }
});

/**
 * [ORGANIZER] Add a schedule item
 */
app.post('/api/schedule', async (req, res) => {
    const { eid, sctimestamp, scaction, oid } = req.body;

    try {
        const [eventRows] = await pool.query('SELECT oid FROM Events WHERE eid = ?', [eid]);
        if (eventRows.length === 0 || eventRows[0].oid !== oid) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        const [result] = await pool.query(
            'INSERT INTO Schedule (eid, sctimestamp, scaction) VALUES (?, ?, ?)',
            [eid, sctimestamp, scaction]
        );
        res.status(201).json({ 
            message: 'Schedule item added!', 
            newItem: {
                ScID: result.insertId,
                sctimestamp,
                scaction
            }
        });

    } catch (error) {
        console.error('Error adding schedule:', error);
        res.status(500).json({ error: 'Failed to add schedule item' });
    }
});

/**
 * [ORGANIZER] Add a sponsor
 */
app.post('/api/sponsor', async (req, res) => {
    const { SpName, SpEmail, SpContact, spcompanyname, sptype, spmoney, eid, oid } = req.body;
    
    try {
        const [eventRows] = await pool.query('SELECT oid FROM Events WHERE eid = ?', [eid]);
        if (eventRows.length === 0 || eventRows[0].oid !== oid) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        const [result] = await pool.query(
            'INSERT INTO Sponsor (SpName, SpEmail, SpContact, spcompanyname, sptype, spmoney, eid) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [SpName, SpEmail, SpContact, spcompanyname, sptype, spmoney, eid]
        );
        res.status(201).json({
            message: 'Sponsor added!', 
            newItem: {
                SpID: result.insertId,
                SpName, SpEmail, SpContact, spcompanyname, sptype, spmoney
            }
        });

    } catch (error)
 {
        console.error('Error adding sponsor:', error);
        res.status(500).json({ error: 'Failed to add sponsor' });
    }
});


/**
 * [ORGANIZER] Update a schedule item
 */
app.put('/api/schedule/:id', async (req, res) => {
    const { id } = req.params; // This is ScID
    const { sctimestamp, scaction, oid, eid } = req.body;

    if (!sctimestamp || !scaction || !oid || !eid) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }

    try {
        const [eventRows] = await pool.query('SELECT oid FROM Events WHERE eid = ?', [eid]);
        if (eventRows.length === 0 || eventRows[0].oid !== oid) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        const [result] = await pool.query(
            'UPDATE Schedule SET sctimestamp = ?, scaction = ? WHERE ScID = ? AND eid = ?',
            [sctimestamp, scaction, id, eid]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Schedule item not found or you do not have permission.' });
        }

        res.json({ message: 'Schedule item updated!' });

    } catch (error) {
        console.error('Error updating schedule:', error);
        res.status(500).json({ error: 'Failed to update schedule item.' });
    }
});

/**
 * [ORGANIZER] Update a sponsor
 */
app.put('/api/sponsor/:id', async (req, res) => {
    const { id } = req.params; // This is SpID
    const { SpName, SpEmail, SpContact, spcompanyname, sptype, spmoney, oid, eid } = req.body;

    if (!SpName || !oid || !eid) {
         return res.status(400).json({ error: 'Missing required fields.' });
    }

    try {
        const [eventRows] = await pool.query('SELECT oid FROM Events WHERE eid = ?', [eid]);
        if (eventRows.length === 0 || eventRows[0].oid !== oid) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        const [result] = await pool.query(
            `UPDATE Sponsor SET SpName = ?, SpEmail = ?, SpContact = ?, 
             spcompanyname = ?, sptype = ?, spmoney = ? 
             WHERE SpID = ? AND eid = ?`,
            [SpName, SpEmail, SpContact, spcompanyname, sptype, spmoney, id, eid]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Sponsor not found or you do not have permission.' });
        }
        
        res.json({ message: 'Sponsor updated!' });

    } catch (error) {
        console.error('Error updating sponsor:', error);
        res.status(500).json({ error: 'Failed to update sponsor.' });
    }
});

/**
 * [ORGANIZER] Get volunteer list for an event
 */
app.post('/api/event/:id/volunteers', async (req, res) => {
    const { id } = req.params; 
    const { uid } = req.body; 

    try {
        const [eventRows] = await pool.query('SELECT oid FROM Events WHERE eid = ?', [id]);
        if (eventRows.length === 0 || eventRows[0].oid !== uid) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        const [volunteerRows] = await pool.query(`
            SELECT u.uname, u.email, u.uphone, r.reg_date, r.vRole, r.RegID
            FROM Registrations r
            JOIN User u ON r.UID = u.UID
            WHERE r.EID = ? AND r.vRole IS NOT NULL
        `, [id]);

        res.json(volunteerRows);

    } catch (error) {
        console.error('Error fetching volunteers:', error);
        res.status(500).json({ error: 'Failed to fetch volunteers.' });
    }
});

/**
 * [ORGANIZER] Manually add a volunteer
 */
app.post('/api/volunteer', async (req, res) => {
    const { eid, uid_to_add, vRole, oid } = req.body;

    if (!eid || !uid_to_add || !vRole || !oid) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }

    try {
        const [eventRows] = await pool.query('SELECT oid FROM Events WHERE eid = ?', [eid]);
        if (eventRows.length === 0 || eventRows[0].oid !== oid) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        const [userRows] = await pool.query('SELECT UID FROM User WHERE UID = ?', [uid_to_add]);
        if (userRows.length === 0) {
            return res.status(404).json({ error: 'User not found with that ID.' });
        }

        const [existing] = await pool.query(
            'SELECT RegID, vRole FROM Registrations WHERE UID = ? AND EID = ?',
            [uid_to_add, eid]
        );
        if (existing.length > 0) {
            const [updateResult] = await pool.query(
                'UPDATE Registrations SET vRole = ? WHERE RegID = ?',
                [vRole, existing[0].RegID]
            );
            return res.status(200).json({ message: 'User already registered; role updated.', regId: existing[0].RegID });
        }

        const [result] = await pool.query(
            'INSERT INTO Registrations (UID, EID, reg_date, vRole) VALUES (?, ?, CURDATE(), ?)',
            [uid_to_add, eid, vRole]
        );
        res.status(201).json({ message: 'Volunteer added successfully!', regId: result.insertId });

    } catch (error) {
        console.error('Error adding volunteer:', error);
        res.status(500).json({ error: 'Failed to add volunteer.' });
    }
});


/**
 * [ORGANIZER] Update a registration (change volunteer role)
 */
app.put('/api/registration/:id', async (req, res) => {
    const { id } = req.params; // RegID
    const { vRole, oid, eid } = req.body;

    if (!vRole || !oid || !eid) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }

    try {
        const [eventRows] = await pool.query('SELECT oid FROM Events WHERE eid = ?', [eid]);
        if (eventRows.length === 0 || eventRows[0].oid !== oid) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        const [result] = await pool.query(
            'UPDATE Registrations SET vRole = ? WHERE RegID = ? AND EID = ?',
            [vRole, id, eid]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Registration not found or you do not have permission.' });
        }
        
        res.json({ message: 'Volunteer role updated!' });

    } catch (error) {
        console.error('Error updating role:', error);
        res.status(500).json({ error: 'Failed to update role.' });
    }
});

/**
 * [SECURE] Get user's profile details
 */
app.post('/api/user/profile', async (req, res) => {
    const { uid } = req.body;
    if (!uid) {
        return res.status(400).json({ error: 'User ID is required.' });
    }

    try {
        const [rows] = await pool.query(
            'SELECT UID, uname, email, username, uphone, uaddress, ustate, udob FROM User WHERE UID = ?',
            [uid]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        
        res.json(rows[0]);

    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'Failed to fetch profile.' });
    }
});

/**
 * [SECURE] Update user's profile details
 */
app.put('/api/user/profile', async (req, res) => {
    const { uid, uname, email, username, uphone, uaddress, ustate, udob } = req.body;

    if (!uid || !uname || !email || !username) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }

    try {
        const [result] = await pool.query(
            `UPDATE User SET uname = ?, email = ?, username = ?, 
             uphone = ?, uaddress = ?, ustate = ?, udob = ?
             WHERE UID = ?`,
            [uname, email, username, uphone, uaddress, ustate, udob, uid]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        
        res.json({ message: 'Profile updated successfully!', newUname: uname });

    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Failed to update profile.' });
    }
});

/**
 * [SECURE] Change user's password
 */
app.put('/api/user/password', async (req, res) => {
    const { uid, oldPassword, newPassword } = req.body;

    if (!uid || !oldPassword || !newPassword) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }

    try {
        const [rows] = await pool.query('SELECT password FROM User WHERE UID = ?', [uid]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        if (rows[0].password !== oldPassword) {
            return res.status(403).json({ error: 'Incorrect old password.' });
        }

        const [result] = await pool.query(
            'UPDATE User SET password = ? WHERE UID = ?',
            [newPassword, uid]
        );

        if (result.affectedRows === 0) {
            throw new Error('Password update failed unexpectedly.');
        }

        res.json({ message: 'Password updated successfully!' });

    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Failed to change password.' });
    }
});

/**
 * [SECURE] Get user's event history
 */
app.post('/api/user/history', async (req, res) => {
    const { uid } = req.body;
    if (!uid) {
        return res.status(400).json({ error: 'User ID is required.' });
    }

    try {
        const [rows] = await pool.query(
            `SELECT r.reg_date, r.vRole, e.ename, e.edate, e.eprice 
             FROM Registrations r
             JOIN Events e ON r.EID = e.eid
             WHERE r.UID = ?`,
            [uid]
        );
        
        res.json(rows);

    } catch (error) {
        console.error('Error fetching user history:', error);
        res.status(500).json({ error: 'Failed to fetch history.' });
    }
});

/**
 * [SECURE] Get all event IDs a user is registered for
 */
app.post('/api/user/registrations', async (req, res) => {
    const { uid } = req.body;
    if (!uid) {
        return res.status(400).json({ error: 'User ID is required.' });
    }
    try {
        const [rows] = await pool.query(
            'SELECT EID FROM Registrations WHERE UID = ?',
            [uid]
        );
        const eventIds = rows.map(row => row.EID);
        res.json(eventIds);
    } catch (error) {
        console.error('Error fetching user registrations:', error);
        res.status(500).json({ error: 'Failed to fetch registrations.' });
    }
});

/**
 * [SECURE] Get ticket details for a user and event
 */
app.post('/api/event/ticket', async (req, res) => {
    const { uid, eid } = req.body;
    if (!uid || !eid) {
        return res.status(400).json({ error: 'User ID and Event ID are required.' });
    }

    try {
        const [rows] = await pool.query(
            `SELECT 
                u.uname, u.UID, u.username,
                e.ename, e.edate, e.etime,
                v.vaddress,
                r.vRole
             FROM Registrations r
             JOIN User u ON r.UID = u.UID
             JOIN Events e ON r.EID = e.eid
             LEFT JOIN Venues v ON e.vid = v.vid
             WHERE r.UID = ? AND r.EID = ?`,
            [uid, eid]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Ticket not found.' });
        }
        
        res.json(rows[0]);

    } catch (error) {
        console.error('Error fetching ticket data:', error);
        res.status(500).json({ error: 'Failed to fetch ticket data.' });
    }
});


// --- START THE SERVER ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});