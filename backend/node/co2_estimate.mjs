import { co2 } from "@tgwf/co2";

const [, , bytesArg = "0", greenArg = "false", modelArg = "swd"] = process.argv;
const bytes = Number.parseInt(bytesArg, 10);
const green = ["1", "true", "yes"].includes(String(greenArg).toLowerCase());

const estimator = new co2({ model: modelArg || "swd" });
const grams = Number.isFinite(bytes) && bytes > 0 ? estimator.perByte(bytes, green) : 0;

process.stdout.write(JSON.stringify({ grams }));
