const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load .env file
const envPath = path.resolve(__dirname, '.env');
console.log(`Attempting to load .env file from: ${envPath}`);
if (!fs.existsSync(envPath)) {
    console.error('.env file not found at:', envPath);
    process.exit(1);
}
const envConfig = dotenv.parse(fs.readFileSync(envPath));
for (const key in envConfig) {
    process.env[key] = envConfig[key];
}

// Validate .env variables
if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not defined in .env');
    process.exit(1);
}

// Initialize PostgreSQL connection pool
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'lecsachurch',
    password: process.env.PG_PASSWORD || 'pitso2003',
    port: 5432
});

// Verify database connection
pool.connect((err) => {
    if (err) {
        console.error('Failed to connect to PostgreSQL:', err);
        process.exit(1);
    }
    console.log('Connected to PostgreSQL database');
});

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// JWT Secret constant
const JWT_SECRET = process.env.JWT_SECRET;
console.log('JWT Secret loaded:', JWT_SECRET ? 'Yes' : 'No');

// ============ AUTHENTICATION MIDDLEWARE ============

function authenticate(req, res, next) {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
        console.log('No authorization header');
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    
    const token = authHeader.split(' ')[1];
    if (!token) {
        console.log('No token in authorization header');
        return res.status(401).json({ error: 'Invalid authorization format' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('JWT verified successfully for user:', decoded.username);
        req.userId = decoded.userId;
        req.username = decoded.username;
        req.role = decoded.role;
        next();
    } catch (err) {
        console.error('JWT verification error:', err.message);
        
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token signature' });
        }
        
        res.status(401).json({ error: 'Invalid token' });
    }
}

// Checks user permissions based on role
function checkPermission(requiredPermission) {
    return function (req, res, next) {
        // Permission mapping based on role
        const rolePermissions = {
			'admin': ['view', 'add', 'update', 'archive', 'admin'],
            'pastor': ['view', 'add', 'update', 'archive', 'admin'],
            'secretary': ['view', 'add', 'update', 'archive'],
            'board_member': ['view'],
            'user': ['view']  // 'user' role only has 'view' permission
        };

        const userRole = req.role || 'user';
        const permissions = rolePermissions[userRole] || [];
        
        console.log(`DEBUG: User role: ${userRole}, Required: ${requiredPermission}, Permissions: ${permissions}`);
        
        if (permissions.includes(requiredPermission)) {
            next();
        } else {
            console.log(`Permission denied: ${userRole} cannot ${requiredPermission}`);
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
    };
}
// Logs user actions
async function logAction(userId, action, details) {
    try {
        await pool.query(
            'INSERT INTO action_logs (user_id, action, details) VALUES ($1, $2, $3)',
            [userId, action, JSON.stringify(details)]
        );
    } catch (err) {
        console.error('Error logging action:', err);
    }
}

// ============ PUBLIC ROUTES ============

app.get('/api/public-test', (req, res) => {
    res.json({ 
        message: 'Public endpoint works',
        timestamp: new Date().toISOString(),
        JWT_SECRET_LOADED: !!JWT_SECRET
    });
});

// ============ AUTHENTICATION ENDPOINTS ============

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('User registration attempt:', { username });

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        // Check if username already exists
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Insert new user with default 'user' role
        const result = await pool.query(
            'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role, created_at',
            [username, passwordHash, 'user']
        );

        const newUser = result.rows[0];
        console.log('User registered:', newUser.username);

        res.status(201).json({
            message: 'Registration successful',
            user: {
                id: newUser.id,
                username: newUser.username,
                role: newUser.role
            }
        });
    } catch (error) {
        console.error('Error during user registration:', error.message);
        res.status(500).json({ error: 'Error during registration' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('User login attempt:', { username });

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Find user
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );

        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Create JWT token
        const token = jwt.sign(
            {
                userId: user.id,
                username: user.username,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log('User logged in:', username);

        res.status(200).json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Error during user login:', error.message);
        res.status(500).json({ error: 'Error during login' });
    }
});

// Legacy endpoints for backward compatibility
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1', 
            [username]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = result.rows[0];
        
        const isValid = await bcrypt.compare(password, user.password);
        
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { 
                userId: user.id, 
                username: user.username, 
                role: user.role 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({
            message: 'Login successful',
            token,
            role: user.role,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });
        
    } catch (error) {
        console.error('Legacy login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

app.post('/api/register/public', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    try {
        const existingUser = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id',
            [username, hashedPassword, 'user']
        );
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ MEMBERS ENDPOINTS ============

app.get('/api/members', authenticate, checkPermission('view'), async (req, res) => {
    try {
        const { search = '' } = req.query;
        
        let query = 'SELECT id, palo, lebitso, fane, created_at FROM members WHERE 1=1';
        const params = [];
        
        if (search && search.trim() !== '') {
            query += ' AND (lebitso ILIKE $1 OR fane ILIKE $1 OR palo::text ILIKE $1)';
            params.push(`%${search}%`);
        }
        
        query += ' ORDER BY CAST(palo AS INTEGER) ASC';
        
        console.log('Executing query:', query, 'with params:', params);
        
        const result = await pool.query(query, params);
        console.log(`Found ${result.rows.length} members`);
        
        res.json(result.rows);
        
    } catch (error) {
        console.error('Error fetching members:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message
        });
    }
});

app.post('/api/members', authenticate, checkPermission('add'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { lebitso, fane } = req.body;
        
        console.log('Adding new member:', { lebitso, fane });
        
        if (!lebitso || !fane) {
            return res.status(400).json({ error: 'Lebitso and fane are required' });
        }

        await client.query('BEGIN');

        // Get the next palo number
        const maxPaloResult = await client.query(
            'SELECT COALESCE(MAX(CAST(palo AS INTEGER)), 0) as max_palo FROM members'
        );
        const nextPalo = parseInt(maxPaloResult.rows[0].max_palo) + 1;
        
        console.log('Next palo number:', nextPalo);

        // Insert the new member
        const result = await client.query(
            `INSERT INTO members (palo, lebitso, fane) 
             VALUES ($1, $2, $3) 
             RETURNING id, palo, lebitso, fane, created_at`,
            [nextPalo.toString(), lebitso.trim(), fane.trim()]
        );

        const newMember = result.rows[0];
        
        await logAction(req.userId, 'add_member', {
            id: newMember.id,
            palo: newMember.palo,
            lebitso: newMember.lebitso,
            fane: newMember.fane
        });

        await client.query('COMMIT');
        
        console.log('Member added successfully:', newMember);
        
        res.status(201).json({
            message: 'Member registered successfully',
            member: newMember
        });
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error adding member:', err);
        
        if (err.code === '23505') { // Unique violation
            res.status(409).json({ error: 'Member already exists with this palo' });
        } else {
            res.status(500).json({ error: 'Server error: ' + err.message });
        }
    } finally {
        client.release();
    }
});
// Add this endpoint to your existing server.js file
app.put('/api/members/:palo/receipt', authenticate, checkPermission('update'), async (req, res) => {
    try {
        const { palo } = req.params;
        const { year, receipt } = req.body;
        
        console.log('Updating receipt:', { palo, year, receipt });
        
        // Validate year
        const validYears = ['2024', '2025', '2026', '2027', '2028', '2029', '2030'];
        if (!year || !validYears.includes(year)) {
            return res.status(400).json({ 
                error: 'Valid year (2024-2030) is required',
                validYears: validYears 
            });
        }
        
        // Validate receipt (optional, can be empty to clear)
        if (receipt && receipt.length > 50) {
            return res.status(400).json({ error: 'Receipt number too long (max 50 characters)' });
        }
        
        const columnName = `receipt_${year}`;
        const query = `UPDATE members SET ${columnName} = $1 WHERE palo = $2 RETURNING id, palo, lebitso, fane, ${columnName}`;
        
        const result = await pool.query(query, [receipt || null, palo]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Member not found' });
        }
        
        await logAction(req.userId, 'update_receipt', { 
            palo, 
            year, 
            receipt,
            member: result.rows[0] 
        });
        
        res.json({ 
            message: 'Receipt updated successfully',
            member: result.rows[0]
        });
        
    } catch (err) {
        console.error('Error updating receipt:', err);
        
        // Handle invalid column name error
        if (err.code === '42703') {
            return res.status(400).json({ 
                error: 'Invalid year specified',
                validYears: ['2024', '2025', '2026', '2027', '2028', '2029', '2030']
            });
        }
        
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

app.put('/api/members/:palo/archive', authenticate, checkPermission('archive'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { palo } = req.params;
        const { status } = req.body;
        
        console.log('Archiving member:', { palo, status });
        
        if (!['Moved', 'Deceased'].includes(status)) {
            return res.status(400).json({ error: 'Valid status (Moved or Deceased) is required' });
        }

        await client.query('BEGIN');

        // Get member details
        const memberResult = await client.query(
            'SELECT * FROM members WHERE palo = $1',
            [palo]
        );
        
        if (memberResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Member not found' });
        }
        
        const member = memberResult.rows[0];
        
        // Get next archive palo
        const maxArchivePaloResult = await client.query(
            'SELECT COALESCE(MAX(palo), 0) AS max_palo FROM archives'
        );
        const newArchivePalo = parseInt(maxArchivePaloResult.rows[0].max_palo) + 1;
        
        // Create archive record
        const archiveData = {
            lebitso: member.lebitso,
            fane: member.fane,
            status: status,
            receipt_2024: member.receipt_2024,
            receipt_2025: member.receipt_2025,
            receipt_2026: member.receipt_2026,
            receipt_2027: member.receipt_2027,
            receipt_2028: member.receipt_2028,
            receipt_2029: member.receipt_2029,
            receipt_2030: member.receipt_2030
        };
        
        await client.query(
            `INSERT INTO archives (type, data, palo, record_type, details) 
             VALUES ($1, $2, $3, $4, $5)`,
            ['member', archiveData, newArchivePalo, 'member', archiveData]
        );
        
        // Delete from active members
        await client.query('DELETE FROM members WHERE palo = $1', [palo]);
        
        // Renumber remaining members
        await client.query(`
            UPDATE members 
            SET palo = new_palo
            FROM (
                SELECT id, ROW_NUMBER() OVER (ORDER BY CAST(palo AS INTEGER)) as new_palo
                FROM members
                WHERE CAST(palo AS INTEGER) > $1
            ) AS renumbered
            WHERE members.id = renumbered.id
        `, [parseInt(palo)]);
        
        await logAction(req.userId, 'archive_member', { palo, status, archivePalo: newArchivePalo });
        
        await client.query('COMMIT');
        
        res.json({ 
            message: `Member archived as ${status}`,
            archivePalo: newArchivePalo
        });
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error archiving member:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    } finally {
        client.release();
    }
});

// Update member endpoint
app.put('/api/members/:palo', authenticate, checkPermission('update'), async (req, res) => {
    try {
        const { palo } = req.params;
        const { lebitso, fane } = req.body;
        
        console.log('Updating member:', { palo, lebitso, fane });
        
        if (!lebitso || !fane) {
            return res.status(400).json({ error: 'Lebitso and fane are required' });
        }
        
        const result = await pool.query(
            'UPDATE members SET lebitso = $1, fane = $2 WHERE palo = $3 RETURNING id, palo, lebitso, fane',
            [lebitso.trim(), fane.trim(), palo]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Member not found' });
        }
        
        await logAction(req.userId, 'update_member', { palo, lebitso, fane });
        
        res.json({ 
            message: 'Member updated successfully',
            member: result.rows[0]
        });
        
    } catch (err) {
        console.error('Error updating member:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// ============ SINGLE RECORD ENDPOINTS ============

// Get single member by palo
app.get('/api/members/:palo', authenticate, checkPermission('view'), async (req, res) => {
    try {
        const { palo } = req.params;
        console.log(`Fetching member with palo: ${palo}`);
        
        // First try to get from members table
        const query = 'SELECT * FROM members WHERE palo = $1';
        const result = await pool.query(query, [palo]);
        
        if (result.rows.length > 0) {
            console.log('Found member in members table');
            return res.json(result.rows[0]);
        }
        
        // If not found, try archives
        const archiveQuery = 'SELECT * FROM archives WHERE palo = $1 AND record_type = $2';
        const archiveResult = await pool.query(archiveQuery, [palo, 'member']);
        
        if (archiveResult.rows.length > 0) {
            console.log('Found member in archives');
            const archived = archiveResult.rows[0];
            // Combine archive data
            const memberData = {
                ...archived.details,
                id: archived.id,
                palo: archived.palo,
                archived: true,
                archived_date: archived.archived_date
            };
            return res.json(memberData);
        }
        
        res.status(404).json({ error: 'Member not found' });
        
    } catch (error) {
        console.error('Error fetching member:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single baptism by id
app.get('/api/baptisms/:id', authenticate, checkPermission('view'), async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`Fetching baptism with id: ${id}`);
        
        // First try to get from baptisms table
        const query = 'SELECT * FROM baptisms WHERE id = $1';
        const result = await pool.query(query, [id]);
        
        if (result.rows.length > 0) {
            console.log('Found baptism in baptisms table');
            return res.json(result.rows[0]);
        }
        
        // If not found, try archives
        const archiveQuery = 'SELECT * FROM archives WHERE id = $1 AND record_type = $2';
        const archiveResult = await pool.query(archiveQuery, [id, 'baptism']);
        
        if (archiveResult.rows.length > 0) {
            console.log('Found baptism in archives');
            const archived = archiveResult.rows[0];
            const baptismData = {
                ...archived.details,
                id: archived.id,
                archived: true,
                archived_date: archived.archived_date
            };
            return res.json(baptismData);
        }
        
        res.status(404).json({ error: 'Baptism not found' });
        
    } catch (error) {
        console.error('Error fetching baptism:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single wedding by id
app.get('/api/weddings/:id', authenticate, checkPermission('view'), async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`Fetching wedding with id: ${id}`);
        
        // First try to get from weddings table
        const query = 'SELECT * FROM weddings WHERE id = $1';
        const result = await pool.query(query, [id]);
        
        if (result.rows.length > 0) {
            console.log('Found wedding in weddings table');
            return res.json(result.rows[0]);
        }
        
        // If not found, try archives
        const archiveQuery = 'SELECT * FROM archives WHERE id = $1 AND record_type = $2';
        const archiveResult = await pool.query(archiveQuery, [id, 'wedding']);
        
        if (archiveResult.rows.length > 0) {
            console.log('Found wedding in archives');
            const archived = archiveResult.rows[0];
            const weddingData = {
                ...archived.details,
                id: archived.id,
                archived: true,
                archived_date: archived.archived_date
            };
            return res.json(weddingData);
        }
        
        res.status(404).json({ error: 'Wedding not found' });
        
    } catch (error) {
        console.error('Error fetching wedding:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ BAPTISMS ENDPOINTS ============

app.get('/api/baptisms', authenticate, checkPermission('view'), async (req, res) => {
    try {
        const { search = '' } = req.query;
        
        let query = 'SELECT * FROM baptisms WHERE archived = false';
        const params = [];
        
        if (search && search.trim() !== '') {
            query += ' AND (first_name ILIKE $1 OR surname ILIKE $1 OR pastor ILIKE $1)';
            params.push(`%${search}%`);
        }
        
        query += ' ORDER BY baptism_date DESC';
        
        console.log('Executing query:', query, 'with params:', params);
        
        const result = await pool.query(query, params);
        console.log(`Found ${result.rows.length} baptisms`);
        
        res.json(result.rows);
        
    } catch (error) {
        console.error('Error fetching baptisms:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message
        });
    }
});

app.post('/api/baptisms', authenticate, checkPermission('add'), async (req, res) => {
    const client = await pool.connect();
    try {
        // Log the incoming request body
        console.log('Received baptism data:', req.body);
        
        // Use the data directly from req.body
        const {
            first_name, middle_name, surname, date_of_birth,
            father_first_name, father_middle_name, father_surname,
            mother_first_name, mother_middle_name, mother_surname,
            baptism_date, pastor
        } = req.body;
        
        console.log('Adding new baptism:', { 
            first_name, surname, date_of_birth, baptism_date 
        });
        
        // Required fields validation
        const requiredFields = [
            'first_name', 'surname', 'date_of_birth', 'baptism_date', 'pastor',
            'father_first_name', 'father_surname', 'mother_first_name', 'mother_surname'
        ];
        
        const missingFields = requiredFields.filter(field => {
            const value = req.body[field];
            return !value || (typeof value === 'string' && value.trim() === '');
        });
        
        if (missingFields.length > 0) {
            console.log('Missing fields:', missingFields);
            return res.status(400).json({ 
                error: 'Missing required fields',
                fields: missingFields 
            });
        }

        await client.query('BEGIN');

        // Insert baptism with proper field names
        const result = await client.query(
            `INSERT INTO baptisms (
                first_name, middle_name, surname, date_of_birth,
                father_first_name, father_middle_name, father_surname,
                mother_first_name, mother_middle_name, mother_surname,
                baptism_date, pastor, archived
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false)
            RETURNING id, first_name, middle_name, surname, date_of_birth, baptism_date, pastor`,
            [
                first_name.trim(),
                middle_name ? middle_name.trim() : null,
                surname.trim(),
                date_of_birth,
                father_first_name.trim(),
                father_middle_name ? father_middle_name.trim() : null,
                father_surname.trim(),
                mother_first_name.trim(),
                mother_middle_name ? mother_middle_name.trim() : null,
                mother_surname.trim(),
                baptism_date,
                pastor.trim()
            ]
        );

        const newBaptism = result.rows[0];
        
        await logAction(req.userId, 'add_baptism', {
            id: newBaptism.id,
            name: `${first_name} ${surname}`,
            baptism_date: baptism_date
        });

        await client.query('COMMIT');
        
        console.log('Baptism added successfully:', newBaptism);
        
        res.status(201).json({
            message: 'Baptism recorded successfully',
            baptism: newBaptism
        });
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error adding baptism:', err);
        
        if (err.code === '23505') { // Unique violation
            res.status(409).json({ error: 'Baptism already exists' });
        } else if (err.code === '23502') { // Not null violation
            res.status(400).json({ error: 'Required field missing' });
        } else {
            res.status(500).json({ 
                error: 'Server error: ' + err.message,
                code: err.code
            });
        }
    } finally {
        client.release();
    }
});

// UPDATE existing baptism record
app.put('/api/baptisms/:id', authenticate, checkPermission('update'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            first_name,
            middle_name,
            surname,
            date_of_birth,
            father_first_name,
            father_middle_name,
            father_surname,
            mother_first_name,
            mother_middle_name,
            mother_surname,
            baptism_date,
            pastor
        } = req.body;

        // Required fields validation (same as POST)
        if (!first_name?.trim() ||
            !surname?.trim() ||
            !date_of_birth ||
            !father_first_name?.trim() ||
            !father_surname?.trim() ||
            !mother_first_name?.trim() ||
            !mother_surname?.trim() ||
            !baptism_date ||
            !pastor?.trim()) {
            return res.status(400).json({ error: 'All required fields must be provided' });
        }

        const result = await pool.query(`
            UPDATE baptisms
            SET 
                first_name          = $1,
                middle_name         = $2,
                surname             = $3,
                date_of_birth       = $4,
                father_first_name   = $5,
                father_middle_name  = $6,
                father_surname      = $7,
                mother_first_name   = $8,
                mother_middle_name  = $9,
                mother_surname      = $10,
                baptism_date        = $11,
                pastor              = $12,
                updated_at          = CURRENT_TIMESTAMP
            WHERE id = $13
            RETURNING *
        `, [
            first_name.trim(),
            middle_name?.trim() || null,
            surname.trim(),
            date_of_birth,
            father_first_name.trim(),
            father_middle_name?.trim() || null,
            father_surname.trim(),
            mother_first_name.trim(),
            mother_middle_name?.trim() || null,
            mother_surname.trim(),
            baptism_date,
            pastor.trim(),
            id
        ]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Baptism record not found' });
        }

        const updated = result.rows[0];

        // Log the action (audit trail)
        await logAction(req.userId, 'update_baptism', {
            baptism_id: parseInt(id),
            changed_fields: Object.keys(req.body),
            new_values: { ...req.body }
        });

        res.json({
            message: 'Baptism record updated successfully',
            baptism: updated
        });

    } catch (err) {
        console.error('Error updating baptism:', err.message, err.stack);
        res.status(500).json({
            error: 'Failed to update baptism record',
            details: err.message
        });
    }
});

// ============ WEDDINGS ENDPOINTS ============

app.get('/api/weddings', authenticate, checkPermission('view'), async (req, res) => {
    try {
        const { search = '', showArchived = 'false' } = req.query;
        
        // Only show non-archived by default
        let query = 'SELECT * FROM weddings WHERE archived = false';
        const params = [];
        let paramCount = 0;
        
        if (search && search.trim() !== '') {
            paramCount++;
            query += ` AND (
                groom_first_name ILIKE $${paramCount} OR 
                groom_surname ILIKE $${paramCount} OR 
                bride_first_name ILIKE $${paramCount} OR 
                bride_surname ILIKE $${paramCount} OR
                pastor ILIKE $${paramCount} OR
                location ILIKE $${paramCount}
            )`;
            params.push(`%${search}%`);
        }
        
        // If user explicitly wants to see archived weddings
        if (showArchived === 'true') {
            query = 'SELECT * FROM weddings WHERE 1=1';
            // Rebuild the search if needed
            if (search && search.trim() !== '') {
                paramCount = 0;
                query += ` AND (
                    groom_first_name ILIKE $1 OR 
                    groom_surname ILIKE $1 OR 
                    bride_first_name ILIKE $1 OR 
                    bride_surname ILIKE $1 OR
                    pastor ILIKE $1 OR
                    location ILIKE $1
                )`;
            }
        }
        
        query += ' ORDER BY wedding_date DESC';
        
        console.log('Executing weddings query:', query, 'with params:', params);
        
        const result = await pool.query(query, params);
        console.log(`Found ${result.rows.length} weddings (archived=${showArchived})`);
        
        res.json(result.rows);
        
    } catch (error) {
        console.error('Error fetching weddings:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message
        });
    }
});

app.post('/api/weddings', authenticate, checkPermission('add'), async (req, res) => {
    const client = await pool.connect();
    try {
        console.log('=== START WEDDING POST REQUEST ===');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        
        const {
            groom_first_name, groom_middle_name, groom_surname, groom_id_number,
            bride_first_name, bride_middle_name, bride_surname, bride_id_number,
            wedding_date, pastor, location
        } = req.body;
        
        // Required fields validation
        const requiredFields = [
            'groom_first_name', 'groom_surname', 
            'bride_first_name', 'bride_surname',
            'wedding_date', 'pastor', 'location'
        ];
        
        const missingFields = requiredFields.filter(field => !req.body[field] || req.body[field].trim() === '');
        
        if (missingFields.length > 0) {
            console.log('Missing required fields:', missingFields);
            return res.status(400).json({ 
                error: 'Missing required fields',
                fields: missingFields 
            });
        }

        await client.query('BEGIN');

        // TEMPORARILY DISABLE AUTO-ARCHIVING FOR TESTING
        // const weddingDateObj = new Date(wedding_date);
        // const threeYearsAgo = new Date();
        // threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
        // const shouldArchive = weddingDateObj < threeYearsAgo;
        
        const shouldArchive = false; // Force false for testing
        
        console.log('Inserting wedding with archived =', shouldArchive);
        
        // Insert wedding
        const result = await client.query(
            `INSERT INTO weddings (
                groom_first_name, groom_middle_name, groom_surname, groom_id_number,
                bride_first_name, bride_middle_name, bride_surname, bride_id_number,
                wedding_date, pastor, location, archived
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id, groom_first_name, groom_surname, bride_first_name, bride_surname, wedding_date, archived`,
            [
                groom_first_name.trim(),
                groom_middle_name ? groom_middle_name.trim() : null,
                groom_surname.trim(),
                groom_id_number ? groom_id_number.trim() : null,
                bride_first_name.trim(),
                bride_middle_name ? bride_middle_name.trim() : null,
                bride_surname.trim(),
                bride_id_number ? bride_id_number.trim() : null,
                wedding_date,
                pastor.trim(),
                location.trim(),
                shouldArchive
            ]
        );

        const newWedding = result.rows[0];
        console.log('Successfully inserted wedding:', newWedding);
        
        await logAction(req.userId, 'add_wedding', {
            id: newWedding.id,
            groom: `${groom_first_name} ${groom_surname}`,
            bride: `${bride_first_name} ${bride_surname}`,
            wedding_date: wedding_date,
            archived: shouldArchive
        });

        await client.query('COMMIT');
        
        res.status(201).json({
            message: 'Wedding recorded successfully',
            wedding: newWedding,
            autoArchived: shouldArchive
        });
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error adding wedding:', err);
        
        res.status(500).json({ 
            error: 'Server error: ' + err.message,
            code: err.code,
            detail: err.detail
        });
    } finally {
        client.release();
    }
});

// Update existing wedding (PUT /api/weddings/:id)
app.put('/api/weddings/:id', authenticate, checkPermission('update'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            groom_first_name,
            groom_middle_name,
            groom_surname,
            groom_id_number,
            bride_first_name,
            bride_middle_name,
            bride_surname,
            bride_id_number,
            wedding_date,
            pastor,
            location
        } = req.body;

        // Basic validation
        if (!groom_first_name || !groom_surname || !bride_first_name || !bride_surname ||
            !wedding_date || !pastor || !location) {
            return res.status(400).json({ error: 'All required fields must be provided' });
        }

        const result = await pool.query(
            `UPDATE weddings
             SET 
                groom_first_name = $1,
                groom_middle_name = $2,
                groom_surname = $3,
                groom_id_number = $4,
                bride_first_name = $5,
                bride_middle_name = $6,
                bride_surname = $7,
                bride_id_number = $8,
                wedding_date = $9,
                pastor = $10,
                location = $11,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $12
             RETURNING *`,
            [
                groom_first_name.trim(),
                groom_middle_name?.trim() || null,
                groom_surname.trim(),
                groom_id_number?.trim() || null,
                bride_first_name.trim(),
                bride_middle_name?.trim() || null,
                bride_surname.trim(),
                bride_id_number?.trim() || null,
                wedding_date,
                pastor.trim(),
                location.trim(),
                id
            ]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Wedding record not found' });
        }

        const updatedWedding = result.rows[0];

        // Log the action
        await logAction(req.userId, 'update_wedding', {
            wedding_id: id,
            changed_fields: Object.keys(req.body),
            new_values: { ...req.body }
        });

        res.json({
            message: 'Wedding record updated successfully',
            wedding: updatedWedding
        });

    } catch (err) {
        console.error('Error updating wedding:', err);
        res.status(500).json({ 
            error: 'Failed to update wedding record',
            message: err.message 
        });
    }
});

// ============ ARCHIVES ENDPOINTS ============

app.get('/api/archives', authenticate, checkPermission('view'), async (req, res) => {
    try {
        const { search = '' } = req.query;
        
        let query = 'SELECT * FROM archives WHERE 1=1';
        const params = [];
        
        if (search && search.trim() !== '') {
            // Search in JSONB data
            query += ` AND (
                data::text ILIKE $1 OR 
                details::text ILIKE $1 OR
                type ILIKE $1 OR
                record_type ILIKE $1 OR
                palo::text ILIKE $1
            )`;
            params.push(`%${search}%`);
        }
        
        query += ' ORDER BY archived_date DESC';
        
        console.log('Executing query:', query, 'with params:', params);
        
        const result = await pool.query(query, params);
        console.log(`Found ${result.rows.length} archive records`);
        
        // Parse JSON data for easier consumption
        const archives = result.rows.map(row => ({
            id: row.id,
            type: row.type,
            record_type: row.record_type,
            palo: row.palo,
            archived_date: row.archived_date,
            details: row.details || row.data || {}
        }));
        
        res.json(archives);
        
    } catch (error) {
        console.error('Error fetching archives:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message
        });
    }
});

app.put('/api/archives/:id/restore', authenticate, checkPermission('archive'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        
        console.log('Restoring archive ID:', id);
        
        await client.query('BEGIN');

        // Get archive record
        const archiveResult = await client.query(
            'SELECT * FROM archives WHERE id = $1',
            [id]
        );
        
        if (archiveResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Archive record not found' });
        }
        
        const archive = archiveResult.rows[0];
        
        // Only member archives can be restored
        if (archive.record_type !== 'member') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Only member records can be restored' });
        }
        
        const details = archive.details || archive.data || {};
        
        // Validate required fields
        if (!details.lebitso || !details.fane) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Invalid archive data: missing lebitso or fane' });
        }
        
        // Get next palo number for members table
        const maxPaloResult = await client.query(
            'SELECT COALESCE(MAX(CAST(palo AS INTEGER)), 0) as max_palo FROM members WHERE palo ~ \'^[0-9]+$\''
        );
        const newPalo = parseInt(maxPaloResult.rows[0].max_palo) + 1;
        
        // Restore to members table
        const result = await client.query(
            `INSERT INTO members (
                palo, lebitso, fane,
                receipt_2024, receipt_2025, receipt_2026, receipt_2027,
                receipt_2028, receipt_2029, receipt_2030
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, palo, lebitso, fane`,
            [
                newPalo.toString(),
                details.lebitso,
                details.fane,
                details.receipt_2024 || null,
                details.receipt_2025 || null,
                details.receipt_2026 || null,
                details.receipt_2027 || null,
                details.receipt_2028 || null,
                details.receipt_2029 || null,
                details.receipt_2030 || null
            ]
        );
        
        const restoredMember = result.rows[0];
        
        // Delete from archives
        await client.query('DELETE FROM archives WHERE id = $1', [id]);
        
        await logAction(req.userId, 'restore_member', {
            archiveId: id,
            palo: restoredMember.palo,
            lebitso: restoredMember.lebitso,
            fane: restoredMember.fane
        });
        
        await client.query('COMMIT');
        
        console.log('Member restored successfully:', restoredMember);
        
        res.json({ 
            message: 'Record restored successfully',
            member: restoredMember
        });
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error restoring archive:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    } finally {
        client.release();
    }
});

// ============ FINANCIALS ENDPOINTS ============

app.get('/api/financials', authenticate, checkPermission('view'), async (req, res) => {
    try {
        const { period = 'weekly', year, month } = req.query;
        
        console.log('Fetching financials for period:', period);
        
        let query = '';
        let params = [];
        
        if (period === 'weekly') {
            // Get current week's transactions (not archived)
            const currentDate = new Date();
            const weekAgo = new Date(currentDate);
            weekAgo.setDate(weekAgo.getDate() - 7);
            
            query = `
                SELECT * FROM financial_transactions 
                WHERE transaction_date >= $1 
                AND transaction_date <= $2
                AND archived = false
                ORDER BY transaction_date DESC, id DESC
            `;
            params = [weekAgo.toISOString().split('T')[0], currentDate.toISOString().split('T')[0]];
        } else if (period === 'monthly') {
            // Get monthly aggregates
            query = `
                SELECT 
                    DATE_TRUNC('month', transaction_date) as month,
                    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
                    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses,
                    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as balance,
                    COUNT(*) as transaction_count
                FROM financial_transactions
                WHERE archived = true
                GROUP BY DATE_TRUNC('month', transaction_date)
                ORDER BY month DESC
            `;
        } else if (period === 'quarterly') {
            // Get quarterly aggregates
            query = `
                SELECT 
                    EXTRACT(YEAR FROM transaction_date) as year,
                    EXTRACT(QUARTER FROM transaction_date) as quarter,
                    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
                    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses,
                    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as balance,
                    COUNT(*) as transaction_count
                FROM financial_transactions
                WHERE archived = true
                GROUP BY EXTRACT(YEAR FROM transaction_date), EXTRACT(QUARTER FROM transaction_date)
                ORDER BY year DESC, quarter DESC
            `;
        } else if (period === 'yearly') {
            // Get yearly aggregates
            query = `
                SELECT 
                    EXTRACT(YEAR FROM transaction_date) as year,
                    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
                    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses,
                    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as balance,
                    COUNT(*) as transaction_count
                FROM financial_transactions
                WHERE archived = true
                GROUP BY EXTRACT(YEAR FROM transaction_date)
                ORDER BY year DESC
            `;
        } else {
            return res.status(400).json({ error: 'Invalid period specified' });
        }
        
        console.log('Executing financials query:', query);
        const result = await pool.query(query, params);
        
        res.json(result.rows);
        
    } catch (error) {
        console.error('Error fetching financials:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message
        });
    }
});


app.post('/api/financials', authenticate, checkPermission('add'), async (req, res) => {
    const client = await pool.connect();
    try {
        console.log('Received financial transaction:', req.body);
        
        const {
            date: transaction_date,
            description,
            category,
            amount,
            week_start,
            reference,
            notes
        } = req.body;
        
        // Validate required fields
        if (!transaction_date || !description || !category || !amount || amount <= 0) {
            return res.status(400).json({ 
                error: 'Missing or invalid required fields',
                required: ['date', 'description', 'category', 'amount']
            });
        }
        
        // Determine type based on category
        let transactionType = 'income'; // Default
        const expenseCategories = ['Utilities', 'Maintenance', 'Staff', 'Supplies', 'Outreach', 'Other Expense'];
        if (expenseCategories.includes(category)) {
            transactionType = 'expense';
        }
        
        await client.query('BEGIN');
        
        // Insert into database
        const result = await client.query(
            `INSERT INTO financial_transactions (
                transaction_date, description, category, type, amount, 
                week_start, reference, notes, archived
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, transaction_date, description, category, type, amount, reference`,
            [
                transaction_date,
                description.trim(),
                category.trim(),
                transactionType,
                parseFloat(amount),
                week_start || null,
                reference ? reference.trim() : null,
                notes ? notes.trim() : null,
                false // Not archived initially
            ]
        );
        
        const newTransaction = result.rows[0];
        
        await logAction(req.userId, 'add_financial_transaction', {
            id: newTransaction.id,
            description: newTransaction.description,
            amount: newTransaction.amount,
            type: newTransaction.type
        });
        
        await client.query('COMMIT');
        
        console.log('Transaction added successfully:', newTransaction);
        
        res.status(201).json({
            message: 'Transaction recorded successfully',
            transaction: newTransaction
        });
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error adding financial transaction:', err);
        
        if (err.code === '42P01') { // Table doesn't exist
            res.status(500).json({ 
                error: 'Financial tables not created yet',
                note: 'Run the SQL commands to create financial_transactions and financial_weeks tables'
            });
        } else {
            res.status(500).json({ 
                error: 'Server error: ' + err.message,
                code: err.code
            });
        }
    } finally {
        client.release();
    }
});

app.post('/api/financials/close-week', authenticate, checkPermission('add'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { week_start } = req.body;
        
        console.log('Closing week starting:', week_start);
        
        if (!week_start) {
            return res.status(400).json({ error: 'Week start date is required' });
        }
        
        // Validate that week_start is a Monday
        const weekStartDate = new Date(week_start);
        if (weekStartDate.getDay() !== 1) {
            return res.status(400).json({ error: 'Week must start on Monday' });
        }
        
        await client.query('BEGIN');
        
        // Calculate week end (Sunday)
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekEndDate.getDate() + 6);
        
        // Archive all transactions for this week
        const archiveResult = await client.query(
            `UPDATE financial_transactions 
             SET archived = true 
             WHERE transaction_date >= $1 
             AND transaction_date <= $2
             AND archived = false
             RETURNING COUNT(*) as count`,
            [
                weekStartDate.toISOString().split('T')[0],
                weekEndDate.toISOString().split('T')[0]
            ]
        );
        
        const transactionCount = parseInt(archiveResult.rows[0].count);
        
        // Calculate week totals
        const totalsResult = await client.query(
            `SELECT 
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses
             FROM financial_transactions 
             WHERE transaction_date >= $1 
             AND transaction_date <= $2
             AND archived = true`,
            [
                weekStartDate.toISOString().split('T')[0],
                weekEndDate.toISOString().split('T')[0]
            ]
        );
        
        const totals = totalsResult.rows[0];
        const netBalance = totals.income - totals.expenses;
        
        // Create week summary record
        await client.query(
            `INSERT INTO financial_weeks (
                week_start, week_end, income_total, expense_total, net_balance,
                transaction_count, closed_by, closed_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            [
                weekStartDate.toISOString().split('T')[0],
                weekEndDate.toISOString().split('T')[0],
                totals.income,
                totals.expenses,
                netBalance,
                transactionCount,
                req.username
            ]
        );
        
        await logAction(req.userId, 'close_financial_week', {
            week_start: weekStartDate.toISOString().split('T')[0],
            week_end: weekEndDate.toISOString().split('T')[0],
            transaction_count: transactionCount,
            income: totals.income,
            expenses: totals.expenses,
            net_balance: netBalance
        });
        
        await client.query('COMMIT');
        
        console.log(`Week closed successfully: ${transactionCount} transactions archived`);
        
        res.json({
            message: 'Week closed successfully',
            week_summary: {
                week_start: weekStartDate.toISOString().split('T')[0],
                week_end: weekEndDate.toISOString().split('T')[0],
                transaction_count: transactionCount,
                income: totals.income,
                expenses: totals.expenses,
                net_balance: netBalance
            }
        });
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error closing week:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    } finally {
        client.release();
    }
});

app.get('/api/financials/closed-weeks', authenticate, checkPermission('view'), async (req, res) => {
    try {
        const { month, year } = req.query;
        
        let query = 'SELECT * FROM financial_weeks ORDER BY week_start DESC';
        let params = [];
        
        if (month && year) {
            query = `
                SELECT * FROM financial_weeks 
                WHERE EXTRACT(YEAR FROM week_start) = $1 
                AND EXTRACT(MONTH FROM week_start) = $2
                ORDER BY week_start DESC
            `;
            params = [year, month];
        }
        
        const result = await pool.query(query, params);
        
        res.json(result.rows);
        
    } catch (error) {
        console.error('Error fetching closed weeks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET financial summary 
app.get('/api/financials/summary', authenticate, checkPermission('view'), async (req, res) => {
    try {
        console.log('Fetching financial summary');
        
        // Get current week totals (non-archived)
        const currentWeekQuery = `
            SELECT 
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses,
                COUNT(*) as count
            FROM financial_transactions 
            WHERE archived = false
        `;
        
        // Get overall totals (archived AND non-archived combined)
        const overallQuery = `
            SELECT 
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses
            FROM financial_transactions
        `;
        
        const [currentWeekResult, overallResult] = await Promise.all([
            pool.query(currentWeekQuery),
            pool.query(overallQuery)
        ]);
        
        const currentWeek = currentWeekResult.rows[0];
        const overall = overallResult.rows[0];
        
        console.log('Summary results:', { currentWeek, overall });
        
        res.json({
            current_week: {
                income: parseFloat(currentWeek.income) || 0,
                expenses: parseFloat(currentWeek.expenses) || 0,
                balance: (parseFloat(currentWeek.income) || 0) - (parseFloat(currentWeek.expenses) || 0),
                transaction_count: parseInt(currentWeek.count) || 0
            },
            overall: {
                total_income: parseFloat(overall.total_income) || 0,
                total_expenses: parseFloat(overall.total_expenses) || 0,
                net_balance: (parseFloat(overall.total_income) || 0) - (parseFloat(overall.total_expenses) || 0)
            }
        });
        
    } catch (error) {
        console.error('Error fetching financial summary:', error);
        
        // If table doesn't exist yet, create it and return zeros
        if (error.code === '42P01') {
            console.log('Creating financial tables...');
            
            try {
                // Create tables
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS financial_transactions (
                        id SERIAL PRIMARY KEY,
                        transaction_date DATE NOT NULL,
                        description TEXT NOT NULL,
                        category VARCHAR(100) NOT NULL,
                        type VARCHAR(20) CHECK (type IN ('income', 'expense')) NOT NULL,
                        amount DECIMAL(10, 2) NOT NULL,
                        week_start DATE,
                        reference VARCHAR(100),
                        notes TEXT,
                        archived BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS financial_weeks (
                        id SERIAL PRIMARY KEY,
                        week_start DATE NOT NULL,
                        week_end DATE NOT NULL,
                        income_total DECIMAL(10, 2) DEFAULT 0,
                        expense_total DECIMAL(10, 2) DEFAULT 0,
                        net_balance DECIMAL(10, 2) DEFAULT 0,
                        transaction_count INTEGER DEFAULT 0,
                        closed_by VARCHAR(100),
                        closed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(week_start, week_end)
                    )
                `);
                
                console.log('Financial tables created successfully');
                
                // Insert some sample data for testing
                const sampleDate = new Date().toISOString().split('T')[0];
                await pool.query(`
                    INSERT INTO financial_transactions 
                    (transaction_date, description, category, type, amount, archived)
                    VALUES 
                    ($1, 'Sunday Offering', 'Offering', 'income', 1230.00, false),
                    ($2, 'Electricity Bill', 'Utilities', 'expense', 150.00, false)
                    ON CONFLICT DO NOTHING
                `, [sampleDate, sampleDate]);
                
            } catch (createError) {
                console.error('Error creating tables:', createError);
            }
            
            // Return zeros initially
            res.json({
                current_week: {
                    income: 0,
                    expenses: 0,
                    balance: 0,
                    transaction_count: 0
                },
                overall: {
                    total_income: 0,
                    total_expenses: 0,
                    net_balance: 0
                }
            });
        } else {
            res.status(500).json({ 
                error: 'Internal server error',
                message: error.message 
            });
        }
    }
});

// ============ FINANCIALS ENDPOINTS ============

// First, let's create a simple test endpoint to verify the route is working
app.get('/api/financials/test', authenticate, (req, res) => {
    console.log('Financials test endpoint hit');
    res.json({ message: 'Financials API is working', user: req.username });
});

// GET financial data with period filtering - REAL VERSION
app.get('/api/financials', authenticate, checkPermission('view'), async (req, res) => {
    try {
        const { period = 'weekly' } = req.query;
        
        console.log(`Fetching financials for period: ${period}`);
        
        let query = '';
        
        if (period === 'weekly') {
            // Show ALL transactions (both archived and non-archived) for weekly view
            query = `
                SELECT * FROM financial_transactions 
                ORDER BY transaction_date DESC, id DESC
                LIMIT 100
            `;
        } else if (period === 'monthly') {
            // Show monthly aggregates from ALL transactions (not just archived)
            query = `
                SELECT 
                    DATE_TRUNC('month', transaction_date) as month,
                    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
                    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses,
                    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as balance,
                    COUNT(*) as transaction_count
                FROM financial_transactions
                GROUP BY DATE_TRUNC('month', transaction_date)
                ORDER BY month DESC
            `;
        } else if (period === 'quarterly') {
            // Show quarterly aggregates from ALL transactions
            query = `
                SELECT 
                    EXTRACT(YEAR FROM transaction_date) as year,
                    EXTRACT(QUARTER FROM transaction_date) as quarter,
                    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
                    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses,
                    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as balance,
                    COUNT(*) as transaction_count
                FROM financial_transactions
                GROUP BY EXTRACT(YEAR FROM transaction_date), EXTRACT(QUARTER FROM transaction_date)
                ORDER BY year DESC, quarter DESC
            `;
        } else if (period === 'yearly') {
            // Show yearly aggregates from ALL transactions
            query = `
                SELECT 
                    EXTRACT(YEAR FROM transaction_date) as year,
                    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
                    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses,
                    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as balance,
                    COUNT(*) as transaction_count
                FROM financial_transactions
                GROUP BY EXTRACT(YEAR FROM transaction_date)
                ORDER BY year DESC
            `;
        } else {
            return res.status(400).json({ error: 'Invalid period specified' });
        }
        
        console.log('Executing financials query:', query);
        const result = await pool.query(query);
        
        console.log(`Found ${result.rows.length} records for ${period}`);
        
        res.json(result.rows);
        
    } catch (error) {
        console.error('Error fetching financials:', error);
        
        // If table doesn't exist yet, return empty array
        if (error.code === '42P01') {
            res.json([]);
        } else {
            res.status(500).json({ 
                error: 'Internal server error',
                message: error.message
            });
        }
    }
});

// POST new financial transaction
app.post('/api/financials', authenticate, checkPermission('add'), async (req, res) => {
    try {
        console.log('Received financial transaction:', req.body);
        
        const {
            date: transaction_date,
            description,
            category,
            amount,
            week_start,
            reference,
            notes
        } = req.body;
        
        // Validate required fields
        if (!transaction_date || !description || !category || !amount || amount <= 0) {
            return res.status(400).json({ 
                error: 'Missing or invalid required fields',
                required: ['date', 'description', 'category', 'amount'],
                received: req.body
            });
        }
        
        // Determine type based on category
        let transactionType = 'income'; // Default
        const expenseCategories = ['Utilities', 'Maintenance', 'Staff', 'Supplies', 'Outreach', 'Other Expense'];
        if (expenseCategories.includes(category)) {
            transactionType = 'expense';
        }
        
        // For now, just return success without saving to DB
        // We'll implement database storage after creating tables
        
        const mockTransaction = {
            id: Math.floor(Math.random() * 1000),
            transaction_date,
            description,
            category,
            type: transactionType,
            amount: parseFloat(amount),
            week_start: week_start || null,
            reference: reference || null,
            notes: notes || null,
            archived: false,
            created_at: new Date().toISOString()
        };
        
        console.log('Created mock transaction:', mockTransaction);
        
        // Log the action
        await logAction(req.userId, 'add_financial_transaction', {
            description,
            category,
            type: transactionType,
            amount
        });
        
        res.status(201).json({
            message: 'Transaction recorded successfully (mock)',
            transaction: mockTransaction,
            note: 'Database tables need to be created for permanent storage'
        });
        
    } catch (error) {
        console.error('Error adding financial transaction:', error);
        res.status(500).json({ 
            error: 'Server error',
            message: error.message
        });
    }
});

// GET financial summary
app.get('/api/financials/summary', authenticate, checkPermission('view'), async (req, res) => {
    try {
        // Mock summary data
        const mockSummary = {
            current_week: {
                income: 7500.00,
                expenses: 2500.00,
                balance: 5000.00,
                transaction_count: 5
            },
            overall: {
                total_income: 45000.00,
                total_expenses: 18000.00,
                net_balance: 27000.00
            }
        };
        
        res.json(mockSummary);
        
    } catch (error) {
        console.error('Error fetching financial summary:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST close financial week
app.post('/api/financials/close-week', authenticate, checkPermission('add'), async (req, res) => {
    try {
        const { week_start } = req.body;
        
        if (!week_start) {
            return res.status(400).json({ error: 'Week start date is required' });
        }
        
        // Mock response
        const mockResponse = {
            message: 'Week closed successfully (mock)',
            week_summary: {
                week_start,
                week_end: new Date(new Date(week_start).getTime() + 6 * 86400000).toISOString().split('T')[0],
                transaction_count: 8,
                income: 7500.00,
                expenses: 2500.00,
                net_balance: 5000.00
            },
            note: 'Database tables need to be created for permanent storage'
        };
        
        // Log the action
        await logAction(req.userId, 'close_financial_week', {
            week_start,
            transaction_count: 8
        });
        
        res.json(mockResponse);
        
    } catch (error) {
        console.error('Error closing week:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET closed weeks - REAL VERSION
app.get('/api/financials/closed-weeks', authenticate, checkPermission('view'), async (req, res) => {
    try {
        const { month, year } = req.query;
        
        let query = 'SELECT * FROM financial_weeks ORDER BY week_start DESC';
        let params = [];
        
        if (month && year) {
            query = `
                SELECT * FROM financial_weeks 
                WHERE EXTRACT(YEAR FROM week_start) = $1 
                AND EXTRACT(MONTH FROM week_start) = $2
                ORDER BY week_start DESC
            `;
            params = [year, month];
        }
        
        console.log('Fetching closed weeks with query:', query);
        const result = await pool.query(query, params);
        
        console.log(`Found ${result.rows.length} closed weeks`);
        
        res.json(result.rows);
        
    } catch (error) {
        console.error('Error fetching closed weeks:', error);
        
        // If table doesn't exist yet, return empty array
        if (error.code === '42P01') {
            res.json([]);
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// GET financial data by category
app.get('/api/financials/categories', authenticate, checkPermission('view'), async (req, res) => {
    try {
        console.log('Fetching financials by category');
        
        // Get category aggregates
        const query = `
            SELECT 
                category,
                type,
                COUNT(*) as transaction_count,
                SUM(amount) as total_amount
            FROM financial_transactions 
            WHERE archived = false
            GROUP BY category, type
            ORDER BY type DESC, total_amount DESC
        `;
        
        console.log('Executing categories query:', query);
        const result = await pool.query(query);
        
        console.log(`Found ${result.rows.length} category records`);
        
        // Calculate totals
        let totalIncome = 0;
        let totalExpenses = 0;
        let totalTransactions = 0;
        let totalAmount = 0;
        
        const categories = result.rows.map(row => {
            const amount = parseFloat(row.total_amount) || 0;
            const count = parseInt(row.transaction_count) || 0;
            
            if (row.type === 'income') {
                totalIncome += amount;
            } else if (row.type === 'expense') {
                totalExpenses += Math.abs(amount);
            }
            
            totalTransactions += count;
            totalAmount += Math.abs(amount);
            
            return {
                ...row,
                total_amount: amount,
                transaction_count: count
            };
        });
        
        // Find top categories
        const incomeCategories = categories.filter(c => c.type === 'income');
        const expenseCategories = categories.filter(c => c.type === 'expense');
        
        const topIncomeCategory = incomeCategories.length > 0 
            ? incomeCategories[0] 
            : null;
        
        const topExpenseCategory = expenseCategories.length > 0 
            ? expenseCategories[0] 
            : null;
        
        res.json({
            categories,
            totals: {
                income: totalIncome,
                expenses: totalExpenses,
                transactions: totalTransactions,
                amount: totalAmount
            },
            top_categories: {
                income: topIncomeCategory,
                expense: topExpenseCategory
            }
        });
        
    } catch (error) {
        console.error('Error fetching categories:', error);
        
        // If table doesn't exist yet, return empty data
        if (error.code === '42P01') {
            res.json({
                categories: [],
                totals: {
                    income: 0,
                    expenses: 0,
                    transactions: 0,
                    amount: 0
                },
                top_categories: {
                    income: null,
                    expense: null
                }
            });
        } else {
            res.status(500).json({ 
                error: 'Internal server error',
                message: error.message
            });
        }
    }
});

// Auto-archive transactions older than 7 days (optional)
async function autoArchiveOldTransactions() {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        await pool.query(
            `UPDATE financial_transactions 
             SET archived = true 
             WHERE transaction_date < $1 
             AND archived = false`,
            [sevenDaysAgo.toISOString().split('T')[0]]
        );
        
        console.log('Auto-archive completed');
    } catch (error) {
        console.error('Error in auto-archive:', error);
    }
}

// Run auto-archive daily (optional)
setInterval(autoArchiveOldTransactions, 24 * 60 * 60 * 1000);
// ============ FINANCIALS CATEGORIES ENDPOINT ============

// GET financial data by category
app.get('/api/financials/categories', authenticate, checkPermission('view'), async (req, res) => {
    try {
        console.log('Fetching financials by category');
        
        // Get category aggregates from ALL transactions
        const query = `
            SELECT 
                category,
                type,
                COUNT(*) as transaction_count,
                SUM(amount) as total_amount
            FROM financial_transactions 
            GROUP BY category, type
            ORDER BY type DESC, total_amount DESC
        `;
        
        console.log('Executing categories query:', query);
        const result = await pool.query(query);
        
        console.log(`Found ${result.rows.length} category records`);
        
        // Calculate totals
        let totalIncome = 0;
        let totalExpenses = 0;
        let totalTransactions = 0;
        let totalAmount = 0;
        
        const categories = result.rows.map(row => {
            const amount = parseFloat(row.total_amount) || 0;
            const count = parseInt(row.transaction_count) || 0;
            
            if (row.type === 'income') {
                totalIncome += amount;
            } else if (row.type === 'expense') {
                totalExpenses += Math.abs(amount);
            }
            
            totalTransactions += count;
            totalAmount += Math.abs(amount);
            
            return {
                ...row,
                total_amount: amount,
                transaction_count: count
            };
        });
        
        // Find top categories
        const incomeCategories = categories.filter(c => c.type === 'income');
        const expenseCategories = categories.filter(c => c.type === 'expense');
        
        const topIncomeCategory = incomeCategories.length > 0 
            ? incomeCategories[0] 
            : null;
        
        const topExpenseCategory = expenseCategories.length > 0 
            ? expenseCategories[0] 
            : null;
        
        res.json({
            categories,
            totals: {
                income: totalIncome,
                expenses: totalExpenses,
                transactions: totalTransactions,
                amount: totalAmount
            },
            top_categories: {
                income: topIncomeCategory,
                expense: topExpenseCategory
            }
        });
        
    } catch (error) {
        console.error('Error fetching categories:', error);
        
        // If table doesn't exist yet, return empty data
        if (error.code === '42P01') {
            res.json({
                categories: [],
                totals: {
                    income: 0,
                    expenses: 0,
                    transactions: 0,
                    amount: 0
                },
                top_categories: {
                    income: null,
                    expense: null
                }
            });
        } else {
            res.status(500).json({ 
                error: 'Internal server error',
                message: error.message
            });
        }
    }
});


// ============ ADMIN ENDPOINTS ============

app.get('/api/admin/users', authenticate, checkPermission('admin'), async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, role, created_at FROM users ORDER BY created_at DESC'
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/admin/action_logs', authenticate, checkPermission('admin'), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT al.id, u.username, al.action, al.details, al.timestamp 
             FROM action_logs al 
             JOIN users u ON al.user_id = u.id 
             ORDER BY al.timestamp DESC 
             LIMIT 100`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching action logs:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/admin/roles', authenticate, checkPermission('admin'), async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM roles ORDER BY role_name');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching roles:', err);
        res.status(500).json({ error: 'Server error' });
    }
});
// ============ ERROR HANDLING ============


app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
    console.log(`404: Route not found: ${req.method} ${req.url}`);
    res.status(404).json({ error: 'Endpoint not found' });
});

// ============ START SERVER ============

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Static files served from: ${path.join(__dirname, 'public')}`);
    console.log(`JWT Secret: ${JWT_SECRET ? 'Loaded' : 'Not loaded'}`);
});