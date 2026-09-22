import { expect } from "chai";
import { ethers } from "hardhat";
import { Greeter } from "../typechain-types";

describe("Greeter", function () {
  let greeter: Greeter;

  beforeEach(async function () {
    const GreeterFactory = await ethers.getContractFactory("Greeter");
    greeter = (await GreeterFactory.deploy("Hello, Anagu!")) as Greeter;
    await greeter.waitForDeployment();
  });

  describe("deployment", function () {
    it("should deploy and return the initial greeting", async function () {
      expect(await greeter.greet()).to.equal("Hello, Anagu!");
    });

    it("should deploy to a valid contract address", async function () {
      const address = await greeter.getAddress();
      expect(address).to.match(/^0x[0-9a-fA-F]{40}$/);
    });
  });

  describe("greet()", function () {
    it("should return the greeting set in the constructor", async function () {
      const GreeterFactory = await ethers.getContractFactory("Greeter");
      const g = (await GreeterFactory.deploy("Anagu Land Registry")) as Greeter;
      await g.waitForDeployment();
      expect(await g.greet()).to.equal("Anagu Land Registry");
    });

    it("should return an empty string when deployed with empty greeting", async function () {
      const GreeterFactory = await ethers.getContractFactory("Greeter");
      const g = (await GreeterFactory.deploy("")) as Greeter;
      await g.waitForDeployment();
      expect(await g.greet()).to.equal("");
    });
  });

  describe("setGreeting()", function () {
    it("should update the greeting", async function () {
      await greeter.setGreeting("New Greeting");
      expect(await greeter.greet()).to.equal("New Greeting");
    });

    it("should allow multiple greeting updates", async function () {
      await greeter.setGreeting("First");
      expect(await greeter.greet()).to.equal("First");

      await greeter.setGreeting("Second");
      expect(await greeter.greet()).to.equal("Second");
    });

    it("should allow any caller to update the greeting", async function () {
      const [, other] = await ethers.getSigners();
      await greeter.connect(other).setGreeting("From other account");
      expect(await greeter.greet()).to.equal("From other account");
    });
  });
});
