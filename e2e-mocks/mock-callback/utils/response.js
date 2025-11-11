// Response helper utilities

function json(statusCode, body) {
  return {
    statusCode,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }
  };
}

function html(statusCode, msg) {
  return {
    statusCode,
    body: msg,
    headers: { 'Content-Type': 'text/html' }
  };
}

function fieldErr(field, msg) {
  return html(400, JSON.stringify([{ field, message: msg }]));
}

function sendError(res, statusCode, message) {
  return res.status(statusCode).json({ error: message });
}

module.exports = {
  json,
  html,
  fieldErr,
  sendError
};

