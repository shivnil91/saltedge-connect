const fs = require("fs");
const https = require("https");
const crypto = require("crypto");

// Load credentials from environment variables in Render
const credentials = {
  app_id: process.env.APP_ID,
  secret: process.env.SECRET,
  private_key: process.env.SALTEDGE_PRIVATE_KEY // Must be a one-line escaped private key
};

// Sign Salt Edge request
function signedHeaders(url, method, params) {
  const expiresAt = Math.floor(new Date().getTime() / 1000 + 60);
  let payload = `${expiresAt}|${method}|${url}|`;

  if (method === "POST" && params) {
    payload += JSON.stringify(params);
  }

  const privateKey = credentials.private_key.replace(/\\n/g, "\n");
  const signer = crypto.createSign("sha256");
  signer.update(payload);
  signer.end();

  return {
    "Accept": "application/json",
    "App-id": credentials.app_id,
    "Secret": credentials.secret,
    "Content-Type": "application/json",
    "Expires-at": expiresAt,
    "Signature": signer.sign(privateKey, "base64")
  };
}

// Make HTTP request
function request(options) {
  options.headers = signedHeaders(options.url, options.method, options.data);

  return new Promise((resolve, reject) => {
    const req = https.request(options.url, options, (res) => {
      const chunks = [];

      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const data = Buffer.concat(chunks).toString();
        res.statusCode === 200 ? resolve(data) : reject(data);
      });
    });

    req.on("error", (err) => reject(err));

    if (options.data && options.method !== "GET") {
      req.write(JSON.stringify(options.data));
    }

    req.end();
  });
}

// Run tests

// STEP 1: Get supported countries
request({
  method: "GET",
  url: "https://www.saltedge.com/api/v6/countries"
})
.then(data => console.log("Countries:", data))
.catch(err => console.error("Countries error:", err));

// STEP 2: Create customer
request({
  method: "POST",
  url: "https://www.saltedge.com/api/v6/customers",
  data: {
    data: {
      identifier: "testuser@thirdroc.com" // must be unique
    }
  }
})
.then(data => {
  console.log("Customer created:", data);
  const parsed = JSON.parse(data);
  const customerId = parsed.data.id;

  // STEP 3: Create connect session using customerId
  return request({
    method: "POST",
    url: "https://www.saltedge.com/api/v6/connections/connect",
    data: {
      data: {
        customer_id: customerId,
        consent: {
          scopes: ["accounts", "transactions"]
        },
        attempt: {
          return_to: "https://yourdomain.com/return", // your frontend
          fetch_scopes: ["accounts", "transactions"]
        },
        widget: {
          javascript_callback_type: "post_message"
        },
        provider: {
          include_sandboxes: true
        }
      }
    }
  });
})
.then(data => {
  console.log("Connect session created:", data);
})
.catch(err => {
  console.error("Error during customer or session creation:", err);
});
