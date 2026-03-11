"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lemonsqueezyWebhook = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
// Initialize Firebase Admin globally
admin.initializeApp();
const db = admin.firestore();
// Secret from Lemon Squeezy webhook settings
// To set this locally: firebase functions:secrets:set LEMONSQUEEZY_WEBHOOK_SECRET
// For dev fallback, use a hardcoded fallback or environment variable
const WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET || "LEMON_TEST_SECRET";
exports.lemonsqueezyWebhook = functions.https.onRequest(async (req, res) => {
    // Only accept POST requests
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }
    try {
        // 1. Validate Signature
        const signature = req.headers["x-signature"];
        if (!signature || typeof signature !== "string") {
            functions.logger.error("Missing X-Signature header");
            res.status(400).send("Invalid signature");
            return;
        }
        // Must use rawBody to calculate HMAC
        const rawBody = req.rawBody;
        const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
        const digest = Buffer.from(hmac.update(rawBody).digest("hex"), "utf8");
        const signatureBuffer = Buffer.from(signature, "utf8");
        if (digest.length !== signatureBuffer.length || !crypto.timingSafeEqual(digest, signatureBuffer)) {
            functions.logger.error("Invalid signature provided.");
            res.status(400).send("Invalid signature");
            return;
        }
        // 2. Parse Body Object
        const payload = JSON.parse(rawBody.toString());
        const eventName = payload.meta.event_name;
        const orderId = payload.data.id;
        const customData = payload.meta.custom_data;
        functions.logger.info(`Received webhook: ${eventName} for Order ${orderId}`);
        // If order created/paid, upgrade user
        if (eventName === "order_created") {
            const uid = customData === null || customData === void 0 ? void 0 : customData.uid;
            const email = payload.data.attributes.user_email;
            if (!uid) {
                functions.logger.error(`Order ${orderId} does not contain metadata.custom_data.uid - unable to upgrade automatically.`);
                // We still return 200 so Lemon Squeezy knows we received it
                res.status(200).send("Missing custom_data.uid; order logged.");
                return;
            }
            // 3. Idempotency Check (Don't process same order twice)
            const orderRef = db.collection("processed_orders").doc(orderId.toString());
            const orderSnap = await orderRef.get();
            if (orderSnap.exists) {
                functions.logger.info(`Order ${orderId} has already been processed. Skipping.`);
                res.status(200).send("Already processed");
                return;
            }
            // 4. Upgrade User Tier
            const userRef = db.collection("users").doc(uid);
            await userRef.update({
                tier: "premium",
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            // Also set Custom Auth Claim for faster checking on the client
            await admin.auth().setCustomUserClaims(uid, { premium: true });
            // Save order idempotency
            await orderRef.set({
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
                email: email,
                uid: uid
            });
            functions.logger.info(`Successfully upgraded User: ${uid} to Premium via Order: ${orderId}`);
            res.status(200).send("Webhook handled successfully");
        }
        else {
            // Ignored event
            res.status(200).send(`Unhandled event: ${eventName}`);
        }
    }
    catch (err) {
        functions.logger.error("Webhook processing failed:", err.message);
        res.status(500).send("Internal Server Error");
    }
});
//# sourceMappingURL=index.js.map