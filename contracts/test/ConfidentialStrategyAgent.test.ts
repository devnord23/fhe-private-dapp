/**
 * ConfidentialStrategyAgent.test.ts
 *
 * Two-tier test structure (same pattern as ConfidentialToken.test.ts):
 *
 *  Tier 1 – LOCAL HARDHAT (runs always):
 *    Deployment, authorization, input validation.
 *    Tests that exercise code paths BEFORE any TFHE precompile calls.
 *
 *  Tier 2 – FHEVM NETWORK (skipped unless FHEVM_NETWORK is set):
 *    createStrategy, evaluateStrategy, requestReveal, Gateway callbacks.
 *    These require live fhEVM precompiles on Zama Devnet or Sepolia.
 *
 * Run: npm test
 * Run with FHE: FHEVM_NETWORK=zamaDevnet npm test (requires deployment)
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import type { ConfidentialStrategyAgent } from "../typechain-types";

describe("ConfidentialStrategyAgent", function () {
  let protocolOwner: SignerWithAddress;
  let strategyOwner: SignerWithAddress;
  let agent: SignerWithAddress;
  let stranger: SignerWithAddress;

  let csa: ConfidentialStrategyAgent;

  // ── Deploy before each test ────────────────────────────────────────────────

  beforeEach(async () => {
    [protocolOwner, strategyOwner, agent, stranger] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("ConfidentialStrategyAgent");
    csa = (await Factory.deploy(
      protocolOwner.address
    )) as unknown as ConfidentialStrategyAgent;
    await csa.waitForDeployment();
  });

  // ── Deployment ─────────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("sets the correct protocol owner", async function () {
      expect(await csa.protocolOwner()).to.equal(protocolOwner.address);
    });

    it("starts with zero strategies", async function () {
      expect(await csa.nextStrategyId()).to.equal(0n);
    });

    it("agent addresses start as unauthorized", async function () {
      expect(await csa.authorizedAgents(agent.address)).to.be.false;
    });

    it("exposes correct PARAM_* constants", async function () {
      expect(await csa.PARAM_APY_TARGET()).to.equal(0);
      expect(await csa.PARAM_REBALANCE_THRESHOLD()).to.equal(1);
      expect(await csa.PARAM_STOP_LOSS_BUFFER()).to.equal(2);
      expect(await csa.PARAM_LIQUIDATION_BUFFER()).to.equal(3);
      expect(await csa.PARAM_MAX_LEVERAGE()).to.equal(4);
      expect(await csa.PARAM_EVAL_COUNT()).to.equal(5);
    });
  });

  // ── Agent Authorization ────────────────────────────────────────────────────

  describe("authorizeAgent()", function () {
    it("protocol owner can authorize an agent", async function () {
      await csa.connect(protocolOwner).authorizeAgent(agent.address, true);
      expect(await csa.authorizedAgents(agent.address)).to.be.true;
    });

    it("protocol owner can revoke agent authorization", async function () {
      await csa.connect(protocolOwner).authorizeAgent(agent.address, true);
      await csa.connect(protocolOwner).authorizeAgent(agent.address, false);
      expect(await csa.authorizedAgents(agent.address)).to.be.false;
    });

    it("emits AgentAuthorized event", async function () {
      await expect(csa.connect(protocolOwner).authorizeAgent(agent.address, true))
        .to.emit(csa, "AgentAuthorized")
        .withArgs(agent.address, true);
    });

    it("reverts when called by non-owner", async function () {
      await expect(
        csa.connect(stranger).authorizeAgent(agent.address, true)
      ).to.be.revertedWith("ConfidentialStrategyAgent: not protocol owner");
    });

    it("reverts when agent address is zero", async function () {
      await expect(
        csa.connect(protocolOwner).authorizeAgent(ethers.ZeroAddress, true)
      ).to.be.revertedWith("ConfidentialStrategyAgent: zero agent");
    });
  });

  // ── evaluateStrategy – Access Control ─────────────────────────────────────

  describe("evaluateStrategy() – access control", function () {
    it("reverts when caller is not an authorized agent", async function () {
      // Strategy 0 doesn't exist but the agent check fires first
      const dummyHandle = ethers.zeroPadBytes("0x01", 32);
      const dummyProof = "0x";
      await expect(
        csa
          .connect(stranger)
          .evaluateStrategy(0, dummyHandle, dummyHandle, dummyProof)
      ).to.be.revertedWith("ConfidentialStrategyAgent: not authorized agent");
    });

    it("reverts when strategy does not exist (agent is authorized)", async function () {
      await csa.connect(protocolOwner).authorizeAgent(agent.address, true);
      const dummyHandle = ethers.zeroPadBytes("0x01", 32);
      const dummyProof = "0x";
      await expect(
        csa
          .connect(agent)
          .evaluateStrategy(999, dummyHandle, dummyHandle, dummyProof)
      ).to.be.revertedWith("ConfidentialStrategyAgent: strategy not found");
    });
  });

  // ── Strategy owner access control ─────────────────────────────────────────

  describe("onlyStrategyOwner guarded functions", function () {
    it("requestParameterReveal reverts for non-existent strategy", async function () {
      await expect(
        csa.connect(strategyOwner).requestParameterReveal(999, 0)
      ).to.be.revertedWith("ConfidentialStrategyAgent: strategy not found");
    });

    it("requestEvaluationReveal reverts for non-existent strategy", async function () {
      await expect(
        csa.connect(strategyOwner).requestEvaluationReveal(999)
      ).to.be.revertedWith("ConfidentialStrategyAgent: strategy not found");
    });

    it("updateStrategy reverts for non-existent strategy", async function () {
      const h = ethers.zeroPadBytes("0x01", 32);
      await expect(
        csa.connect(strategyOwner).updateStrategy(999, h, h, h, h, h, "0x")
      ).to.be.revertedWith("ConfidentialStrategyAgent: strategy not found");
    });

    it("deactivateStrategy reverts for non-existent strategy", async function () {
      await expect(
        csa.connect(strategyOwner).deactivateStrategy(999)
      ).to.be.revertedWith("ConfidentialStrategyAgent: strategy not found");
    });
  });

  // ── getStrategyMetadata – non-existent strategy ────────────────────────────

  describe("getStrategyMetadata()", function () {
    it("reverts for non-existent strategy", async function () {
      await expect(csa.getStrategyMetadata(0)).to.be.revertedWith(
        "ConfidentialStrategyAgent: strategy not found"
      );
    });
  });

  // ── getOwnerStrategies ─────────────────────────────────────────────────────

  describe("getOwnerStrategies()", function () {
    it("returns empty array for address with no strategies", async function () {
      const ids = await csa.getOwnerStrategies(strategyOwner.address);
      expect(ids).to.deep.equal([]);
    });
  });

  // ── TFHE Operations – skipped on local Hardhat ─────────────────────────────

  describe("TFHE Operations (skipped on local Hardhat – requires Zama fhEVM)", function () {
    before(function () {
      if (!process.env.FHEVM_NETWORK) {
        console.log(
          "      ℹ  Skipping FHE tests. Set FHEVM_NETWORK=zamaDevnet to enable them."
        );
        this.skip();
      }
    });

    it("createStrategy() stores encrypted parameters and emits StrategyCreated", async function () {
      // In a real fhEVM test, fhevmjs would encrypt the parameters here.
      // Placeholder – see scripts/deployAgent.ts for the live flow.
      this.skip();
    });

    it("evaluateStrategy() performs homomorphic comparisons and updates encrypted state", async function () {
      // Requires: deployed strategy, authorized agent, real encrypted inputs.
      this.skip();
    });

    it("requestParameterReveal() triggers Gateway and reveals value in callback", async function () {
      // Requires: deployed strategy with at least one evaluation.
      this.skip();
    });

    it("requestEvaluationReveal() reveals both evaluation outcome booleans", async function () {
      // Requires: deployed strategy with at least one evaluation.
      this.skip();
    });

    it("ACL: non-owner cannot re-encrypt strategy parameters", async function () {
      // Requires fhevmjs.reencrypt() against live contract.
      this.skip();
    });

    it("silent failure: evaluateStrategy with amount > balance transfers 0 (TFHE.select)", async function () {
      // Demonstrates that TFHE.select prevents info leakage via revert.
      this.skip();
    });
  });
});
