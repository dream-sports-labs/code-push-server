const db = require('../mock_data');
const { json, html, fieldErr } = require('../utils/response');

const { getUserId } = require('../utils/auth');

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// GET /account
function getAccount(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const account = db.getAccount(accountId);
  if (!account) {
    return res.status(404).send('Account not found');
  }

  return res.status(200).json({ account });
}

// POST /account
function postAccount(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!req.body || !req.body.account) {
    return res.status(400).send(JSON.stringify([{ field: 'account', message: 'Required field missing' }]));
  }

  const acc = req.body.account;

  if (!acc.name || !acc.name.trim()) {
    return res.status(400).send(JSON.stringify([{ field: 'name', message: 'Required field missing' }]));
  }

  if (acc.email && !isValidEmail(acc.email)) {
    return res.status(400).send(JSON.stringify([{ field: 'email', message: 'Invalid email format' }]));
  }

  const email = acc.email ? acc.email.toLowerCase() : null;
  const exists = email && db.accounts.some(a => a.email && a.email.toLowerCase() === email);

  if (exists) {
    return res.status(409).send('The provided resource already exists');
  }

  // Use accountId from Bearer token as the account ID
  db.accounts.push({
    id: accountId,
    name: acc.name,
    email: acc.email || null,
    linkedProviders: []
  });

  return res.status(200).json({ account: accountId });
}

module.exports = {
  getAccount,
  postAccount
};

