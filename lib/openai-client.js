/**
 * Singleton OpenAI client.
 * The API key is read exclusively from process.env.OPENAI_KEY on the server.
 * This module must never be imported in client-side code.
 */
"use strict";

const OpenAI = require("openai");

let _client = null;

function getClient() {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_KEY environment variable is not set");
  }
  _client = new OpenAI({ apiKey });
  return _client;
}

module.exports = { getClient };
