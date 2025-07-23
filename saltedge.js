const https = require("https");
const crypto = require("crypto");

const appId     = process.env.SALTEDGE_APP_ID;
const secret    = process.env.SALTEDGE_SECRET;
const privateKey = process.env.SALTEDGE_PRIVATE_KEY.replace(/\\n/g, '\n');

function signedHeaders(url, method, params = {}) {
  const expiresAt = Math.floor(new Date().getTime() / 1000 + 60);
  let payload = `${expiresAt}|${method}|${url}|`;

  if (method === "POST") {
    payload += JSON.stringify(params);
  }

  const signer = crypto.createSign("sha256");
  signer.update(payload);
  signer.end();

  const signature = signer.sign(privateKey, "base64");

  return {
    "Accept":       "application/json",
    "Content-Type": "application/json",
    "App-id":       appId,
    "Secret":       secret,
    "Expires-at":   expiresAt,
    "Signature":    signature
  };
}

function getCountries() {
  const method = "GET";
  const url = "/api/v5/countries";

  const options = {
    hostname: "www.saltedge.com",
    path: url,
    method: method,
    headers: signedHeaders(url, method)
  };

  const req = https.request(options, res => {
    let data = "";
    res.on("data", chunk => { data += chunk; });
    res.on("end", () => {
      try {
        const json = JSON.parse(data);
        console.log("Countries:", json);
      } catch (err) {
        console.error("Failed to parse response:", err.message);
      }
    });
  });

  req.on("error", error => {
    console.error("Request error:", error);
  });

  req.end();
}

// Run the test
getCountries();
