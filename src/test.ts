import { checkMultipleOwnersForMint } from "./database/db";
import { getDoubleHoldings } from "./core/walletTracker";

// Tests
(async () => {
  const run = false;
  if (run) {
    const dups = await checkMultipleOwnersForMint();
    console.log(dups);
  }
})();

(async () => {
  const run = false;
  if (run) {
    const dups = await getDoubleHoldings();
    console.log(dups);
  }
})();
