// src/controllers/auth.controller.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import InviteCode from '../models/InviteCode.js';
import Config from '../models/Config.js';

const isProd = process.env.NODE_ENV === 'production';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function setAuthCookie(res, payload) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not set');
  }
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

  // Cross-site friendly in production (Vercel <-> Render); lax for local dev
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProd,               // must be true for SameSite=None
    sameSite: isProd ? 'none' : 'lax',
    maxAge: ONE_WEEK_MS,
    path: '/',                    // make sure the cookie is visible everywhere
  });
}

export async function bootstrapAdmin(req, res) {
  try {
    const exists = await User.countDocuments({});
    if (exists) return res.status(400).json({ error: 'Already bootstrapped' });

    const { name, email, password, currencyCode } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const passHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: String(email).toLowerCase(),
      passHash,
      role: 'Admin',
    });

    // Make the first admin also an active employee and set initial config
    await Employee.create({ name, email, status: 'Active' });
    await Config.create({ currencyCode: currencyCode || 'USD' });

    setAuthCookie(res, { id: user._id, role: user.role, name: user.name, email: user.email });
    res.json({ ok: true, user: { id: user._id, name: user.name, role: user.role, email: user.email } });
  } catch (e) {
    console.error('bootstrapAdmin error', e);
    res.status(500).json({ error: 'Failed to bootstrap admin' });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    setAuthCookie(res, { id: user._id, role: user.role, name: user.name, email: user.email });
    res.json({ ok: true, user: { id: user._id, name: user.name, role: user.role, email: user.email } });
  } catch (e) {
    console.error('login error', e);
    res.status(500).json({ error: 'Login failed' });
  }
}

export async function signup(req, res) {
  try {
    const { name, email, password, code } = req.body || {};
    if (!name || !email || !password || !code) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const normalizedEmail = String(email).toLowerCase();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(400).json({ error: 'Email exists' });

    const c = await InviteCode.findOne({ code, used: false });
    if (!c) return res.status(400).json({ error: 'Invalid or used code' });

    const passHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email: normalizedEmail, passHash, role: 'Employee' });

    await Employee.create({ name, email, status: 'Active' });
    c.used = true;
    c.issuedTo = name || email;
    await c.save();

    // Don’t auto-login on signup (keeps flow explicit). Frontend will prompt login.
    res.json({ ok: true });
  } catch (e) {
    console.error('signup error', e);
    res.status(500).json({ error: 'Signup failed' });
  }
}

export async function me(req, res) {
  // requireAuth middleware should have populated req.user
  res.json({ user: req.user || null });
}

export async function logout(req, res) {
  try {
    // To reliably clear cross-site cookies, mirror the same options
    res.clearCookie('token', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('logout error', e);
    res.status(500).json({ error: 'Logout failed' });
  }
}
