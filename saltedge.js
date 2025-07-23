const https = require("https");
const crypto = require("crypto");
const credentials = require("./credentials.json");

// Helper function to create signed headers for Salt Edge API requests
function signedHeaders(url, method, params = {}) {
  const expiresAt = Math.floor(Date.now() / 1000) + 60;
  let payload = `${expiresAt}|${method}|${url}|`;

  if (method === "POST") {
    payload += JSON.stringify(params);
  }

  const privateKey = process.env.SALTEDGE_PRIVATE_KEY.replace(/\\n/g, "\n");
  const signer = crypto.createSign("sha256");
  signer.update(payload);
  signer.end();

  return {
    Accept: "application/json",
    "App-id": credentials.app_id,
    "Content-Type": "application/json",
    "Expires-at": expiresAt,
    Secret: credentials.secret,
    Signature: signer.sign(privateKey, "base64")
  };
}

// Helper to send HTTPS requests to Salt Edge
function request({ method, url, data = {} }) {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(url);
    const options = {
      hostname: fullUrl.hostname,
      path: fullUrl.pathname + fullUrl.search,
      method,
      headers: signedHeaders(url, method, data)
    };

    const req = https.request(options, res => {
      let body = "";
      res.on("data", chunk => (body += chunk));
      res.on("end", () => resolve(body));
    });

    req.on("error", reject);
    if (method === "POST") req.write(JSON.stringify(data));
    req.end();
  });
}

// Main logic
(async () => {
  try {
    // Step 1: Get countries (sample GET request to verify connection)
    const countries = await request({
      method: "GET",
      url: "https://www.saltedge.com/api/v6/countries"
    });
    console.log("Countries:", countries);

    // Step 2: Create customer
    const customerData = await request({
      method: "POST",
      url: "https://www.saltedge.com/api/v6/customers",
      data: {
        data: {
          identifier: "testuser@thirdroc.com"
        }
      }
    });

    console.log("Customer created:", customerData);
    const parsedCustomer = JSON.parse(customerData);
    const customerId = parsedCustomer.data.customer_id;

    // Step 3: Create connect session
    const sessionData = await request({
      method: "POST",
      url: "https://www.saltedge.com/api/v6/connections/connect",
      data: {
        data: {
          customer_id: customerId,
          consent: {
            scopes: ["accounts", "transactions"]
          },
          attempt: {
            return_to: "https://yourdomain.com/return", // CHANGE THIS
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

    console.log("Connect session:", sessionData);
  } catch (err) {
    console.error("Error during customer or session creation:", err.message || err);
  }
})();
