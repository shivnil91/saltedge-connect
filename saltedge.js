const fs = require("fs");
const https = require("https");
const crypto = require("crypto");

// Credentials pulled from environment variables
const credentials = {
  app_id: process.env.APP_ID,
  secret: process.env.SECRET,
  private_key: process.env.SALTEDGE_PRIVATE_KEY
};

// Function to create signed headers
function signedHeaders(url, method, params) {
  const expiresAt = Math.floor(Date.now() / 1000 + 60);
  let payload = `${expiresAt}|${method}|${url}|`;

  if (method === "POST") {
    payload += JSON.stringify(params);
  }

  const privateKey = credentials.private_key.replace(/\\n/g, '\n');
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

// Optional callback signature verification
function verifySignature(signature, callbackUrl, postBody) {
  const payload = `${callbackUrl}|${postBody}`;
  const publicKey = fs.readFileSync("../spectre_public.pem");
  const verifier = crypto.createVerify("sha256");

  verifier.update(payload);
  verifier.end();

  return verifier.verify(publicKey, signature, "base64");
}

// Make a request to Salt Edge
function request(options) {
  options.headers = signedHeaders(options.url, options.method, options.data);

  return new Promise((resolve, reject) => {
    const req = https.request(options.url, options, (response) => {
      const chunks = [];

      response.on("data", chunk => chunks.push(chunk));
      response.on("end", () => {
        const data = Buffer.concat(chunks).toString();
        response.statusCode === 200 ? resolve(data) : reject(data);
      });
      response.on("error", () => {
        const data = Buffer.concat(chunks).toString();
        reject(data);
      });
    });

    if (options.data && options.method !== "GET") {
      req.write(JSON.stringify(options.data));
    }

    req.end();
  });
}

// Test 1: Get countries
request({
  method: "GET",
  url: "https://www.saltedge.com/api/v6/countries"
})
  .then(data => console.log("Countries:", data))
  .catch(err => console.error("Countries error:", err));

// Test 2: Create a customer
request({
  method: "POST",
  url: "https://www.saltedge.com/api/v6/customers",
  data: {
    data: {
      identifier: "my_unique_sdidentifier" // replace with email or unique ID
    }
  }
})
  .then(data => console.log("Customer created:", data))
  .catch(err => console.error("Customer create error:", err));

// Test 3: Create connect session
request({
  method: "POST",
  url: "https://www.saltedge.com/api/v6/connections/connect",
  data: {
    data: {
      customer_id: "", // insert valid customer_id from above call
      consent: {
        scopes: ["accounts", "transactions"]
      },
      attempt: {
        return_to: "https://www.example.com",
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
})
  .then(data => console.log("Connect session:", data))
  .catch(err => console.error("Connect session error:", err));
