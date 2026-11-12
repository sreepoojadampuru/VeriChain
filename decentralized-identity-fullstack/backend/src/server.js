import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { randomBytes, keccak256, toUtf8Bytes } from 'ethers';
import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  hashPassword,
  verifyPassword,
  generateToken,
  authenticateToken,
  allowRoles
} from './auth.js';

import { encryptBuffer, decryptBuffer } from './encryption.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DB_FILE = join(__dirname, 'credentials.json');
const USER_DB_FILE = join(__dirname, 'users.json');
const DOCUMENT_DB_FILE = join(__dirname, 'documents.json');
const STORAGE_DIR = join(__dirname, '..', 'storage');
const ACCESS_REQUEST_DB_FILE = join(__dirname, 'accessRequests.json');
const AUDIT_LOG_DB_FILE = join(__dirname, 'auditLogs.json');

const app = express();
const FRONTEND_DIST = join(__dirname, '../../frontend/dist');
const PORT = process.env.PORT || 4000;

// ------------------------------------
// MIDDLEWARE
// ------------------------------------

app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new Error('Only PDF, JPG and PNG files are allowed.')
      );
    }

    callback(null, true);
  }
});

// ------------------------------------
// DATABASE FUNCTIONS
// ------------------------------------

async function readDb() {
  try {
    return JSON.parse(await readFile(DB_FILE, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeDb(data) {
  await writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

async function readUsers() {
  try {
    return JSON.parse(await readFile(USER_DB_FILE, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeUsers(users) {
  await writeFile(USER_DB_FILE, JSON.stringify(users, null, 2));
}

async function readDocuments() {
  try {
    return JSON.parse(await readFile(DOCUMENT_DB_FILE, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeDocuments(documents) {
  await writeFile(
    DOCUMENT_DB_FILE,
    JSON.stringify(documents, null, 2)
  );
}

async function readAccessRequests() {
  try {
    return JSON.parse(await readFile(ACCESS_REQUEST_DB_FILE, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeAccessRequests(requests) {
  await writeFile(
    ACCESS_REQUEST_DB_FILE,
    JSON.stringify(requests, null, 2)
  );
}

async function readAuditLogs() {
  try {
    return JSON.parse(await readFile(AUDIT_LOG_DB_FILE, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeAuditLogs(logs) {
  await writeFile(
    AUDIT_LOG_DB_FILE,
    JSON.stringify(logs, null, 2)
  );
}

async function addAuditLog({
  actorId,
  action,
  documentId = null,
  details = {}
}) {
  const logs = await readAuditLogs();

  logs.push({
    id: randomUUID(),
    actorId,
    action,
    documentId,
    details,
    createdAt: new Date().toISOString()
  });

  await writeAuditLogs(logs);
}

// ------------------------------------
// FILE SIGNATURE VALIDATION
// ------------------------------------

function isValidFileSignature(buffer, mimeType) {
  if (mimeType === 'application/pdf') {
    return buffer.subarray(0, 5).toString() === '%PDF-';
  }

  if (mimeType === 'image/png') {
    return buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    );
  }

  if (mimeType === 'image/jpeg') {
    return (
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  return false;
}

// ------------------------------------
// EXISTING CREDENTIAL HASH FUNCTION
// ------------------------------------

function makeHash(fields) {
  const canonical = JSON.stringify({
    studentName: fields.studentName,
    credentialName: fields.credentialName,
    studentId: fields.studentId,
    issuedOn: fields.issuedOn
  });

  return keccak256(toUtf8Bytes(canonical));
}

// ------------------------------------
// HEALTH CHECK
// ------------------------------------

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'credential-registry-backend'
  });
});

// ------------------------------------
// EXISTING CREDENTIAL APIs
// ------------------------------------

app.post('/api/credentials', async (req, res) => {
  try {
    const {
      studentName,
      credentialName,
      studentId,
      issuedOn
    } = req.body || {};

    if (![studentName, credentialName, studentId, issuedOn]
      .every(v => typeof v === 'string' && v.trim())) {
      return res.status(400).json({
        error: 'studentName, credentialName, studentId and issuedOn are required.'
      });
    }

    const fields = {
      studentName: studentName.trim(),
      credentialName: credentialName.trim(),
      studentId: studentId.trim(),
      issuedOn: issuedOn.trim()
    };

    const credentialId =
      '0x' + Buffer.from(randomBytes(32)).toString('hex');

    const dataHash = makeHash(fields);

    const record = {
      credentialId,
      ...fields,
      dataHash,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    const db = await readDb();
    db.push(record);
    await writeDb(db);

    res.status(201).json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Could not prepare credential.'
    });
  }
});

app.get('/api/credentials', async (_req, res) => {
  try {
    const db = await readDb();

    res.json(db.map(({
      studentName,
      credentialName,
      studentId,
      issuedOn,
      credentialId,
      status,
      createdAt
    }) => ({
      studentName,
      credentialName,
      studentId,
      issuedOn,
      credentialId,
      status,
      createdAt
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Could not read credentials.'
    });
  }
});

app.get('/api/credentials/:id', async (req, res) => {
  try {
    const db = await readDb();

    const record = db.find(
      c => c.credentialId.toLowerCase() === req.params.id.toLowerCase()
    );

    if (!record) {
      return res.status(404).json({
        error: 'Credential not found in backend.'
      });
    }

    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Could not read credential.'
    });
  }
});

app.patch('/api/credentials/:id/status', async (req, res) => {
  try {
    const { status } = req.body || {};

    if (!['issued', 'revoked'].includes(status)) {
      return res.status(400).json({
        error: 'Status must be issued or revoked.'
      });
    }

    const db = await readDb();

    const record = db.find(
      c => c.credentialId.toLowerCase() === req.params.id.toLowerCase()
    );

    if (!record) {
      return res.status(404).json({
        error: 'Credential not found.'
      });
    }

    record.status = status;
    await writeDb(db);

    res.json({ ok: true, status });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Could not update status.'
    });
  }
});
// ------------------------------------
// STUDENT REGISTRATION
// ------------------------------------

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !name.trim() ||
      !email.trim() ||
      password.length < 8 ||
      password.length > 128
    ) {
      return res.status(400).json({
        error: 'Valid name, email and password (8-128 characters) are required.'
      });
    }

    const users = await readUsers();
    const normalizedEmail = email.trim().toLowerCase();

    if (users.some(user => user.email === normalizedEmail)) {
      return res.status(409).json({
        error: 'Email is already registered.'
      });
    }

    const user = {
      id: randomUUID(),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await hashPassword(password),
      role: 'student',
      createdAt: new Date().toISOString()
    };

    users.push(user);
    await writeUsers(users);

    const token = generateToken(user);

    res.status(201).json({
      message: 'Registration successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Registration failed.'
    });
  }
});


// ------------------------------------
// USER LOGIN
// ------------------------------------

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (
      typeof email !== 'string' ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({
        error: 'Email and password are required.'
      });
    }

    const users = await readUsers();
    const normalizedEmail = email.trim().toLowerCase();

    const user = users.find(
      item => item.email === normalizedEmail
    );

    if (
      !user ||
      !(await verifyPassword(password, user.passwordHash))
    ) {
      return res.status(401).json({
        error: 'Invalid email or password.'
      });
    }

    const token = generateToken(user);

    res.json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Login failed.'
    });
  }
});


// ------------------------------------
// GET LOGGED-IN USER
// ------------------------------------

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const users = await readUsers();

    const user = users.find(
      item => item.id === req.user.userId
    );

    if (!user) {
      return res.status(404).json({
        error: 'User not found.'
      });
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Could not retrieve user.'
    });
  }
});


// ------------------------------------
// ONE-TIME ADMIN BOOTSTRAP
// ------------------------------------

// Add ADMIN_BOOTSTRAP_KEY to backend/.env before using this endpoint.
// Only the first admin can be created through this route.

app.post('/api/auth/bootstrap-admin', async (req, res) => {
  try {
    const configuredKey = process.env.ADMIN_BOOTSTRAP_KEY;
    const suppliedKey = req.get('x-bootstrap-key') || '';

    if (!configuredKey || configuredKey.length < 32) {
      return res.status(503).json({
        error: 'Admin bootstrap is not configured on the server.'
      });
    }

    const expected = Buffer.from(configuredKey);
    const supplied = Buffer.from(suppliedKey);

    if (
      expected.length !== supplied.length ||
      !timingSafeEqual(expected, supplied)
    ) {
      return res.status(401).json({
        error: 'Invalid bootstrap key.'
      });
    }

    const users = await readUsers();

    if (users.some(user => user.role === 'admin')) {
      return res.status(409).json({
        error: 'An administrator already exists. Bootstrap is disabled.'
      });
    }

    const { name, email, password } = req.body || {};

    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !name.trim() ||
      !email.trim() ||
      password.length < 12 ||
      password.length > 128
    ) {
      return res.status(400).json({
        error: 'Name, email and a password of 12-128 characters are required.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (users.some(user => user.email === normalizedEmail)) {
      return res.status(409).json({
        error: 'Email is already registered.'
      });
    }

    const admin = {
      id: randomUUID(),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await hashPassword(password),
      role: 'admin',
      createdAt: new Date().toISOString()
    };

    users.push(admin);
    await writeUsers(users);

    return res.status(201).json({
      message: 'Initial administrator created. Remove ADMIN_BOOTSTRAP_KEY from backend/.env and restart the server.',
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });

  } catch (error) {
    console.error('Admin bootstrap error:', error);

    return res.status(500).json({
      error: 'Could not create initial administrator.'
    });
  }
});


// ------------------------------------
// ADMIN: CREATE AUTHORITY / INSTITUTION
// ------------------------------------

app.post(
  '/api/admin/create-user',
  authenticateToken,
  allowRoles('admin'),
  async (req, res) => {
    try {
      const { name, email, password, role } = req.body || {};

      const allowedRoles = [
        'authority',
        'institution'
      ];

      if (
        typeof name !== 'string' ||
        typeof email !== 'string' ||
        typeof password !== 'string' ||
        !name.trim() ||
        !email.trim() ||
        password.length < 12 ||
        password.length > 128 ||
        !allowedRoles.includes(role)
      ) {
        return res.status(400).json({
          error: 'Valid name, email, password (12-128 characters), and role (authority or institution) are required.'
        });
      }

      const users = await readUsers();
      const normalizedEmail = email.trim().toLowerCase();

      if (users.some(user => user.email === normalizedEmail)) {
        return res.status(409).json({
          error: 'Email is already registered.'
        });
      }

      const user = {
        id: randomUUID(),
        name: name.trim(),
        email: normalizedEmail,
        passwordHash: await hashPassword(password),
        role,
        createdAt: new Date().toISOString(),
        createdBy: req.user.userId
      };

      users.push(user);
      await writeUsers(users);

      await addAuditLog({
        actorId: req.user.userId,
        action: 'account_created',
        details: {
          createdUserId: user.id,
          createdRole: user.role,
          createdEmail: user.email
        }
      });

      return res.status(201).json({
        message: `${role} account created successfully.`,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });

    } catch (error) {
      console.error('Create user error:', error);

      return res.status(500).json({
        error: 'Could not create user account.'
      });
    }
  }
);
// ------------------------------------
// ENCRYPTED DOCUMENT UPLOAD
// ------------------------------------

app.post(
  '/api/documents/upload',
  authenticateToken,
  allowRoles('student'),
  upload.single('document'),
  async (req, res) => {
    let storagePath;

    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'Please select a document.'
        });
      }

      const {
        originalname,
        mimetype,
        buffer,
        size
      } = req.file;

      // Validate actual file signature.
      if (!isValidFileSignature(buffer, mimetype)) {
        return res.status(400).json({
          error: 'The uploaded file is invalid or its format does not match.'
        });
      }

      // Generate SHA-256 hash of the original document.
      const documentHash = createHash('sha256')
        .update(buffer)
        .digest('hex');

      const documents = await readDocuments();

      // Detect exact duplicate files.
      const duplicates = documents.filter(
        doc => doc.documentHash === documentHash
      );

      // Encrypt document using AES-256-GCM.
      const encrypted = encryptBuffer(buffer);

      const documentId = randomUUID();

      const extension = {
        'application/pdf': '.pdf',
        'image/jpeg': '.jpg',
        'image/png': '.png'
      }[mimetype];

      const storageName = `${documentId}.enc`;

      await mkdir(STORAGE_DIR, { recursive: true });

      storagePath = join(STORAGE_DIR, storageName);

      // Store only encrypted document bytes.
      await writeFile(
        storagePath,
        encrypted.encryptedData,
        { flag: 'wx' }
      );

      const duplicateDetected = duplicates.length > 0;

      const record = {
        id: documentId,
        ownerId: req.user.userId,
        originalName: originalname
          .replace(/[\\/]/g, '_')
          .slice(0, 150),
        mimeType: mimetype,
        extension,
        size,
        documentHash,
        storageName,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        status: duplicateDetected
          ? 'review_required'
          : 'pending_authority',
        authorityApproval: 'pending',
        adminApproval: 'pending',
        duplicateDetected,
        duplicateOf: duplicateDetected
          ? duplicates.map(doc => doc.id)
          : [],
        uploadedAt: new Date().toISOString()
      };

      // Put both matching records on hold.
      if (duplicateDetected) {
        for (const duplicate of duplicates) {
          duplicate.status = 'review_required';
          duplicate.duplicateDetected = true;

          duplicate.duplicateOf = [
            ...new Set([
              ...(duplicate.duplicateOf || []),
              documentId
            ])
          ];
        }
      }

      documents.push(record);
      await writeDocuments(documents);

      await addAuditLog({
        actorId: req.user.userId,
        action: 'document_uploaded',
        documentId,
        details: {
          originalName: record.originalName,
          duplicateDetected
        }
      });

      return res.status(201).json({
        message: duplicateDetected
          ? 'Duplicate detected. Documents have been placed on hold for review.'
          : 'Document encrypted and uploaded successfully.',
        document: {
          id: record.id,
          originalName: record.originalName,
          documentHash: record.documentHash,
          status: record.status,
          duplicateDetected: record.duplicateDetected,
          uploadedAt: record.uploadedAt
        }
      });

    } catch (error) {
      console.error('Document upload error:', error);

      // Remove encrypted file if metadata saving failed.
      if (storagePath) {
        try {
          const { unlink } = await import('node:fs/promises');
          await unlink(storagePath);
        } catch {
          // Ignore cleanup errors.
        }
      }

      return res.status(500).json({
        error: 'Could not upload and encrypt document.'
      });
    }
  }
);


// ------------------------------------
// GET MY DOCUMENTS
// ------------------------------------

app.get(
  '/api/documents/my',
  authenticateToken,
  async (req, res) => {
    try {
      const documents = await readDocuments();

      const myDocuments = documents
        .filter(doc => doc.ownerId === req.user.userId)
        .map(doc => ({
          id: doc.id,
          originalName: doc.originalName,
          mimeType: doc.mimeType,
          size: doc.size,
          documentHash: doc.documentHash,
          status: doc.status,
          authorityApproval: doc.authorityApproval,
          adminApproval: doc.adminApproval,
          duplicateDetected: doc.duplicateDetected,
          uploadedAt: doc.uploadedAt
        }));

      res.json({
        total: myDocuments.length,
        documents: myDocuments
      });

    } catch (error) {
      console.error('My documents error:', error);

      res.status(500).json({
        error: 'Could not retrieve your documents.'
      });
    }
  }
);


// ------------------------------------
// UPLOAD ERROR HANDLER
// ------------------------------------

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      error: error.code === 'LIMIT_FILE_SIZE'
        ? 'File size must not exceed 10 MB.'
        : 'File upload failed.'
    });
  }

  if (error.message?.startsWith('Only PDF')) {
    return res.status(400).json({
      error: error.message
    });
  }

  console.error(error);

  return res.status(500).json({
    error: 'An unexpected server error occurred.'
  });
});


// ------------------------------------
// START SERVER
// ------------------------------------

// AUTHORITY: View documents waiting for verification
app.get(
  '/api/authority/documents/pending',
  authenticateToken,
  allowRoles('authority'),
  async (req, res) => {
    try {
      const documents = await readDocuments();

      const pendingDocuments = documents
        .filter((doc) =>
          ['pending_authority', 'review_required'].includes(doc.status)
        )
        .map((doc) => ({
          id: doc.id,
          ownerId: doc.ownerId,
          originalName: doc.originalName,
          mimeType: doc.mimeType,
          size: doc.size,
          documentHash: doc.documentHash,
          status: doc.status,
          duplicateDetected: doc.duplicateDetected,
          uploadedAt: doc.uploadedAt
        }));

      res.json({
        count: pendingDocuments.length,
        documents: pendingDocuments
      });
    } catch (error) {
      console.error('Authority pending documents error:', error);
      res.status(500).json({ error: 'Failed to load pending documents.' });
    }
  }
);


// AUTHORITY: Securely view a pending document
app.get(
  '/api/authority/documents/:id/view',
  authenticateToken,
  allowRoles('authority'),
  async (req, res) => {
    try {
      const documents = await readDocuments();

      const document = documents.find(
        (doc) => doc.id === req.params.id
      );

      if (!document) {
        return res.status(404).json({
          error: 'Document not found.'
        });
      }

      if (!['pending_authority', 'review_required'].includes(document.status)) {
        return res.status(403).json({
          error: 'This document is not awaiting authority review.'
        });
      }

      // Read the encrypted file using the imported readFile function.
      const encryptedPath = join(
        STORAGE_DIR,
        document.storageName
      );

      const encryptedData = await readFile(encryptedPath);

      // Decrypt using AES-256-GCM.
      const decryptedData = decryptBuffer(
        encryptedData,
        document.iv,
        document.authTag
      );

      // Verify original document integrity using SHA-256.
      const actualHash = createHash('sha256')
        .update(decryptedData)
        .digest('hex');

      if (actualHash !== document.documentHash) {
        await addAuditLog({
          actorId: req.user.userId,
          action: 'document_integrity_check_failed',
          documentId: document.id
        });

        return res.status(409).json({
          error: 'Document integrity verification failed.'
        });
      }

      // Record successful document viewing.
      await addAuditLog({
        actorId: req.user.userId,
        action: 'authority_viewed_document',
        documentId: document.id
      });

      res.setHeader('Content-Type', document.mimeType);
      res.setHeader(
        'Content-Disposition',
        'inline; filename="document"'
      );
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      return res.send(decryptedData);

    } catch (error) {
      console.error('Authority document viewing error:', error);

      return res.status(500).json({
        error: 'Unable to securely view document.'
      });
    }
  }
);

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
// AUTHORITY: Approve or reject a student document
app.patch(
  '/api/authority/documents/:id/review',
  authenticateToken,
  allowRoles('authority'),
  async (req, res) => {
    try {
      const { decision, reason } = req.body;

      if (!['approved', 'rejected'].includes(decision)) {
        return res.status(400).json({
          error: 'Decision must be approved or rejected.'
        });
      }

      if (decision === 'rejected' &&
          (!reason || !reason.trim())) {
        return res.status(400).json({
          error: 'A rejection reason is required.'
        });
      }

      const documents = await readDocuments();

      const documentIndex = documents.findIndex(
        (doc) => doc.id === req.params.id
      );

      if (documentIndex === -1) {
        return res.status(404).json({
          error: 'Document not found.'
        });
      }

      const document = documents[documentIndex];

      if (!['pending_authority', 'review_required'].includes(document.status)) {
        return res.status(409).json({
          error: 'This document is not awaiting authority review.'
        });
      }

      if (document.duplicateDetected) {
        return res.status(409).json({
          error: 'Duplicate document requires manual resolution before approval.'
        });
      }

      document.authorityApproval = decision;
      document.authorityReviewedBy = req.user.userId;
      document.authorityReviewedAt = new Date().toISOString();
      document.authorityReason = reason?.trim() || null;

      document.status = decision === 'approved'
        ? 'pending_admin'
        : 'rejected_by_authority';

      documents[documentIndex] = document;
      await writeDocuments(documents);
      await addAuditLog({
        actorId: req.user.userId,
        action: `authority_document_${decision}`,
        documentId: document.id,
        details: {
          reason: document.authorityReason
        }
      });

      return res.json({
        message: `Document ${decision} successfully.`,
        document
      });

    } catch (error) {
      console.error('Authority review error:', error);

      return res.status(500).json({
        error: 'Failed to review document.'
      });
    }
  }
);
