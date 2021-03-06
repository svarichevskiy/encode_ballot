import { expect } from "chai";
import { randomBytes } from "crypto";
import { Wallet } from "ethers";
import { ethers } from "hardhat";
// eslint-disable-next-line node/no-missing-import
import { Ballot } from "../../typechain";

const PROPOSALS = ["Proposal 1", "Proposal 2", "Proposal 3"];

function convertStringArrayToBytes32(array: string[]) {
  const bytes32Array = [];
  for (let index = 0; index < array.length; index++) {
    bytes32Array.push(ethers.utils.formatBytes32String(array[index]));
  }
  return bytes32Array;
}

async function giveRightToVote(ballotContract: Ballot, voterAddress: any) {
  const tx = await ballotContract.giveRightToVote(voterAddress);
  await tx.wait();
}

describe("Ballot", function () {
  let ballotContract: Ballot;
  let accounts: any[];

  this.beforeEach(async function () {
    accounts = await ethers.getSigners();
    const ballotFactory = await ethers.getContractFactory("Ballot");
    ballotContract = await ballotFactory.deploy(
      convertStringArrayToBytes32(PROPOSALS)
    );
    await ballotContract.deployed();
  });

  describe("when the contract is deployed", function () {
    it("has the provided proposals", async function () {
      for (let index = 0; index < PROPOSALS.length; index++) {
        const proposal = await ballotContract.proposals(index);
        expect(ethers.utils.parseBytes32String(proposal.name)).to.eq(
          PROPOSALS[index]
        );
      }
    });

    it("has zero votes for all proposals", async function () {
      for (let index = 0; index < PROPOSALS.length; index++) {
        const proposal = await ballotContract.proposals(index);
        expect(proposal.voteCount.toNumber()).to.eq(0);
      }
    });

    it("sets the deployer address as chairperson", async function () {
      const chairperson = await ballotContract.chairperson();
      expect(chairperson).to.eq(accounts[0].address);
    });

    it("sets the voting weight for the chairperson as 1", async function () {
      const chairpersonVoter = await ballotContract.voters(accounts[0].address);
      expect(chairpersonVoter.weight.toNumber()).to.eq(1);
    });
  });

  describe("when the chairperson interacts with the giveRightToVote function in the contract", function () {
    it("gives right to vote for another address", async function () {
      const voterAddress = accounts[1].address;
      await giveRightToVote(ballotContract, voterAddress);
      const voter = await ballotContract.voters(voterAddress);
      expect(voter.weight.toNumber()).to.eq(1);
    });

    it("can not give right to vote for someone that has voted", async function () {
      const voterAddress = accounts[1].address;
      await giveRightToVote(ballotContract, voterAddress);
      await ballotContract.connect(accounts[1]).vote(0);
      await expect(
        giveRightToVote(ballotContract, voterAddress)
      ).to.be.revertedWith("The voter already voted.");
    });

    it("can not give right to vote for someone that has already voting rights", async function () {
      const voterAddress = accounts[1].address;
      await giveRightToVote(ballotContract, voterAddress);
      await expect(
        giveRightToVote(ballotContract, voterAddress)
      ).to.be.revertedWith("");
    });
  });

  describe("when the voter interact with the vote function in the contract", function () {
    it("voter add vote for proposals", async function () {
      const voterAddress = accounts[1].address;
      await giveRightToVote(ballotContract, voterAddress);
      await ballotContract.voters(voterAddress);
      const index = 0;
      await ballotContract.connect(accounts[1]).vote(index);
      const proposal = await ballotContract.proposals(index);
      expect(proposal.voteCount.toNumber()).to.eq(1);
    });
  });

  describe("when the voter interact with the delegate function in the contract", function () {
    it("voter delegate", async function () {
      const voterAddress = accounts[1].address;
      await giveRightToVote(ballotContract, voterAddress);
      const delegateAddress = accounts[2].address;
      await giveRightToVote(ballotContract, delegateAddress);
      await ballotContract.connect(accounts[1]).delegate(delegateAddress);
      const voter = await ballotContract.voters(delegateAddress);
      expect(voter.weight.toNumber()).to.eq(2);
    });
    it("Self-delegation is disallowed.", async function () {
      const voterAddress = accounts[1].address;
      await giveRightToVote(ballotContract, voterAddress);
      const delegateAddress = accounts[2].address;
      await expect(
        ballotContract.connect(accounts[2]).delegate(delegateAddress)
      ).to.be.revertedWith("Self-delegation is disallowed.");
    });
  });

  describe("when the an attacker interact with the giveRightToVote function in the contract", function () {
    // TODO
    it("is not implemented", async function () {
      throw new Error("Not implemented");
    });
  });

  describe("when the an attacker interact with the vote function in the contract", function () {
    // TODO
    it("is not implemented", async function () {
      throw new Error("Not implemented");
    });
  });

  describe("when the an attacker interact with the delegate function in the contract", function () {
    // TODO
    it("is not implemented", async function () {
      throw new Error("Not implemented");
    });
  });

  describe("when someone interact with the winningProposal function before any votes are cast", function () {
    it("before votes", async function () {
      const winningProposal = await ballotContract.winningProposal();
      expect(winningProposal).to.eq(0);
    });
  });

  describe("when someone interact with the winningProposal function after one vote is cast for the first proposal", function () {
    it("after one vote", async function () {
      const voterAddress = accounts[1].address;
      await giveRightToVote(ballotContract, voterAddress);
      await ballotContract.voters(voterAddress);
      const index = 1;
      await ballotContract.connect(accounts[1]).vote(index);
      const winningProposal = await ballotContract.winningProposal();
      expect(winningProposal).to.eq(1);
    });
  });

  describe("when someone interact with the winnerName function before any votes are cast", function () {
    it("before votes", async function () {
      const winnerName = await ballotContract.winnerName();
      expect(ethers.utils.parseBytes32String(winnerName)).to.eq("Proposal 1");
    });
  });

  describe("when someone interact with the winnerName function after one vote is cast for the first proposal", function () {
    it("after one vote", async function () {
      const voterAddress = accounts[1].address;
      await giveRightToVote(ballotContract, voterAddress);
      await ballotContract.voters(voterAddress);
      const index = 1;
      await ballotContract.connect(accounts[1]).vote(index);
      const winnerName = await ballotContract.winnerName();
      expect(ethers.utils.parseBytes32String(winnerName)).to.eq("Proposal 2");
    });
  });

  describe("when someone interact with the winningProposal function and winnerName after 5 random votes are cast for the proposals", function () {
    it("Winner Name with 5 random votes", async function () {
      // const randomAddresses = new Array(5)
      //   .fill(0)
      //   .map(() => new Wallet(randomBytes(32).toString("hex")).address);
      const randomVote = Math.floor(Math.random() * 5);
      console.log("okS");
      for (let index = 0; index < 4; index++) {
        await giveRightToVote(ballotContract, accounts[index].address);
        console.log("ok1");
        await ballotContract.voters(accounts[index].address);
        console.log("ok2");
        await ballotContract.connect(accounts[index]).vote(randomVote);
        console.log("ok3");
      }
      console.log("okF");
      const winnerName = await ballotContract.winnerName();
      console.log(ethers.utils.parseBytes32String(winnerName));
    });
  });
});
