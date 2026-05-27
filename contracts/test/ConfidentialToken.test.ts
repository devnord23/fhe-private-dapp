/**
 * ConfidentialToken.test.ts
 *
 * Tests run against the Hardhat fhEVM mock provided by the `fhevm` package.
 * The mock replaces the on-chain precompile system with a local simulation that
 * lets tests encrypt/decrypt values synchronously.
 *
 * Run: npm test
 *
 * The tests verify:
 *   1. shield()            – public ERC-20 is locked; encrypted balance increases
 *   2. transfer()          – encrypted balance moves from sender to receiver
 *   3. requestUnshield()   – Gateway decrypts and releases public ERC-20
 *   4. Overflow protection – transfer with insufficient balance silently transfers 0
 *   5. ACL enforcement     – only authorised addresses can re-encrypt balances
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { createInstances } from "fhevm/lib/fhevmjsMock";
import type { ConfidentialToken, MockERC20 } from "../typechain-types";

// Decimals used by MockERC20 in this test suite
const DECIMALS = 6;
const UNIT = BigInt(10 ** DECIMALS);

function toUnits(n: number): bigint {
  return BigInt(n) * UNIT;
}

describe("ConfidentialToken", function () {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;

  let underlying: MockERC20;
  let ct: ConfidentialToken;

  beforeEach(async () => {
    [owner, alice, bob, carol] = await ethers.getSigners();

    // Deploy underlying MockERC20
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    underlying = (await MockERC20.deploy(
      "Mock USDC", "mUSDC", DECIMALS, owner.address
    )) as unknown as MockERC20;
    await underlying.waitForDeployment();

    // Deploy ConfidentialToken
    const ConfidentialToken = await ethers.getContractFactory("ConfidentialToken");
    ct = (await ConfidentialToken.deploy(
      await underlying.getAddress(),
      "Confidential USDC",
      "cUSDC",
      owner.address
    )) as unknown as ConfidentialToken;
    await ct.waitForDeployment();

    // Mint tokens and approve
    const mintAmount = toUnits(10_000);
    await underlying.mint(alice.address, mintAmount);
    await underlying.mint(bob.address, mintAmount);
    await underlying
      .connect(alice)
      .approve(await ct.getAddress(), mintAmount);
    await underlying
      .connect(bob)
      .approve(await ct.getAddress(), mintAmount);
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Encrypt a uint64 for a given signer and return handles + proof. */
  async function encryptAmount(signer: SignerWithAddress, amount: bigint) {
    const { instance } = await createInstances(signer.address, ethers, signer);
    const input = instance.createEncryptedInput(
      await ct.getAddress(),
      signer.address
    );
    input.add64(amount);
    return input.encrypt();
  }

  /** Re-encrypt and return the plaintext balance of a signer. */
  async function getBalance(signer: SignerWithAddress): Promise<bigint> {
    const { instance, publicKey } = await createInstances(
      signer.address,
      ethers,
      signer
    );
    const handle = await ct.encryptedBalanceOf(signer.address);
    return instance.reencrypt(
      handle,
      publicKey,
      await ct.getAddress(),
      signer.address
    );
  }

  // ── Tests ──────────────────────────────────────────────────────────────────

  describe("shield()", function () {
    it("locks underlying tokens and increments encrypted balance", async function () {
      const amount = toUnits(1000);
      const underlyingBefore = await underlying.balanceOf(alice.address);

      await ct.connect(alice).shield(amount);

      // Underlying leaves Alice's wallet
      expect(await underlying.balanceOf(alice.address)).to.equal(
        underlyingBefore - amount
      );

      // Underlying now held by contract
      expect(await underlying.balanceOf(await ct.getAddress())).to.equal(amount);

      // Encrypted balance increases (verified via re-encryption)
      expect(await getBalance(alice)).to.equal(amount);
    });

    it("accumulates balance across multiple shields", async function () {
      await ct.connect(alice).shield(toUnits(300));
      await ct.connect(alice).shield(toUnits(200));
      expect(await getBalance(alice)).to.equal(toUnits(500));
    });

    it("emits Shielded event with public amount", async function () {
      await expect(ct.connect(alice).shield(toUnits(100)))
        .to.emit(ct, "Shielded")
        .withArgs(alice.address, toUnits(100));
    });

    it("reverts if amount is 0", async function () {
      await expect(ct.connect(alice).shield(0)).to.be.revertedWith(
        "ConfidentialToken: amount must be > 0"
      );
    });
  });

  describe("transfer()", function () {
    beforeEach(async () => {
      // Give Alice 1000 tokens in the pool
      await ct.connect(alice).shield(toUnits(1000));
    });

    it("moves encrypted balance from sender to receiver", async function () {
      const { handles, inputProof } = await encryptAmount(alice, toUnits(250));
      await ct.connect(alice).transfer(bob.address, handles[0], inputProof);

      expect(await getBalance(alice)).to.equal(toUnits(750));
      expect(await getBalance(bob)).to.equal(toUnits(250));
    });

    it("emits Transfer event WITHOUT amount (amount stays encrypted)", async function () {
      const { handles, inputProof } = await encryptAmount(alice, toUnits(100));
      await expect(
        ct.connect(alice).transfer(bob.address, handles[0], inputProof)
      )
        .to.emit(ct, "Transfer")
        .withArgs(alice.address, bob.address);
      // Note: no amount argument in the Transfer event – this is intentional.
    });

    it("does NOT revert on insufficient balance – silently transfers 0", async function () {
      // Alice only has 1000 tokens; try to transfer 2000.
      const { handles, inputProof } = await encryptAmount(alice, toUnits(2000));
      await ct.connect(alice).transfer(bob.address, handles[0], inputProof);

      // Balances unchanged (TFHE.select returned 0)
      expect(await getBalance(alice)).to.equal(toUnits(1000));
      expect(await getBalance(bob)).to.equal(0n);
    });

    it("reverts when transferring to self", async function () {
      const { handles, inputProof } = await encryptAmount(alice, toUnits(100));
      await expect(
        ct.connect(alice).transfer(alice.address, handles[0], inputProof)
      ).to.be.revertedWith("ConfidentialToken: self-transfer not allowed");
    });
  });

  describe("requestUnshield() + callbackUnshield()", function () {
    beforeEach(async () => {
      await ct.connect(alice).shield(toUnits(1000));
    });

    it("releases underlying ERC-20 after Gateway callback", async function () {
      const pubBefore = await underlying.balanceOf(bob.address);

      const { handles, inputProof } = await encryptAmount(alice, toUnits(300));
      await ct.connect(alice).requestUnshield(handles[0], inputProof, bob.address);
      // In the Hardhat mock the Gateway callback fires in the same transaction.

      // Alice's shielded balance decreases
      expect(await getBalance(alice)).to.equal(toUnits(700));
      // Bob receives public ERC-20 tokens
      expect(await underlying.balanceOf(bob.address)).to.equal(
        pubBefore + toUnits(300)
      );
    });

    it("emits UnshieldRequested then Unshielded events", async function () {
      const { handles, inputProof } = await encryptAmount(alice, toUnits(100));
      const tx = await ct
        .connect(alice)
        .requestUnshield(handles[0], inputProof, bob.address);
      const receipt = await tx.wait();
      expect(receipt?.logs.some((l) => l.fragment?.name === "UnshieldRequested")).to.be.true;
      expect(receipt?.logs.some((l) => l.fragment?.name === "Unshielded")).to.be.true;
    });

    it("silently unshields 0 if balance is insufficient", async function () {
      const pubBefore = await underlying.balanceOf(bob.address);
      const { handles, inputProof } = await encryptAmount(alice, toUnits(5000));
      await ct.connect(alice).requestUnshield(handles[0], inputProof, bob.address);

      // No ERC-20 transferred to Bob
      expect(await underlying.balanceOf(bob.address)).to.equal(pubBefore);
      // Alice's encrypted balance unchanged
      expect(await getBalance(alice)).to.equal(toUnits(1000));
    });
  });

  describe("ACL (Access Control)", function () {
    it("prevents one user from re-encrypting another user's balance", async function () {
      await ct.connect(alice).shield(toUnits(500));

      // Bob tries to re-encrypt Alice's balance using his own key pair
      const { instance: bobInstance, publicKey: bobPubKey } = await createInstances(
        bob.address, ethers, bob
      );
      const aliceHandle = await ct.encryptedBalanceOf(alice.address);

      // The mock should throw or return 0 because Bob doesn't have ACL access
      await expect(
        bobInstance.reencrypt(
          aliceHandle,
          bobPubKey,
          await ct.getAddress(),
          alice.address // Alice's address passed as requester – will be rejected
        )
      ).to.be.reverted;
    });
  });
});
