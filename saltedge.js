const fs = require("fs");
const https = require("https");
const crypto = require("crypto");

const credentials = require("./credentials.json");

function signedHeaders(url, method, params = null) {
  const expiresAt = Math.floor(Date.now() / 1000) + 60;

  let payload = `${expiresAt}|${method}|${url}|`;
  if (method === "POST" && params) {
    payload += JSON.stringify(params);
  }

  const privateKey = fs.readFileSync("private.pem", "utf8");

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(payload);
  signer.end();

  const signature = signer.sign(privateKey, "base64");

  return {
    "Accept": "application/json",
    "App-id": credentials.app_id,
    "Secret": credentials.secret,
    "Expires-at": expiresAt.toString(),
    "Signature": signature,
    "Content-Type": "application/json"
  };
}

function fetchCountries() {
  const path = "/api/v5/countries";
  const options = {
    hostname: "www.saltedge.com",
    path: path,
    method: "GET",
    headers: signedHeaders(path, "GET")
  };

  const req = https.request(options, (res) => {
    let data = "";
    res.on("data", (chunk) => {
      data += chunk;
    });
    res.on("end", () => {
      try {
        console.log("Countries:", JSON.parse(data));
      } catch (e) {
        console.error("Failed to parse response:", e);
      }
    });
  });

  req.on("error", (e) => {
    console.error("Request failed:", e);
  });

  req.end();
}

fetchCountries();
