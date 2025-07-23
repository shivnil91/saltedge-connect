const crypto = require("crypto");
const https = require("https");

const credentials = {
  app_id: process.env.SALTEDGE_APP_ID,
  secret: process.env.SALTEDGE_SECRET
};

function signedHeaders(url, method, params) {
  const expiresAt = Math.floor(new Date().getTime() / 1000 + 60);
  let payload = `${expiresAt}|${method}|${url}|`;

  if (method === "POST") {
    payload += JSON.stringify(params);
  }

  const privateKey = process.env.SALTEDGE_PRIVATE_KEY.replace(/\\n/g, '\n');
  const signer = crypto.createSign("sha256");

  signer.update(payload);
  signer.end();

  return {
    "Accept": "application/json",
    "App-id": credentials.app_id,
    "Content-Type": "application/json",
    "Expires-at": expiresAt,
    "Secret": credentials.secret,
    "Signature": signer.sign(privateKey, "base64"),
  };
}

// Example: Get list of countries from Salt Edge
function getCountries() {
  const options = {
    hostname: "www.saltedge.com",
    path: "/api/v5/countries",
    method: "GET",
    headers: signedHeaders("/api/v5/countries", "GET")
  };

  const req = https.request(options, res => {
    let data = "";
    res.on("data", chunk => { data += chunk; });
    res.on("end", () => {
      try {
        console.log("Countries:", JSON.parse(data));
      } catch (e) {
        console.error("Failed to parse response:", e);
      }
    });
  });

  req.on("error", e => {
    console.error("Request error:", e);
  });

  req.end();
}

// Run example
getCountries();
