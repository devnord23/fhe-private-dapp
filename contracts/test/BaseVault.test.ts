/**
 * BaseVault.test.ts
 *
 * BaseVault.sol contains NO TFHE calls — ALL tests here run on local Hardhat
 * without any fhEVM mock or Zama network connection.
 *
 * Coverage:
 *   ✅ Deployment and initial state
 *   ✅ deposit() — success, ERC-20 transfer, balance tracking
 *   ✅ deposit() — input validation (zero token, zero amount)
 *   ✅ deposit() — auto-strategy linking
 *   ✅ linkStrategy() — explicit linking and re-linking
 *   ✅ requestWithdrawal() — success, insufficient balance
 *   ✅ relayerCompleteWithdrawal() — success, unauthorized caller
 *   ✅ cancelPendingWithdrawal() — success, cancel > pending
 *   ✅ emergencyWithdraw() — success, nothing to withdraw
 *   ✅ setRelayer() — owner only
 *   ✅ vaultBalance() — tracks contract ERC-20 balance
 *   ✅ Event emissions — DepositCreated, WithdrawalRequested, StrategyLinked, etc.
 *   ✅ ReentrancyGuard (structural — contract inherits OZ ReentrancyGuard)
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import type { BaseVault, MockERC20 } from "../typechain-types";

const DECIMALS = 6;
const UNIT = BigInt(10 ** DECIMALS);
const u = (n: number) => BigInt(n) * UNIT;

describe("BaseVault", function () {
  let owner: SignerWithAddress;
  let relayer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let stranger: SignerWithAddress;

  let token: MockERC20;
  let vault: BaseVault;

  const STRATEGY_ID = 42n;

  beforeEach(async () => {
    [owner, relayer, alice, bob, stranger] = await ethers.getSigners();

    // Deploy MockERC20
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    token = (await MockERC20Factory.deploy(
      "Mock USDC", "mUSDC", DECIMALS, owner.address
    )) as unknown as MockERC20;
    await token.waitForDeployment();

    // Deploy BaseVault (owner + relayer)
    const BaseVaultFactory = await ethers.getContractFactory("BaseVault");
    vault = (await BaseVaultFactory.deploy(
      owner.address,
      relayer.address
    )) as unknown as BaseVault;
    await vault.waitForDeployment();

    // Fund users
    await token.mint(alice.address, u(10_000));
    await token.mint(bob.address, u(10_000));
  });

  // ── Deployment ─────────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("sets the correct owner", async function () {
      expect(await vault.owner()).to.equal(owner.address);
    });

    it("sets the initial relayer", async function () {
      expect(await vault.relayer()).to.equal(relayer.address);
    });

    it("emits RelayerSet on construction", async function () {
      // Check the deploy transaction emitted RelayerSet
      const BaseVaultFactory = await ethers.getContractFactory("BaseVault");
      const tx = await BaseVaultFactory.deploy(owner.address, relayer.address);
      const receipt = await tx.deploymentTransaction()?.wait();
      const event = receipt?.logs.find(
        (l) => "fragment" in l && l.fragment?.name === "RelayerSet"
      );
      expect(event).to.exist;
    });

    it("starts with zero balances for all users", async function () {
      expect(await vault.getAvailableBalance(alice.address, await token.getAddress())).to.equal(0n);
      expect(await vault.getPendingWithdrawal(alice.address, await token.getAddress())).to.equal(0n);
    });

    it("starts with zero linked strategy for all users", async function () {
      expect(await vault.getLinkedStrategy(alice.address)).to.equal(0n);
    });
  });

  // ── setRelayer() ───────────────────────────────────────────────────────────

  describe("setRelayer()", function () {
    it("owner can change the relayer", async function () {
      await vault.connect(owner).setRelayer(bob.address);
      expect(await vault.relayer()).to.equal(bob.address);
    });

    it("emits RelayerSet event", async function () {
      await expect(vault.connect(owner).setRelayer(bob.address))
        .to.emit(vault, "RelayerSet")
        .withArgs(bob.address);
    });

    it("reverts when called by non-owner", async function () {
      await expect(vault.connect(stranger).setRelayer(stranger.address)).to.be.reverted;
    });
  });

  // ── deposit() ─────────────────────────────────────────────────────────────

  describe("deposit()", function () {
    const tokenAddr = () => token.getAddress();
    const amount = u(500);

    beforeEach(async () => {
      await token.connect(alice).approve(await vault.getAddress(), amount);
    });

    it("transfers ERC-20 from user to vault", async function () {
      const before = await token.balanceOf(alice.address);
      await vault.connect(alice).deposit(await tokenAddr(), amount, 0);
      expect(await token.balanceOf(alice.address)).to.equal(before - amount);
      expect(await token.balanceOf(await vault.getAddress())).to.equal(amount);
    });

    it("increases available balance", async function () {
      await vault.connect(alice).deposit(await tokenAddr(), amount, 0);
      expect(await vault.getAvailableBalance(alice.address, await tokenAddr())).to.equal(amount);
    });

    it("accumulates across multiple deposits", async function () {
      await vault.connect(alice).deposit(await tokenAddr(), u(200), 0);
      await token.connect(alice).approve(await vault.getAddress(), u(300));
      await vault.connect(alice).deposit(await tokenAddr(), u(300), 0);
      expect(await vault.getAvailableBalance(alice.address, await tokenAddr())).to.equal(u(500));
    });

    it("emits DepositCreated with correct parameters", async function () {
      await expect(vault.connect(alice).deposit(await tokenAddr(), amount, STRATEGY_ID))
        .to.emit(vault, "DepositCreated")
        .withArgs(alice.address, await tokenAddr(), amount, STRATEGY_ID);
    });

    it("auto-links strategy when strategyId > 0 and none previously set", async function () {
      await vault.connect(alice).deposit(await tokenAddr(), amount, STRATEGY_ID);
      expect(await vault.getLinkedStrategy(alice.address)).to.equal(STRATEGY_ID);
    });

    it("does NOT override an existing strategy link", async function () {
      await vault.connect(alice).deposit(await tokenAddr(), amount, STRATEGY_ID);
      await token.connect(alice).approve(await vault.getAddress(), amount);
      await vault.connect(alice).deposit(await tokenAddr(), amount, 99n);
      // Should still be the original STRATEGY_ID
      expect(await vault.getLinkedStrategy(alice.address)).to.equal(STRATEGY_ID);
    });

    it("does NOT emit StrategyLinked when strategyId is 0", async function () {
      const tx = await vault.connect(alice).deposit(await tokenAddr(), amount, 0);
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (l) => "fragment" in l && l.fragment?.name === "StrategyLinked"
      );
      expect(event).to.be.undefined;
    });

    it("emits StrategyLinked when first deposit includes strategyId", async function () {
      await expect(vault.connect(alice).deposit(await tokenAddr(), amount, STRATEGY_ID))
        .to.emit(vault, "StrategyLinked")
        .withArgs(alice.address, STRATEGY_ID);
    });

    it("reverts when token address is zero", async function () {
      await expect(
        vault.connect(alice).deposit(ethers.ZeroAddress, amount, 0)
      ).to.be.revertedWith("BaseVault: zero token address");
    });

    it("reverts when amount is zero", async function () {
      await expect(
        vault.connect(alice).deposit(await tokenAddr(), 0, 0)
      ).to.be.revertedWith("BaseVault: amount must be > 0");
    });

    it("reverts when caller has not approved the contract", async function () {
      // Bob has no approval
      await expect(
        vault.connect(bob).deposit(await tokenAddr(), u(100), 0)
      ).to.be.reverted;
    });
  });

  // ── linkStrategy() ────────────────────────────────────────────────────────

  describe("linkStrategy()", function () {
    it("sets the linked strategy ID", async function () {
      await vault.connect(alice).linkStrategy(STRATEGY_ID);
      expect(await vault.getLinkedStrategy(alice.address)).to.equal(STRATEGY_ID);
    });

    it("emits StrategyLinked event", async function () {
      await expect(vault.connect(alice).linkStrategy(STRATEGY_ID))
        .to.emit(vault, "StrategyLinked")
        .withArgs(alice.address, STRATEGY_ID);
    });

    it("overwrites an existing link when called again", async function () {
      await vault.connect(alice).linkStrategy(1n);
      await vault.connect(alice).linkStrategy(99n);
      expect(await vault.getLinkedStrategy(alice.address)).to.equal(99n);
    });

    it("can set strategy to 0 (unlink)", async function () {
      await vault.connect(alice).linkStrategy(STRATEGY_ID);
      await vault.connect(alice).linkStrategy(0n);
      expect(await vault.getLinkedStrategy(alice.address)).to.equal(0n);
    });
  });

  // ── requestWithdrawal() ───────────────────────────────────────────────────

  describe("requestWithdrawal()", function () {
    const tokenAddr = () => token.getAddress();
    const depositAmt = u(1000);
    const withdrawAmt = u(400);

    beforeEach(async () => {
      await token.connect(alice).approve(await vault.getAddress(), depositAmt);
      await vault.connect(alice).deposit(await tokenAddr(), depositAmt, 0);
    });

    it("moves amount from available to pending", async function () {
      await vault.connect(alice).requestWithdrawal(await tokenAddr(), withdrawAmt);
      expect(await vault.getAvailableBalance(alice.address, await tokenAddr())).to.equal(depositAmt - withdrawAmt);
      expect(await vault.getPendingWithdrawal(alice.address, await tokenAddr())).to.equal(withdrawAmt);
    });

    it("does NOT transfer tokens to user immediately", async function () {
      const before = await token.balanceOf(alice.address);
      await vault.connect(alice).requestWithdrawal(await tokenAddr(), withdrawAmt);
      expect(await token.balanceOf(alice.address)).to.equal(before);
    });

    it("emits WithdrawalRequested event", async function () {
      await expect(vault.connect(alice).requestWithdrawal(await tokenAddr(), withdrawAmt))
        .to.emit(vault, "WithdrawalRequested")
        .withArgs(alice.address, await tokenAddr(), withdrawAmt);
    });

    it("allows multiple partial withdrawal requests", async function () {
      await vault.connect(alice).requestWithdrawal(await tokenAddr(), u(300));
      await vault.connect(alice).requestWithdrawal(await tokenAddr(), u(200));
      expect(await vault.getPendingWithdrawal(alice.address, await tokenAddr())).to.equal(u(500));
      expect(await vault.getAvailableBalance(alice.address, await tokenAddr())).to.equal(u(500));
    });

    it("reverts when amount exceeds available balance", async function () {
      await expect(
        vault.connect(alice).requestWithdrawal(await tokenAddr(), u(2000))
      ).to.be.revertedWith("BaseVault: insufficient available balance");
    });

    it("reverts when amount is zero", async function () {
      await expect(
        vault.connect(alice).requestWithdrawal(await tokenAddr(), 0)
      ).to.be.revertedWith("BaseVault: amount must be > 0");
    });

    it("reverts when token address is zero", async function () {
      await expect(
        vault.connect(alice).requestWithdrawal(ethers.ZeroAddress, withdrawAmt)
      ).to.be.revertedWith("BaseVault: zero token address");
    });
  });

  // ── relayerCompleteWithdrawal() ───────────────────────────────────────────

  describe("relayerCompleteWithdrawal()", function () {
    const tokenAddr = () => token.getAddress();
    const depositAmt = u(1000);
    const withdrawAmt = u(400);

    beforeEach(async () => {
      await token.connect(alice).approve(await vault.getAddress(), depositAmt);
      await vault.connect(alice).deposit(await tokenAddr(), depositAmt, 0);
      await vault.connect(alice).requestWithdrawal(await tokenAddr(), withdrawAmt);
    });

    it("relayer can complete withdrawal and transfer tokens to user", async function () {
      const before = await token.balanceOf(alice.address);
      await vault.connect(relayer).relayerCompleteWithdrawal(alice.address, await tokenAddr(), withdrawAmt);
      expect(await token.balanceOf(alice.address)).to.equal(before + withdrawAmt);
    });

    it("decreases pending balance", async function () {
      await vault.connect(relayer).relayerCompleteWithdrawal(alice.address, await tokenAddr(), withdrawAmt);
      expect(await vault.getPendingWithdrawal(alice.address, await tokenAddr())).to.equal(0n);
    });

    it("owner CANNOT complete withdrawal (owner fallback removed — security fix 1.4)", async function () {
      // After removing the `|| msg.sender == owner()` fallback from onlyRelayer,
      // only the designated relayer address is authorised.
      // The owner must set themselves as the relayer explicitly (via setRelayer)
      // to perform completions during development.
      await expect(
        vault.connect(owner).relayerCompleteWithdrawal(alice.address, await tokenAddr(), withdrawAmt)
      ).to.be.revertedWith("BaseVault: caller is not the relayer");
    });

    it("emits WithdrawalCompleted event", async function () {
      await expect(
        vault.connect(relayer).relayerCompleteWithdrawal(alice.address, await tokenAddr(), withdrawAmt)
      )
        .to.emit(vault, "WithdrawalCompleted")
        .withArgs(alice.address, await tokenAddr(), withdrawAmt);
    });

    it("reverts when called by unauthorized address", async function () {
      await expect(
        vault.connect(stranger).relayerCompleteWithdrawal(alice.address, await tokenAddr(), withdrawAmt)
      ).to.be.revertedWith("BaseVault: caller is not the relayer");
    });

    it("reverts when amount exceeds pending balance", async function () {
      await expect(
        vault.connect(relayer).relayerCompleteWithdrawal(alice.address, await tokenAddr(), u(999))
      ).to.be.revertedWith("BaseVault: insufficient pending balance");
    });

    it("reverts when user is zero address", async function () {
      await expect(
        vault.connect(relayer).relayerCompleteWithdrawal(ethers.ZeroAddress, await tokenAddr(), withdrawAmt)
      ).to.be.revertedWith("BaseVault: zero user");
    });
  });

  // ── cancelPendingWithdrawal() ─────────────────────────────────────────────

  describe("cancelPendingWithdrawal()", function () {
    const tokenAddr = () => token.getAddress();
    const depositAmt = u(1000);
    const withdrawAmt = u(400);

    beforeEach(async () => {
      await token.connect(alice).approve(await vault.getAddress(), depositAmt);
      await vault.connect(alice).deposit(await tokenAddr(), depositAmt, 0);
      await vault.connect(alice).requestWithdrawal(await tokenAddr(), withdrawAmt);
    });

    it("returns pending amount to available balance", async function () {
      await vault.connect(alice).cancelPendingWithdrawal(await tokenAddr(), withdrawAmt);
      expect(await vault.getAvailableBalance(alice.address, await tokenAddr())).to.equal(depositAmt);
      expect(await vault.getPendingWithdrawal(alice.address, await tokenAddr())).to.equal(0n);
    });

    it("does NOT transfer tokens", async function () {
      const before = await token.balanceOf(alice.address);
      await vault.connect(alice).cancelPendingWithdrawal(await tokenAddr(), withdrawAmt);
      expect(await token.balanceOf(alice.address)).to.equal(before);
    });

    it("emits WithdrawalCancelled event", async function () {
      await expect(vault.connect(alice).cancelPendingWithdrawal(await tokenAddr(), withdrawAmt))
        .to.emit(vault, "WithdrawalCancelled")
        .withArgs(alice.address, await tokenAddr(), withdrawAmt);
    });

    it("reverts when amount exceeds pending balance", async function () {
      await expect(
        vault.connect(alice).cancelPendingWithdrawal(await tokenAddr(), u(999))
      ).to.be.revertedWith("BaseVault: no pending withdrawal to cancel");
    });

    it("reverts when user has no pending withdrawal at all", async function () {
      await expect(
        vault.connect(bob).cancelPendingWithdrawal(await tokenAddr(), u(100))
      ).to.be.revertedWith("BaseVault: no pending withdrawal to cancel");
    });
  });

  // ── emergencyWithdraw() ───────────────────────────────────────────────────

  describe("emergencyWithdraw()", function () {
    const tokenAddr = () => token.getAddress();

    it("withdraws full available balance directly to user", async function () {
      const depositAmt = u(500);
      await token.connect(alice).approve(await vault.getAddress(), depositAmt);
      await vault.connect(alice).deposit(await tokenAddr(), depositAmt, 0);

      const before = await token.balanceOf(alice.address);
      await vault.connect(alice).emergencyWithdraw(await tokenAddr());
      expect(await token.balanceOf(alice.address)).to.equal(before + depositAmt);
      expect(await vault.getAvailableBalance(alice.address, await tokenAddr())).to.equal(0n);
    });

    it("emits WithdrawalCompleted event", async function () {
      const depositAmt = u(300);
      await token.connect(alice).approve(await vault.getAddress(), depositAmt);
      await vault.connect(alice).deposit(await tokenAddr(), depositAmt, 0);

      await expect(vault.connect(alice).emergencyWithdraw(await tokenAddr()))
        .to.emit(vault, "WithdrawalCompleted")
        .withArgs(alice.address, await tokenAddr(), depositAmt);
    });

    it("reverts when user has nothing to withdraw", async function () {
      await expect(
        vault.connect(alice).emergencyWithdraw(await tokenAddr())
      ).to.be.revertedWith("BaseVault: nothing to withdraw");
    });

    it("does NOT withdraw pending amounts (only available)", async function () {
      const depositAmt = u(1000);
      await token.connect(alice).approve(await vault.getAddress(), depositAmt);
      await vault.connect(alice).deposit(await tokenAddr(), depositAmt, 0);
      await vault.connect(alice).requestWithdrawal(await tokenAddr(), u(300));

      const before = await token.balanceOf(alice.address);
      await vault.connect(alice).emergencyWithdraw(await tokenAddr());
      // Only available (700) is withdrawn; pending (300) stays locked
      expect(await token.balanceOf(alice.address)).to.equal(before + u(700));
      expect(await vault.getPendingWithdrawal(alice.address, await tokenAddr())).to.equal(u(300));
    });
  });

  // ── deposit() – fee-on-transfer accounting (security fix 1.1) ────────────

  describe("deposit() – fee-on-transfer accounting", function () {
    it("credits the RECEIVED amount, not the input amount (standard token: same value)", async function () {
      // For standard ERC-20 tokens received == amount, so the balance
      // must equal exactly what was passed to deposit().
      const tokenAddr = await token.getAddress();
      await token.connect(alice).approve(await vault.getAddress(), u(300));
      await vault.connect(alice).deposit(tokenAddr, u(300), 0);
      expect(await vault.getAvailableBalance(alice.address, tokenAddr)).to.equal(u(300));
    });

    it("emits DepositCreated with the received amount", async function () {
      const tokenAddr = await token.getAddress();
      await token.connect(alice).approve(await vault.getAddress(), u(100));
      // For standard tokens received == amount; event must show the actual credit
      await expect(vault.connect(alice).deposit(tokenAddr, u(100), 0))
        .to.emit(vault, "DepositCreated")
        .withArgs(alice.address, tokenAddr, u(100), 0);
    });
  });

  // ── vaultBalance() ────────────────────────────────────────────────────────

  describe("vaultBalance()", function () {
    it("reflects the actual ERC-20 balance of the contract", async function () {
      const tokenAddr = await token.getAddress();
      const vaultAddr = await vault.getAddress();

      await token.connect(alice).approve(vaultAddr, u(500));
      await vault.connect(alice).deposit(tokenAddr, u(500), 0);

      await token.connect(bob).approve(vaultAddr, u(300));
      await vault.connect(bob).deposit(tokenAddr, u(300), 0);

      expect(await vault.vaultBalance(tokenAddr)).to.equal(u(800));
      // Should match actual ERC-20 balance
      expect(await token.balanceOf(vaultAddr)).to.equal(u(800));
    });

    it("decreases after a completed withdrawal", async function () {
      const tokenAddr = await token.getAddress();
      await token.connect(alice).approve(await vault.getAddress(), u(1000));
      await vault.connect(alice).deposit(tokenAddr, u(1000), 0);
      await vault.connect(alice).requestWithdrawal(tokenAddr, u(400));
      await vault.connect(relayer).relayerCompleteWithdrawal(alice.address, tokenAddr, u(400));

      expect(await vault.vaultBalance(tokenAddr)).to.equal(u(600));
    });
  });

  // ── Isolation between users ───────────────────────────────────────────────

  describe("User isolation", function () {
    it("different users have independent balances for same token", async function () {
      const tokenAddr = await token.getAddress();
      await token.connect(alice).approve(await vault.getAddress(), u(1000));
      await vault.connect(alice).deposit(tokenAddr, u(1000), 0);

      await token.connect(bob).approve(await vault.getAddress(), u(500));
      await vault.connect(bob).deposit(tokenAddr, u(500), 0);

      expect(await vault.getAvailableBalance(alice.address, tokenAddr)).to.equal(u(1000));
      expect(await vault.getAvailableBalance(bob.address, tokenAddr)).to.equal(u(500));
    });

    it("alice's withdrawal request does not affect bob's balance", async function () {
      const tokenAddr = await token.getAddress();
      await token.connect(alice).approve(await vault.getAddress(), u(1000));
      await vault.connect(alice).deposit(tokenAddr, u(1000), 0);
      await token.connect(bob).approve(await vault.getAddress(), u(500));
      await vault.connect(bob).deposit(tokenAddr, u(500), 0);

      await vault.connect(alice).requestWithdrawal(tokenAddr, u(500));

      expect(await vault.getAvailableBalance(bob.address, tokenAddr)).to.equal(u(500));
      expect(await vault.getPendingWithdrawal(bob.address, tokenAddr)).to.equal(0n);
    });
  });
});
