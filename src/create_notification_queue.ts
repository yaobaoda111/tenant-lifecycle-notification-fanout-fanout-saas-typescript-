import { infrai } from "./infrai.js";

const result = await infrai.queue.create("tenant-lifecycle-notifications:v1");
console.log("Notification queue ready", result);
