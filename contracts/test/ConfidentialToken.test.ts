/**
 * ConfidentialToken.test.ts
 *
 * These tests run on a local Hardhat node (no fhEVM precompiles).
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  IMPORTANT: Two tiers of tests                                           │
 * │                                                                          │
 * │  Tier 1 – LOCAL HARDHAT (this file, always run):                        │
 * │   • Deployment and metadata                                              │
 * │   • Input validation (require() checks before any TFHE calls)           │
 * │   • ERC-20 mechanics (mint, approve, balanceOf)                          │
 * │                                                                          │
 * │  Tier 2 – ZAMA DEVNET (skipped locally, needs real fhEVM):              │
 * │   • shield() → encrypted balance created                                 │
 * │   • transfer() → homomorphic balance update                              │
 * │   • requestUnshield() → Gateway callback → ERC-20 released              │
 * │   • Re-encryption balance verification                                   │
 * │                                                                          │
 * │  To run Tier 2: deploy to Zama Devnet (npm run deploy:zamaDevnet)        │
 * │  and run a separate integration test against the live contract.          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Run: npm test
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import type { ConfidentialToken, MockERC20 } from "../typechain-types";

// Decimals for MockERC20 used in tests
const DECIMALS = 6;
const UNIT = BigInt(10 ** DECIMALS);
const toUnits = (n: number) => BigInt(n) * UNIT;

describe("ConfidentialToken", function () {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let underlying: MockERC20;
  let ct: ConfidentialToken;

  // ── Deploy fresh contracts before each test ────────────────────────────────

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();

    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    underlying = (await MockERC20Factory.deploy(
      "Mock USDC",
      "mUSDC",
      DECIMALS,
      owner.address
    )) as unknown as MockERC20;
    await underlying.waitForDeployment();

    const ConfidentialTokenFactory = await ethers.getContractFactory(
      "ConfidentialToken"
    );
    ct = (await ConfidentialTokenFactory.deploy(
      await underlying.getAddress(),
      "Confidential USDC",
      "cUSDC",
      owner.address
    )) as unknown as ConfidentialToken;
    await ct.waitForDeployment();
  });

  // ── Deployment ─────────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("stores the correct name", async function () {
      expect(await ct.name()).to.equal("Confidential USDC");
    });

    it("stores the correct symbol", async function () {
      expect(await ct.symbol()).to.equal("cUSDC");
    });

    it("stores the correct underlying address", async function () {
      expect(await ct.underlying()).to.equal(await underlying.getAddress());
    });

    it("sets the deployer as owner", async function () {
      expect(await ct.owner()).to.equal(owner.address);
    });

    it("deploys MockERC20 with correct decimals", async function () {
      expect(await underlying.decimals()).to.equal(DECIMALS);
    });
  });

  // ── ERC-20 Mechanics (no TFHE) ─────────────────────────────────────────────

  describe("ERC-20 mechanics", function () {
    it("owner can mint MockERC20 tokens", async function () {
      const mintAmount = toUnits(10_000);
      await underlying.mint(alice.address, mintAmount);
      expect(await underlying.balanceOf(alice.address)).to.equal(mintAmount);
    });

    it("approve allows the contract to spend tokens", async function () {
      await underlying.mint(alice.address, toUnits(1000));
      await underlying.connect(alice).approve(await ct.getAddress(), toUnits(500));
      expect(
        await underlying.allowance(alice.address, await ct.getAddress())
      ).to.equal(toUnits(500));
    });
  });

  // ── shield() – input validation (no TFHE required) ─────────────────────────

  describe("shield() – input validation", function () {
    it("reverts when amount is 0", async function () {
      await expect(ct.connect(alice).shield(0)).to.be.revertedWith(
        "ConfidentialToken: amount must be > 0"
      );
    });

    it("reverts when caller has not approved the contract", async function () {
      await underlying.mint(alice.address, toUnits(1000));
      // No approve call – safeTransferFrom should fail with ERC20 error
      await expect(ct.connect(alice).shield(toUnits(100))).to.be.reverted;
    });

    it("reverts when caller has insufficient ERC-20 balance", async function () {
      // Alice has no tokens, but tries to shield via approval
      await underlying.connect(alice).approve(await ct.getAddress(), toUnits(100));
      await expect(ct.connect(alice).shield(toUnits(100))).to.be.reverted;
    });
  });

  // ── transfer() – input validation ──────────────────────────────────────────

  describe("transfer() – input validation", function () {
    it("reverts when recipient is zero address", async function () {
      const dummyHandle = ethers.zeroPadBytes("0x01", 32);
      const dummyProof = "0x";
      await expect(
        ct.connect(alice).transfer(ethers.ZeroAddress, dummyHandle, dummyProof)
      ).to.be.revertedWith("ConfidentialToken: transfer to zero address");
    });

    it("reverts when sender is the same as recipient", async function () {
      const dummyHandle = ethers.zeroPadBytes("0x01", 32);
      const dummyProof = "0x";
      await expect(
        ct.connect(alice).transfer(alice.address, dummyHandle, dummyProof)
      ).to.be.revertedWith("ConfidentialToken: self-transfer not allowed");
    });
  });

  // ── requestUnshield() – input validation ───────────────────────────────────

  describe("requestUnshield() – input validation", function () {
    it("reverts when recipient is zero address", async function () {
      const dummyHandle = ethers.zeroPadBytes("0x01", 32);
      const dummyProof = "0x";
      await expect(
        ct.connect(alice).requestUnshield(dummyHandle, dummyProof, ethers.ZeroAddress)
      ).to.be.revertedWith("ConfidentialToken: zero recipient");
    });
  });

  // ── recoverExpiredUnshield() – input validation (no TFHE required) ────────

  describe("recoverExpiredUnshield() – input validation (security fix 2.1)", function () {
    it("reverts for an unknown requestId (no pending unshield exists)", async function () {
      // No pending unshield → sender field is zero address → revert expected.
      // This test exercises the guard before any TFHE precompile is called.
      await expect(
        ct.connect(alice).recoverExpiredUnshield(99999n)
      ).to.be.revertedWith("ConfidentialToken: unknown requestId");
    });
  });

  // ── rescueTokens() ─────────────────────────────────────────────────────────

  describe("rescueTokens()", function () {
    it("reverts when trying to rescue the underlying token", async function () {
      await expect(
        ct.connect(owner).rescueTokens(await underlying.getAddress(), 1)
      ).to.be.revertedWith("ConfidentialToken: cannot rescue underlying");
    });

    it("reverts when called by non-owner", async function () {
      // Deploy a dummy ERC-20 to rescue
      const DummyFactory = await ethers.getContractFactory("MockERC20");
      const dummy = await DummyFactory.deploy("Dummy", "DUM", 18, owner.address);
      await dummy.waitForDeployment();

      await expect(
        ct.connect(alice).rescueTokens(await dummy.getAddress(), 0)
      ).to.be.reverted; // Ownable revert
    });
  });

  // ── TFHE Operations – skipped on local Hardhat ─────────────────────────────

  describe("TFHE Operations (skipped on local Hardhat – requires Zama fhEVM)", function () {
    /**
     * These tests are skipped because fhEVM precompiles are not present on a
     * standard Hardhat node.  TFHE.asEuint64(plaintext) calls the TFHEExecutor
     * precompile which does not exist at its Sepolia address on local Hardhat.
     *
     * To run these tests:
     *   1. Deploy to Zama Devnet: npm run deploy:zamaDevnet
     *   2. Run integration tests against the live contract (see README).
     *
     * Alternatively, integrate the @fhevm/hardhat-plugin (v2 API) once Zama
     * publishes a compatible mock for the TFHE.sol v0.6 library version.
     */

    before(function () {
      if (!process.env.FHEVM_NETWORK) {
        console.log(
          "      ℹ  Skipping FHE tests. Set FHEVM_NETWORK=zamaDevnet and run " +
            "against a deployed contract to enable them."
        );
        this.skip();
      }
    });

    it("shield() deposits ERC-20 and creates an encrypted balance handle", async function () {
      await underlying.mint(alice.address, toUnits(1000));
      await underlying
        .connect(alice)
        .approve(await ct.getAddress(), toUnits(1000));

      await ct.connect(alice).shield(toUnits(500));

      // After shielding, the contract holds the ERC-20 tokens.
      expect(await underlying.balanceOf(await ct.getAddress())).to.equal(
        toUnits(500)
      );

      // The encrypted balance handle should be non-zero.
      const handle = await ct.encryptedBalanceOf(alice.address);
      expect(handle).to.not.equal(0n);
    });

    it("transfer() moves encrypted balance and emits Transfer without amount", async function () {
      // Setup: alice shields 1000
      await underlying.mint(alice.address, toUnits(1000));
      await underlying
        .connect(alice)
        .approve(await ct.getAddress(), toUnits(1000));
      await ct.connect(alice).shield(toUnits(1000));

      // NOTE: In a real test this would use fhevmjs to encrypt the transfer amount.
      // Placeholder: we cannot call transfer() without a valid encrypted input on devnet.
      // See scripts/interact.ts for the full fhevmjs example.
      this.skip();
    });

    it("requestUnshield() reduces balance and triggers Gateway callback", async function () {
      this.skip(); // Requires Gateway deployment on the target network.
    });

    it("recoverExpiredUnshield() restores balance after Gateway timeout (security fix 2.1)", async function () {
      // Full test requires:
      //   1. alice.shield(500) → creates encrypted balance
      //   2. alice.requestUnshield(encAmount, proof, bob.address)
      //      → balance deducted, pendingUnshields[requestId] stored with maxTimestamp
      //   3. Advance block.timestamp past maxTimestamp (1 hour)
      //   4. alice.recoverExpiredUnshield(requestId)
      //      → balance restored, UnshieldRecovered event emitted
      //   5. Re-encrypt alice's balance → should be back to 500
      this.skip(); // Requires fhEVM precompiles + time manipulation on Zama Devnet.
    });
  });
});
